import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import PlayerCard from '@/components/PlayerCard'
import { byId, RARITY_META } from '@/lib/data/cards'
import { cabinetById } from '@/lib/data/cabinets'
import type { TapeMatch } from './tape'
import { fmtDate, opponentAvatar } from './tape'

/** Result pill — 28px W green / D grey / L red. */
function ResultPill({ result }: { result: string }) {
  const style =
    result === 'W'
      ? 'bg-[rgba(61,214,140,0.14)] text-wccf-live border-[rgba(61,214,140,0.4)]'
      : result === 'L'
        ? 'bg-[rgba(255,77,79,0.14)] text-wccf-danger border-[rgba(255,77,79,0.4)]'
        : 'bg-raised text-wccf-mute border-line'
  return (
    <span
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border font-sans text-[12px] font-bold',
        style,
      )}
    >
      {result}
    </span>
  )
}

/** Reward-card chip — PlayerCard xs + "ejected" label, kira shine on hover. */
function RewardChip({
  cardId,
  onClick,
}: {
  cardId: string
  onClick: () => void
}) {
  const card = byId(cardId)
  if (!card) {
    return (
      <span className="hidden h-[90px] w-16 items-center justify-center rounded-card border border-dashed border-line font-mono text-[9px] text-wccf-mute min-[640px]:flex">
        NO CARD
      </span>
    )
  }
  const foil = RARITY_META[card.rarity].foil
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title={`Reward card — ${card.name}`}
      className="group/chip relative hidden shrink-0 flex-col items-center min-[640px]:flex"
    >
      <div className="relative overflow-hidden rounded-card">
        <PlayerCard card={card} size="xs" flippable={false} />
        {foil && (
          <div className="pointer-events-none absolute inset-0 kira-shine opacity-0 transition-opacity duration-200 group-hover/chip:opacity-100" />
        )}
        <div className="pointer-events-none absolute inset-0 rounded-card ring-0 ring-accent/60 transition-shadow duration-150 group-hover/chip:shadow-accent-glow" />
      </div>
      <span className="mt-1 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-wccf-mute transition-colors group-hover/chip:text-accent">
        ejected
      </span>
    </button>
  )
}

/**
 * One match-history row — result pill, score, opponent, cabinet badge,
 * date, reward chip and chevron. Click loads the tape into the stage.
 */
export function HistoryRow({
  match,
  selected,
  index,
  onSelect,
  onRewardClick,
}: {
  match: TapeMatch
  selected: boolean
  index: number
  onSelect: () => void
  onRewardClick: (cardId: string) => void
}) {
  const cabinet = cabinetById(match.cabinetId)
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25, delay: Math.min(index, 12) * 0.03, ease: 'easeOut' }}
    >
      <button
        onClick={onSelect}
        className={cn(
          'flex w-full items-center gap-3 rounded-panel border bg-panel px-3 py-2.5 text-left transition-colors',
          selected
            ? 'border-[rgba(255,138,30,0.45)] bg-accent-dim/60'
            : 'border-line hover:border-line-strong hover:bg-raised',
        )}
      >
        <ResultPill result={match.result} />
        <span className="shrink-0 font-mono text-[16px] font-bold text-wccf-ink tnum">
          {match.scoreFor} <span className="text-wccf-mute">—</span> {match.scoreAgainst}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <img
            src={opponentAvatar(match.opponentName)}
            alt=""
            className="h-6 w-6 shrink-0 rounded-full border border-line object-cover"
          />
          <span className="truncate text-[13px] font-medium text-wccf-ink">{match.opponentName}</span>
        </span>
        <span
          className="hidden shrink-0 rounded-full border border-line bg-raised px-2 py-[3px] font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-wccf-dim min-[860px]:inline-flex"
          title={cabinet.name}
        >
          {cabinet.badge}
        </span>
        <span className="hidden shrink-0 font-mono text-[10px] text-wccf-mute tnum min-[560px]:inline">
          {match.cabinetVersion}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-wccf-mute tnum">{fmtDate(match.createdAt)}</span>
        <RewardChip cardId={match.rewardCardId} onClick={() => onRewardClick(match.rewardCardId)} />
        <ChevronRight
          size={15}
          className={cn('shrink-0 transition-colors', selected ? 'text-accent' : 'text-wccf-mute')}
        />
      </button>
    </motion.li>
  )
}

/** The history list — dense rows, staggered entrance, layout reflow on filter. */
export default function MatchHistory({
  matches,
  selectedId,
  onSelect,
  onRewardClick,
  sentinelRef,
  loadingMore,
}: {
  matches: TapeMatch[]
  selectedId: number | null
  onSelect: (match: TapeMatch) => void
  onRewardClick: (cardId: string) => void
  /** infinite-scroll sentinel (null when everything is loaded) */
  sentinelRef: React.RefObject<HTMLDivElement | null> | null
  loadingMore: boolean
}) {
  return (
    <div>
      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {matches.map((m, i) => (
            <HistoryRow
              key={m.id}
              match={m}
              index={i}
              selected={m.id === selectedId}
              onSelect={() => onSelect(m)}
              onRewardClick={onRewardClick}
            />
          ))}
        </AnimatePresence>
      </ul>
      {sentinelRef && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {loadingMore ? (
            <span className="font-mono text-[11px] text-wccf-mute">Loading older tapes…</span>
          ) : (
            <span className="font-mono text-[11px] text-wccf-mute">·</span>
          )}
        </div>
      )}
    </div>
  )
}
