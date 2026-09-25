import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import PlayerCard from '@/components/PlayerCard'
import { byId, cardTotal } from '@/lib/data/cards'
import type { PlayerCardData } from '@/lib/data/types'
import {
  POSITION_GROUPS,
  cardPrimaryGroup,
  parseLineup,
  parseTraining,
  TRAINING_KEYS,
  type Club,
  type OwnedEntry,
  type PositionGroup,
} from './clubUtils'
import FormationPitch from './FormationPitch'
import CardDetailModal from './CardDetailModal'

/** Three-zone chemistry bar (formation fit / practice / performance). */
function ChemistryMeter({ club }: { club: Club }) {
  const lineup = parseLineup(club.lineupJson)
  const filled = lineup.filter((s) => s.cardId && byId(s.cardId)).length
  const fit = filled / 11
  const training = parseTraining(club.trainingJson)
  const practice = TRAINING_KEYS.reduce((a, k) => a + training[k], 0) / (TRAINING_KEYS.length * 5)
  const performance = Math.max(0, Math.min(1, (club.rating - 1300) / 700))

  const zones = [
    { label: 'Formation fit', v: fit, color: '#1E7A4C' },
    { label: 'Practice', v: practice, color: '#FFC531' },
    { label: 'Performance', v: performance, color: '#3DD68C' },
  ]

  return (
    <div
      className="rounded-panel border border-line bg-panel p-3"
      title="The more the three zones overlap, the better your club plays."
    >
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-wccf-mute">
        Team chemistry
      </p>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-raised">
        {zones.map((z) => (
          <span
            key={z.label}
            className="h-full transition-all duration-500"
            style={{ width: `${Math.max(2, z.v * 100)}%`, backgroundColor: z.color }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {zones.map((z) => (
          <span key={z.label} className="flex items-center gap-1 font-mono text-[9px] uppercase text-wccf-dim">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: z.color }} />
            {z.label} {Math.round(z.v * 100)}%
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Squad & Formation tab — pitch editor (left) + owned squad list (right).
 */
export default function SquadTab({ club, owned }: { club: Club; owned: OwnedEntry[] }) {
  const [filter, setFilter] = useState<PositionGroup | 'ALL'>('ALL')
  const [detail, setDetail] = useState<PlayerCardData | null>(null)

  const inXi = useMemo(
    () => new Set(parseLineup(club.lineupJson).map((s) => s.cardId).filter(Boolean) as string[]),
    [club.lineupJson],
  )

  const rows = useMemo(
    () =>
      owned
        .map((entry) => ({ entry, card: byId(entry.cardId) }))
        .filter((r): r is { entry: OwnedEntry; card: PlayerCardData } => !!r.card)
        .filter((r) => (filter === 'ALL' ? true : cardPrimaryGroup(r.card) === filter))
        .sort((a, b) => cardTotal(b.card) - cardTotal(a.card)),
    [owned, filter],
  )

  return (
    <div className="grid gap-4 min-[1100px]:grid-cols-[3fr_2fr]">
      <FormationPitch club={club} owned={owned} />

      {/* squad list */}
      <div className="flex flex-col gap-3">
        <div className="rounded-panel border border-line bg-panel p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold uppercase tracking-[0.06em] text-wccf-ink">
              Squad
            </h3>
            <div className="flex items-center gap-1">
              {(['ALL', ...POSITION_GROUPS] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setFilter(g)}
                  className={cn(
                    'rounded-full border px-2 py-[3px] font-mono text-[9px] font-bold uppercase tracking-[0.06em] transition-colors',
                    filter === g
                      ? 'border-accent bg-accent-dim text-accent'
                      : 'border-line text-wccf-dim hover:text-wccf-ink',
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="flex max-h-[430px] flex-col gap-1.5 overflow-y-auto pr-1">
            {rows.length === 0 && (
              <p className="py-8 text-center font-mono text-[11px] text-wccf-mute">
                No cards in this group yet.
              </p>
            )}
            {rows.map(({ card }) => (
              <button
                key={card.id}
                onClick={() => setDetail(card)}
                className="flex items-center gap-2.5 rounded-card border border-line bg-raised px-2 py-1.5 text-left transition-colors hover:border-line-strong"
              >
                <PlayerCard card={card} size="xs" flippable={false} className="pointer-events-none shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[15px] font-semibold uppercase leading-tight text-wccf-ink">
                    {card.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-wccf-dim">
                    <span className="rounded border border-line px-1 font-mono text-[8px] font-bold">
                      {card.positions.join('/')}
                    </span>
                    <span className="truncate italic">{card.trait}</span>
                    {inXi.has(card.id) && (
                      <span className="rounded bg-accent-dim px-1 font-mono text-[8px] font-bold uppercase text-accent">
                        XI
                      </span>
                    )}
                  </span>
                </span>
                <span className="font-mono text-xs font-bold text-accent tnum">Σ {cardTotal(card)}</span>
              </button>
            ))}
          </div>
        </div>
        <ChemistryMeter club={club} />
      </div>

      <CardDetailModal card={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
