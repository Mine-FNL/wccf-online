/**
 * PreMatch — the setup-stage content below the VS chrome (spec §3.2, §3.0):
 * both clubs' hexagons, seeded condition arrows (↑↗→↘↓) per XI slot, the
 * lineup summary — plus the era pickers:
 *
 * - KP era: Team Style picker — 1 style per Off/Def/Sup slot from the fixed
 *   9-style catalog; ranks persist in localStorage `wccf-styles:<clubId>`
 *   and climb E→S with use.
 * - Footista: pick 3 of the 14 manager abilities (spec §6 catalog; engine2
 *   consumes `abilities` on TeamInput2 — the ones it implements live are
 *   tagged in catalog.ts).
 * - MANAGEMENT tab (the credit loop, spec §3.0): 1 team action (practice
 *   +axis / rest +spirit) + up to 3 individual trainings (player + stat).
 *   engine2 consumes `management` on TeamInput2 directly (rest → +6 spirit,
 *   individual → +1 to the trained stat); the "practice +axis" half is not
 *   consumed by the engine, so it is applied as a +4 pre-match buff to that
 *   practice axis before createStepper (documented deviation).
 */
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Cabinet } from '@/lib/data/cabinets'
import { cabinetEra } from '@/lib/data/cabinets'
import { cardTotal } from '@/lib/data/cards'
import type { PlayerStats } from '@/lib/data/types'
import { computeHexagon, cardToEnginePlayer2, type Style, type TeamInput2 } from '@/lib/engine2'
import type { TeamInput } from '@/lib/engine'
import HexagonRadar from '@/components/HexagonRadar'
import { parseTraining, zeroTraining } from '@/components/club/clubUtils'
import {
  arrangementNudges,
  userBenchCards,
  type ClubSnapshot,
  type KickoffPlan,
  type OpponentPlan,
  type UserXI,
} from '@/components/match/helpers'
import {
  ABILITY_CATALOG,
  ARROW_GLYPH,
  ARROW_TONE,
  STYLE_CATALOG,
  bumpStyleProgress,
  loadStyleRanks,
  practiceLevelsFromTraining,
  seededArrows,
  type StyleSlot,
} from './catalog'

const AXIS_LABELS = ['OFF', 'DEF', 'POS', 'WIN', 'SPD', 'POW'] as const
const STAT_KEYS: (keyof PlayerStats)[] = ['off', 'def', 'tec', 'pow', 'spd', 'sta']

const TONE_CLASS: Record<string, string> = {
  good: 'text-wccf-live',
  ok: 'text-wccf-live',
  flat: 'text-wccf-mute',
  meh: 'text-wccf-caution',
  bad: 'text-wccf-danger',
}

type Tab = 'overview' | 'era' | 'manage'

interface TrainingRow {
  slot: number | null
  stat: keyof PlayerStats | null
}

