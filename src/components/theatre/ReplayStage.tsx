import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
import { cn } from '@/lib/utils'
import ScoreBug from '@/components/ScoreBug'
import PlayerCard from '@/components/PlayerCard'
import type { PlayerCardData } from '@/lib/data/types'
import type { TapeMatch } from './tape'
import {
  commentaryLine,
  fmtClock,
  htMinute,
  normKind,
  opponentColor,
  scoreAt,
  shortOf,
  tapeEnd,
} from './tape'
import TimelineScrubber from './TimelineScrubber'
import CommentaryFeed from './CommentaryFeed'
import type { TapeEvent } from './tape'

const SPEEDS = [1, 2, 4] as const
/** playback tick (ms) — 1× = one match minute per second */
const TICK_MS = 100

function TransportButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-btn border border-line bg-raised text-wccf-dim',
        'transition-colors hover:border-line-strong hover:text-wccf-ink',
        disabled && 'cursor-not-allowed opacity-40 hover:border-line hover:text-wccf-dim',
      )}
    >
      {children}
    </button>
  )
}

/** Ball + ambient dots layer — drifts deterministically with the playhead. */
function PitchDots({ t }: { t: number }) {
  const bx = 50 + 30 * Math.sin(t * 0.6)
  const by = 50 + 24 * Math.cos(t * 0.43)
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => {
        const x = 18 + ((i * 37) % 64) + 4 * Math.sin(t * 0.3 + i)
        const y = 18 + ((i * 53) % 60) + 4 * Math.cos(t * 0.27 + i * 2)
        return (
          <span
            key={i}
            className="absolute h-[6px] w-[6px] rounded-full"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              backgroundColor: i % 2 ? 'rgba(255,138,30,0.5)' : 'rgba(61,214,140,0.5)',
            }}
          />
        )
      })}
      <span
        className="absolute h-[9px] w-[9px] rounded-full border border-black/60 bg-[#E8ECF4] shadow-[0_0_10px_rgba(232,236,244,0.5)]"
        style={{ left: `${bx}%`, top: `${by}%` }}
      />
    </>
  )
}

/** Condensed report for matches stored without a timeline — no scrubber. */
function CondensedReport({
  match,
  rewardCard,
  onRewardClick,
}: {
  match: TapeMatch
  rewardCard?: PlayerCardData
  onRewardClick: () => void
}) {
  const resultStyle =
    match.result === 'W'
      ? 'text-wccf-live border-[rgba(61,214,140,0.4)] bg-[rgba(61,214,140,0.1)]'
      : match.result === 'L'
        ? 'text-wccf-danger border-[rgba(255,77,79,0.4)] bg-[rgba(255,77,79,0.1)]'
        : 'text-wccf-mute border-line bg-raised'
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-line bg-inset px-6 py-8">
      <span
        className={cn(
          'rounded-full border px-3 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.08em]',
          resultStyle,
        )}
      >
        {match.result === 'W' ? 'Win' : match.result === 'L' ? 'Loss' : 'Draw'}
      </span>
      <div className="font-mono text-[44px] font-bold leading-none text-wccf-ink tnum">
        {match.scoreFor} <span className="text-wccf-mute">—</span> {match.scoreAgainst}
      </div>
      <p className="font-mono text-[11px] text-wccf-mute">
        Condensed report — no full tape was recorded for this match.
      </p>
      {rewardCard && (
        <button onClick={onRewardClick} className="transition-transform hover:scale-[1.03]" title="View reward card">
          <PlayerCard card={rewardCard} size="sm" flippable={false} />
          <span className="mt-1.5 block text-center font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-accent">
            Reward card — view
          </span>
        </button>
      )}
    </div>
  )
}

/**
 * The replay stage — 16:9 tape viewport (pitch-texture backdrop + ScoreBug),
 * event-timeline scrubber, transport controls and a live commentary feed.
 * Parent should render with `key={match.id}` so playback state resets per tape.
 */
