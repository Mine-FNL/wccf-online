/**
 * Live match screen — runs createMatch(seed, home, away) and plays it back
 * compressed (~150 s for 90 minutes at 1×) through the MatchViewer visual
 * language, with pause, 2×/4× speed, a half-time team-talk interstitial and
 * a full-time state before handing the timeline to the flow root.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import MatchViewer from '@/components/MatchViewer'
import {
  createMatch,
  stateAt,
  type MatchTimeline,
  type TeamInput,
} from '@/lib/engine'

/** 90 minutes (plus stoppage) compressed into ~150 seconds at 1×. */
const BASE_SECONDS = 150
const TICK_MS = 100

const TEAM_TALKS = [
  '“Keep the shape — the gaps will come.”',
  '“Push the full-backs higher. We chase this.”',
  '“Calm on the ball. Make them run.”',
  '“One more goal kills it. Go get it.”',
  '“Win your duels. Everything else follows.”',
  '“They tire late. Stay patient, stay sharp.”',
]

const SPEEDS = [1, 2, 4] as const
type Speed = (typeof SPEEDS)[number]

export default function LiveMatch({
  home,
  away,
  seed,
  seat,
  onFullTime,
}: {
  home: TeamInput
  away: TeamInput
  seed: number
  seat: number
  /** called once, ~2.5 s after the final whistle */
  onFullTime: (timeline: MatchTimeline) => void
}) {
  const tl = useMemo(() => createMatch(seed, home, away), [seed, home, away])
  const rate = tl.duration / BASE_SECONDS

  const [clock, setClock] = useState(0)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  const [teamTalk, setTeamTalk] = useState(false)
  const [done, setDone] = useState(false)
  const clockRef = useRef(0)
  const firedRef = useRef(false)

  /* playback clock */
  useEffect(() => {
    if (paused || teamTalk || done) return
    const id = window.setInterval(() => {
      const c = clockRef.current
      let next = c + (TICK_MS / 1000) * rate * speed
      if (c < tl.halfOneEnd && next >= tl.halfOneEnd) {
        next = tl.halfOneEnd
        setTeamTalk(true)
      } else if (next >= tl.duration) {
        next = tl.duration + 1
        setDone(true)
      }
      clockRef.current = next
      setClock(next)
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [paused, teamTalk, done, rate, speed, tl])

  /* half-time interstitial (~3 s), then jump past the engine's HT break */
  useEffect(() => {
    if (!teamTalk) return
    const id = window.setTimeout(() => {
      /* +61: strictly past the halftime window so phase flips to playing */
      clockRef.current = tl.halfOneEnd + 61
      setClock(tl.halfOneEnd + 61)
      setTeamTalk(false)
    }, 3000)
    return () => window.clearTimeout(id)
  }, [teamTalk, tl])

  /* full-time: hold, then hand over to the flow root (exactly once) */
  useEffect(() => {
    if (!done || firedRef.current) return
    firedRef.current = true
    const id = window.setTimeout(() => onFullTime(tl), 2500)
    return () => window.clearTimeout(id)
  }, [done, tl, onFullTime])

  const talk = TEAM_TALKS[seed % TEAM_TALKS.length]
  const htState = teamTalk ? stateAt(tl, tl.halfOneEnd) : null
  const progress = Math.min(1, clock / tl.duration)

  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-4"
    >
      {/* teams strip */}
      <div className="flex items-center justify-center gap-3 font-mono text-xs text-wccf-dim">
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: home.color }} />
          <span className="font-semibold text-wccf-ink">{home.name}</span>
        </span>
        <span className="text-wccf-mute">v</span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: away.color }} />
          <span className="font-semibold text-wccf-ink">{away.name}</span>
        </span>
      </div>

      <div className="relative">
        <MatchViewer
          timeline={tl}
          clock={clock}
          live={!done}
          seatContext={`You're playing from Seat ${seat}`}
        />

        {/* half-time team talk interstitial */}
        <AnimatePresence>
          {teamTalk && htState && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-card bg-[rgba(4,6,10,0.85)] backdrop-blur-sm"
            >
              <span className="rounded-full bg-accent-dim px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
                Half-time
              </span>
              <div className="font-mono text-2xl font-bold text-wccf-ink tnum">
                {home.short} {htState.score.home} — {htState.score.away} {away.short}
              </div>
              <p className="max-w-xs text-center text-[13px] italic text-wccf-dim">{talk}</p>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-wccf-mute">
                Team talk — second half starts in a moment
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* full-time banner */}
        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-card bg-[rgba(4,6,10,0.72)] backdrop-blur-[2px]"
            >
              <motion.span
                initial={{ scale: 1.25, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 20 }}
                className="font-display text-4xl font-bold uppercase tracking-[0.08em] text-wccf-ink"
              >
                Full time
              </motion.span>
              <div className="font-mono text-xl font-bold text-accent tnum">
                {home.short} {tl.finalScore.home} — {tl.finalScore.away} {away.short}
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-wccf-mute">
                Reporting the result to the cabinet…
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* playback controls */}
      <div className="flex items-center gap-3 rounded-panel border border-line bg-panel px-3 py-2">
        <button
          onClick={() => setPaused((p) => !p)}
          disabled={done}
          aria-label={paused ? 'Resume' : 'Pause'}
          className="flex h-8 w-8 items-center justify-center rounded-btn border border-line text-wccf-ink transition-colors hover:border-accent disabled:opacity-40"
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <div className="flex gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={cn(
                'rounded-btn px-2 py-1 font-mono text-[11px] font-bold transition-colors',
                speed === s
                  ? 'bg-accent-dim text-accent'
                  : 'text-wccf-mute hover:text-wccf-ink',
              )}
            >
              {s}×
            </button>
          ))}
        </div>
        {/* match progress */}
        <div className="h-[4px] min-w-0 flex-1 overflow-hidden rounded-full bg-inset">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-wccf-mute">
          {done ? 'FT' : paused ? 'Paused' : `${speed}× speed`}
        </span>
      </div>
    </motion.div>
  )
}