export default function PreMatch({
  cabinet,
  club,
  ownedCardIds,
  xi,
  home,
  opp,
  onKickoff,
}: {
  cabinet: Cabinet
  club: ClubSnapshot
  ownedCardIds: string[]
  xi: UserXI
  home: TeamInput
  opp: OpponentPlan
  onKickoff: (plan: KickoffPlan) => void
}) {
  const era = useMemo(() => cabinetEra(cabinet), [cabinet])
  const clubKey = String(club.id ?? club.shortName)
  const seed = opp.seed

  const [tab, setTab] = useState<Tab>('overview')

  /* condition arrows — seeded, shared with the engine via TeamInput2 */
  const condHome = useMemo(() => seededArrows(seed, 'home', 11), [seed])
  const condAway = useMemo(() => seededArrows(seed, 'away', 11), [seed])

  /* style ranks + selection (KP) */
  const [ranks, setRanks] = useState<Record<string, Style>>(() => loadStyleRanks(clubKey))
  const [stylePick, setStylePick] = useState<Record<StyleSlot, string>>({
    off: STYLE_CATALOG.find((s) => s.slot === 'off')!.name,
    def: STYLE_CATALOG.find((s) => s.slot === 'def')!.name,
    sup: STYLE_CATALOG.find((s) => s.slot === 'sup')!.name,
  })

  /* abilities (Footista) — pick 3 of 14 */
  const [abilities, setAbilities] = useState<string[]>([])

  /* management (§3.0) */
  const [teamAction, setTeamAction] = useState<'none' | 'practice' | 'rest'>('none')
  const [practiceAxis, setPracticeAxis] = useState(0)
  const [training, setTraining] = useState<TrainingRow[]>([
    { slot: null, stat: null },
    { slot: null, stat: null },
    { slot: null, stat: null },
  ])

  const nudges = useMemo(() => arrangementNudges(club), [club])
  const basePractice = useMemo(
    () =>
      practiceLevelsFromTraining(
        club.trainingJson
          ? parseTraining(club.trainingJson as Parameters<typeof parseTraining>[0])
          : zeroTraining(),
      ),
    [club.trainingJson],
  )

  /* effective practice levels — the "practice +axis" buff is applied here
   * because engine2 only consumes teamAction 'rest' + individual trainings */
  const practiceLevels = useMemo(() => {
    const out = [...basePractice]
    if (teamAction === 'practice') out[practiceAxis] = Math.min(100, out[practiceAxis] + 4)
    return out
  }, [basePractice, teamAction, practiceAxis])

  const hexHome = useMemo(
    () => computeHexagon(home.xi, nudges, practiceLevels),
    [home.xi, nudges, practiceLevels],
  )
  const hexAway = useMemo(() => computeHexagon(opp.team.xi), [opp.team.xi])

  const toggleAbility = (name: string) =>
    setAbilities((cur) =>
      cur.includes(name) ? cur.filter((a) => a !== name) : cur.length < 3 ? [...cur, name] : cur,
    )

  const kickoff = () => {
    let nextRanks = ranks
    if (era === 'kp') {
      /* rank progress +1 per use (styles taken into the match) */
      nextRanks = bumpStyleProgress(clubKey, [stylePick.off, stylePick.def, stylePick.sup])
      setRanks(nextRanks)
    }
    const management: TeamInput2['management'] = {
      teamAction: teamAction === 'none' ? undefined : teamAction,
      individual: training
        .filter((t): t is { slot: number; stat: keyof PlayerStats } => t.slot != null && t.stat != null),
    }
    const home2: TeamInput2 = {
      name: home.name,
      short: home.short,
      color: home.color,
      xi: xi.cards.map(cardToEnginePlayer2),
      bench: userBenchCards(club, xi, ownedCardIds).map(cardToEnginePlayer2),
      era,
      styles:
        era === 'kp'
          ? {
              off: nextRanks[stylePick.off],
              def: nextRanks[stylePick.def],
              sup: nextRanks[stylePick.sup],
            }
          : undefined,
      abilities: era === 'footista' ? abilities : undefined,
      condition: condHome,
      practiceLevels,
      lineNudges: nudges,
      management,
    }
    const away2: TeamInput2 = {
      name: opp.team.name,
      short: opp.team.short,
      color: opp.team.color,
      xi: opp.cards.map(cardToEnginePlayer2),
      bench: opp.benchCards.map(cardToEnginePlayer2),
      era,
      condition: condAway,
    }
    onKickoff({
      home,
      away: opp.team,
      seed,
      opponent: opp.club,
      opponentRating: opp.rating,
      home2,
      away2,
      era,
    })
  }

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: 'overview', label: 'Overview', show: true },
    { key: 'era', label: era === 'kp' ? 'Team Styles' : 'Abilities', show: era !== 'classic' },
    { key: 'manage', label: 'Management', show: true },
  ]

  return (
    <section className="flex flex-col gap-3 rounded-panel border border-line bg-panel p-4">
      {/* tab bar */}
      <div className="flex items-center gap-1">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'rounded-btn px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-colors',
                tab === t.key ? 'bg-accent-dim text-accent' : 'text-wccf-mute hover:text-wccf-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        <span className="ml-auto rounded-full bg-accent-dim px-2 py-[3px] font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-accent">
          {era === 'kp' ? 'KP era console' : era === 'footista' ? 'Footista console' : 'Classic console'}
        </span>
      </div>

      {/* ---------------- overview ---------------- */}
      {tab === 'overview' && (
        <div className="grid gap-4 min-[900px]:grid-cols-[auto_auto_1fr]">
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-wccf-dim">
              {club.shortName} — team grid
            </span>
            <HexagonRadar formation={hexHome.formation} practice={hexHome.practice} size={190} />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-wccf-mute">
              {opp.team.short} — team grid
            </span>
            <HexagonRadar formation={hexAway.formation} size={190} />
          </div>
          <div className="flex flex-col gap-[3px]">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-wccf-mute">
              Your XI — condition
            </span>
            {xi.slots.map((s, i) => (
              <div key={`${s.position}-${s.card.id}`} className="flex items-center gap-2 rounded-[4px] px-1.5 py-[3px]">
                <span className="w-9 shrink-0 rounded-[3px] bg-inset px-1 py-[1px] text-center font-mono text-[9px] font-bold text-wccf-dim">
                  {s.position}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-wccf-ink">
                  {s.card.name}
                </span>
                <span
                  className={cn('font-mono text-[13px] font-bold', TONE_CLASS[ARROW_TONE[condHome[i] ?? 'flat']])}
                  title={`Condition: ${(condHome[i] ?? 'flat').replace('-', ' ')}`}
                >
                  {ARROW_GLYPH[condHome[i] ?? 'flat']}
                </span>
                <span className="shrink-0 font-mono text-[10px] font-bold text-wccf-dim tnum">
                  Σ{cardTotal(s.card)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- KP: team styles ---------------- */}
      {tab === 'era' && era === 'kp' && (
        <div className="grid gap-3 min-[900px]:grid-cols-3">
          {(['off', 'def', 'sup'] as const).map((slot) => (
            <div key={slot} className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-wccf-mute">
                {slot === 'off' ? 'Offence style' : slot === 'def' ? 'Defence style' : 'Support style'}
              </span>
              {STYLE_CATALOG.filter((s) => s.slot === slot).map((def) => {
                const rank = ranks[def.name]?.rank ?? 'E'
                const picked = stylePick[slot] === def.name
                return (
                  <button
                    key={def.name}
                    type="button"
                    onClick={() => setStylePick((p) => ({ ...p, [slot]: def.name }))}
                    className={cn(
                      'flex items-center gap-2 rounded-[6px] border px-2.5 py-2 text-left transition-colors',
                      picked
                        ? 'border-accent bg-accent-dim'
                        : 'border-line bg-inset hover:border-line-strong',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[12px] font-semibold', picked ? 'text-accent' : 'text-wccf-ink')}>
                        {def.name}
                      </span>
                      <span className="block font-mono text-[9px] text-wccf-mute">{def.blurb}</span>
                    </span>
                    <span
                      className={cn(
                        'rounded-[3px] px-1.5 py-[2px] font-mono text-[10px] font-bold',
                        rank === 'S' ? 'bg-[rgba(232,184,75,0.18)] text-wccf-gold' : 'bg-raised text-wccf-dim',
                      )}
                      title="Style rank — climbs E→S with use"
                    >
                      {rank}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* ---------------- Footista: abilities ---------------- */}
      {tab === 'era' && era === 'footista' && (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-wccf-mute">
            Manager abilities — pick 3 ({abilities.length}/3)
          </span>
          <div className="grid gap-1.5 min-[700px]:grid-cols-2 min-[1000px]:grid-cols-3">
            {ABILITY_CATALOG.map((a) => {
              const on = abilities.includes(a.name)
              return (
                <button
                  key={a.name}
                  type="button"
                  onClick={() => toggleAbility(a.name)}
                  className={cn(
                    'flex items-center gap-2 rounded-[6px] border px-2.5 py-2 text-left transition-colors',
                    on ? 'border-accent bg-accent-dim' : 'border-line bg-inset hover:border-line-strong',
                    !on && abilities.length >= 3 && 'opacity-45',
                  )}
                >
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', on ? 'bg-accent' : 'bg-line-strong')} />
                  <span className="min-w-0">
                    <span className={cn('block truncate text-[12px] font-semibold', on ? 'text-accent' : 'text-wccf-ink')}>
                      {a.name}
                    </span>
                    <span className="block font-mono text-[9px] text-wccf-mute">
                      {a.effect}
                      {!a.live && ' · flavor'}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ---------------- management (§3.0) ---------------- */}
      {tab === 'manage' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-wccf-mute">
              Team action — pick 1
            </span>
            {(
              [
                { key: 'practice', label: 'Practice', hint: '+4 to one hexagon axis' },
                { key: 'rest', label: 'Rest', hint: '+6 spirit, fresher legs' },
              ] as const
            ).map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setTeamAction((cur) => (cur === a.key ? 'none' : a.key))}
                className={cn(
                  'flex items-center gap-2 rounded-btn border px-3 py-1.5 transition-colors',
                  teamAction === a.key
                    ? 'border-accent bg-accent-dim text-accent'
                    : 'border-line bg-inset text-wccf-dim hover:border-line-strong',
                )}
              >
                <span className="font-display text-[13px] font-bold uppercase">{a.label}</span>
                <span className="font-mono text-[9px] opacity-80">{a.hint}</span>
              </button>
            ))}
            {teamAction === 'practice' && (
              <select
                value={practiceAxis}
                onChange={(e) => setPracticeAxis(Number(e.target.value))}
                className="rounded-btn border border-line bg-inset px-2 py-1.5 font-mono text-[10px] font-bold uppercase text-wccf-ink"
                aria-label="Practice axis"
              >
                {AXIS_LABELS.map((l, i) => (
                  <option key={l} value={i}>
                    +{l}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-wccf-mute">
              Individual training — up to 3 (player + stat, +1 pre-match)
            </span>
            {training.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-4 font-mono text-[10px] text-wccf-mute tnum">{i + 1}</span>
                <select
                  value={row.slot ?? ''}
                  onChange={(e) =>
                    setTraining((rows) =>
                      rows.map((r, j) =>
                        j === i ? { ...r, slot: e.target.value === '' ? null : Number(e.target.value) } : r,
                      ),
                    )
                  }
                  className="w-56 rounded-btn border border-line bg-inset px-2 py-1.5 font-mono text-[10px] text-wccf-ink"
                  aria-label={`Training ${i + 1} player`}
                >
                  <option value="">— player —</option>
                  {xi.slots.map((s, slotIdx) => (
                    <option key={s.card.id} value={slotIdx}>
                      {s.position} · {s.card.name}
                    </option>
                  ))}
                </select>
                <select
                  value={row.stat ?? ''}
                  onChange={(e) =>
                    setTraining((rows) =>
                      rows.map((r, j) =>
                        j === i ? { ...r, stat: (e.target.value || null) as keyof PlayerStats | null } : r,
                      ),
                    )
                  }
                  className="rounded-btn border border-line bg-inset px-2 py-1.5 font-mono text-[10px] uppercase text-wccf-ink"
                  aria-label={`Training ${i + 1} stat`}
                >
                  <option value="">— stat —</option>
                  {STAT_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                {(row.slot != null || row.stat != null) && (
                  <button
                    type="button"
                    onClick={() =>
                      setTraining((rows) => rows.map((r, j) => (j === i ? { slot: null, stat: null } : r)))
                    }
                    className="font-mono text-[9px] uppercase text-wccf-mute hover:text-wccf-danger"
                  >
                    Clear
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- kick off ---------------- */}
      <div className="flex flex-col items-center gap-2 pt-1">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={kickoff}
          className="flex items-center gap-2.5 rounded-btn bg-accent px-10 py-3.5 font-display text-2xl font-bold uppercase tracking-[0.08em] text-[#0B0E14] shadow-accent-glow transition-colors hover:bg-accent-hover"
        >
          <Play size={20} strokeWidth={2.6} />
          Kick off
        </motion.button>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-wccf-mute">
          Interactive match — buttons decide the windows · pause available
        </span>
      </div>
    </section>
  )
}