export default function ReplayStage({
  match,
  events,
  homeName,
  homeShort,
  homeColor,
  rewardCard,
  onRewardClick,
}: {
  match: TapeMatch
  events: TapeEvent[]
  homeName: string
  homeShort: string
  homeColor: string
  rewardCard?: PlayerCardData
  onRewardClick: () => void
}) {
  const end = useMemo(() => tapeEnd(events), [events])
  const ht = useMemo(() => htMinute(events), [events])
  const awayName = match.opponentName
  const awayShort = shortOf(awayName)
  const awayColor = useMemo(() => opponentColor(awayName), [awayName])

  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(events.length > 0)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1)

  /* playback clock */
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setT((prev) => {
        const next = Math.min(prev + (TICK_MS / 1000) * speed, end)
        if (next >= end) setPlaying(false) // stop at the end of the tape
        return next
      })
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [playing, speed, end])

  const score = useMemo(() => scoreAt(events, t, awayName), [events, t, awayName])
  const passed = useMemo(() => events.filter((e) => e.min <= t), [events, t])
  const headline = useMemo(() => {
    for (let i = passed.length - 1; i >= 0; i -= 1) {
      if (normKind(passed[i].type) !== 'info') return passed[i]
    }
    return null
  }, [passed])

  const phase: 'playing' | 'halftime' | 'fulltime' =
    t >= end ? 'fulltime' : ht !== null && t >= ht && t < ht + 1 ? 'halftime' : 'playing'
  const half: 1 | 2 = t < (ht ?? 45) ? 1 : 2

  const seek = (min: number) => setT(Math.min(Math.max(0, min), end))
  const restart = () => {
    setT(0)
    setPlaying(true)
  }
  const jumpEvent = (dir: -1 | 1) => {
    if (events.length === 0) return
    if (dir === -1) {
      const prev = [...events].reverse().find((e) => e.min < t - 0.01)
      seek(prev ? prev.min : 0)
    } else {
      const next = events.find((e) => e.min > t + 0.01)
      seek(next ? next.min : end)
    }
  }

  if (events.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <CondensedReport match={match} rewardCard={rewardCard} onRewardClick={onRewardClick} />
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3 min-[1100px]:flex-row"
    >
      {/* stage column */}
      <div className="min-w-0 flex-1">
        {/* 16:9 viewport */}
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-inset">
          <img
            src="/pitch-texture.svg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-90"
            draggable={false}
          />
          <PitchDots t={t} />
          <div className="absolute left-2 top-2">
            <ScoreBug
              homeShort={homeShort}
              awayShort={awayShort}
              homeColor={homeColor}
              awayColor={awayColor}
              homeScore={score.home}
              awayScore={score.away}
              clock={fmtClock(t)}
              half={half}
              phase={phase}
            />
          </div>
          <div className="absolute right-2 top-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,138,30,0.4)] bg-accent-dim px-2 py-[3px] font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-accent">
              <span className="h-[5px] w-[5px] rounded-full bg-accent" />
              Replay
            </span>
          </div>
          {/* headline line */}
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-[rgba(4,6,10,0.9)] to-transparent px-2.5 pb-1.5 pt-6">
            <span className="shrink-0 font-mono text-[10px] font-bold text-accent tnum">
              {headline ? fmtClock(headline.min) : fmtClock(t)}
            </span>
            <span className="truncate text-[12px] text-wccf-ink">
              {headline
                ? commentaryLine(headline, homeName, awayName)
                : `Tape rolling — ${homeName} v ${awayName}.`}
            </span>
          </div>
        </div>

        {/* transport */}
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-card border border-line bg-panel px-2.5 py-2">
          <TransportButton label="Previous event" onClick={() => jumpEvent(-1)} disabled={t <= 0}>
            <SkipBack size={14} />
          </TransportButton>
          <TransportButton label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause size={14} /> : <Play size={14} className="ml-[1px]" />}
          </TransportButton>
          <TransportButton label="Next event" onClick={() => jumpEvent(1)} disabled={t >= end}>
            <SkipForward size={14} />
          </TransportButton>
          <TransportButton label="Restart tape" onClick={restart} disabled={t <= 0 && playing}>
            <RotateCcw size={14} />
          </TransportButton>

          <div className="mx-1 h-5 w-px bg-line" />

          <div className="flex items-center gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  'rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold transition-colors tnum',
                  speed === s
                    ? 'border-[rgba(255,138,30,0.4)] bg-accent-dim text-accent'
                    : 'border-line bg-raised text-wccf-mute hover:text-wccf-ink',
                )}
              >
                {s}×
              </button>
            ))}
          </div>

          <span className="ml-auto font-mono text-[11px] font-bold text-wccf-dim tnum">
            {fmtClock(t)} <span className="text-wccf-mute">/ {fmtClock(end)}</span>
          </span>
        </div>

        {/* scrubber */}
        <div className="mt-2">
          <TimelineScrubber
            events={events}
            t={t}
            end={end}
            homeName={homeName}
            awayName={awayName}
            homeColor={homeColor}
            awayColor={awayColor}
            onSeek={seek}
          />
        </div>
      </div>

      {/* commentary rail — 300px ≥1100px, below on mobile */}
      <CommentaryFeed
        passed={passed}
        homeName={homeName}
        awayName={awayName}
        className="h-64 shrink-0 min-[1100px]:h-auto min-[1100px]:w-[300px]"
      />
    </motion.div>
  )
}
