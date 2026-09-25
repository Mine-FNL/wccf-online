import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Maximize2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import ScoreBug from './ScoreBug'
import StatusPill from './StatusPill'
import {
  pitchDots,
  stateAt,
  type MatchState,
  type MatchTimeline,
  type PitchDot,
  type SquadStrength,
} from '@/lib/engine'

/* ------------------------------------------------------------------ */
/* Team-form hexagon radar (formation / practice / performance zones)  */
/* ------------------------------------------------------------------ */

const FORM_AXES = ['ATT', 'MID', 'DEF', 'GK', 'STA', 'OVR'] as const

function strengthSeries(s: SquadStrength): number[] {
  return [s.attack, s.midfield, s.defense, s.keeper, s.stamina, s.overall].map(
    (v) => v / 100,
  )
}

export function TeamFormRadar({
  strength,
  size = 120,
  seedShift = 0,
}: {
  strength: SquadStrength
  size?: number
  /** deterministic per-team variation for the formation/practice zones */
  seedShift?: number
}) {
  const perf = strengthSeries(strength)
  const formation = perf.map((v, i) =>
    Math.min(1, Math.max(0.12, v + Math.sin(seedShift + i * 2.1) * 0.1)),
  )
  const practice = perf.map((v, i) =>
    Math.min(1, Math.max(0.1, v + Math.cos(seedShift + i * 1.7) * 0.16)),
  )
  const cx = size / 2
  const cy = size / 2
  const R = size / 2 - 12
  const pt = (i: number, v: number) => {
    const a = (Math.PI / 3) * i - Math.PI / 2
    return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v] as const
  }
  const poly = (vs: number[]) => vs.map((v, i) => pt(i, Math.max(0.08, v)).join(',')).join(' ')
  const ring = (f: number) => Array.from({ length: 6 }, (_, i) => pt(i, f).join(',')).join(' ')
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[1, 0.66, 0.33].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="#8A94A7" strokeOpacity={0.18} strokeWidth={1} />
      ))}
      {perf.map((_, i) => {
        const [x, y] = pt(i, 1)
        const [lx, ly] = pt(i, 1.24)
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="#8A94A7" strokeOpacity={0.14} strokeWidth={1} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={8}
              fontFamily="'JetBrains Mono', monospace" fill="#8A94A7">
              {FORM_AXES[i]}
            </text>
          </g>
        )
      })}
      <polygon points={poly(formation)} fill="none" stroke="#3DD68C" strokeOpacity={0.7} strokeWidth={1.2} strokeDasharray="3 2" />
      <polygon points={poly(practice)} fill="none" stroke="#FFC531" strokeOpacity={0.8} strokeWidth={1.2} />
      <polygon points={poly(perf)} fill="#3DD68C" fillOpacity={0.25} stroke="#3DD68C" strokeWidth={1.5} />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Per-player rows in the drawer                                        */
/* ------------------------------------------------------------------ */

function PlayerRow({ p, align }: { p: MatchState['homeXI'][number]; align: 'left' | 'right' }) {
  const staminaColor =
    p.stamina > 55 ? '#3DD68C' : p.stamina > 28 ? '#FFC531' : '#FF4D4F'
  return (
    <div className={cn('flex items-center gap-1.5', align === 'right' && 'flex-row-reverse')}>
      <span className="w-5 shrink-0 text-center font-mono text-[9px] text-wccf-mute tnum">{p.number}</span>
      <div className={cn('min-w-0 flex-1', align === 'right' && 'text-right')}>
        <div className="flex items-center gap-1" style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
          <span className="truncate text-[10.5px] font-medium text-wccf-ink">{p.name}</span>
          {p.card === 'yellow' && <span className="h-2 w-[5px] shrink-0 rounded-[1px] bg-wccf-caution" />}
          {p.card === 'red' && <span className="h-2 w-[5px] shrink-0 rounded-[1px] bg-wccf-danger" />}
          {p.subbedOn && <span className="shrink-0 font-mono text-[8px] text-wccf-live">▲{p.subMinute}'</span>}
        </div>
        <div className="mt-[3px] flex items-center gap-1" style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
          <div className="h-[3px] w-1/2 overflow-hidden rounded-full bg-inset">
            <div className="h-full rounded-full bg-accent transition-all [transition-duration:600ms]" style={{ width: `${p.strength}%` }} />
          </div>
          <div className="h-[3px] w-1/2 overflow-hidden rounded-full bg-inset">
            <div className="h-full rounded-full transition-all [transition-duration:600ms]" style={{ width: `${p.stamina}%`, backgroundColor: staminaColor }} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Pitch layer (rAF, dots interpolate between 1 Hz engine states)      */
/* ------------------------------------------------------------------ */

const PitchLayer = memo(function PitchLayer({
  timeline,
  clockRef,
  initialClock,
  homeColor,
  awayColor,
}: {
  timeline: MatchTimeline
  clockRef: React.MutableRefObject<number>
  initialClock: number
  homeColor: string
  awayColor: string
}) {
  const [dots, setDots] = useState<PitchDot[]>(() =>
    pitchDots(timeline, initialClock),
  )

  useEffect(() => {
    let last = 0
    let raf = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - last < 100) return // ~10 fps dot updates; CSS transitions smooth the rest
      last = now
      setDots(pitchDots(timeline, clockRef.current))
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [timeline, clockRef])

  return (
    <div className="absolute inset-0">
      <img
        src="/pitch-texture.svg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-90"
        draggable={false}
      />
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            width: d.side === 'ball' ? 5 : 7,
            height: d.side === 'ball' ? 5 : 7,
            left: `${d.x * 100}%`,
            top: `${d.y * 100}%`,
            transform: 'translate(-50%, -50%)',
            backgroundColor:
              d.side === 'ball' ? '#E8ECF4' : d.side === 'home' ? homeColor : awayColor,
            boxShadow:
              d.side === 'ball'
                ? '0 0 4px rgba(232,236,244,0.9)'
                : `0 0 5px ${d.side === 'home' ? homeColor : awayColor}88`,
            transition: 'left 600ms ease, top 600ms ease',
          }}
        />
      ))}
    </div>
  )
})

/* ------------------------------------------------------------------ */
/* MatchViewer                                                         */
/* ------------------------------------------------------------------ */

export interface MatchViewerProps {
  /** from createMatch() — memoized by the parent */
  timeline: MatchTimeline
  /** current match clock, seconds (parent ticks at 1 Hz; negative = pre-match) */
  clock: number
  /** show the red LIVE pill (top-right) */
  live?: boolean
  /** reconnecting sim overlay */
  connecting?: boolean
  /** e.g. "You're watching from Seat 3" */
  seatContext?: string
  className?: string
}

/**
 * 16:9 broadcast viewport rendering from match-engine state:
 * top-down pitch with dot-players + ball, ScoreBug, LIVE pill, commentary
 * line, hover controls bar, and an expandable drawer with team-form radar
 * and both XIs' strength/stamina gauges.
 */
export default function MatchViewer({
  timeline,
  clock,
  live = true,
  connecting = false,
  seatContext,
  className,
}: MatchViewerProps) {
  const [drawer, setDrawer] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  /* fractional clock for smooth dot motion between 1 Hz ticks */
  const clockRef = useRef(clock)
  useEffect(() => {
    const from = clockRef.current
    const to = clock
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const f = Math.min(1, (now - start) / 1000)
      clockRef.current = from + (to - from) * f
      if (f < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [clock])

  const state = useMemo(() => stateAt(timeline, clock), [timeline, clock])

  /* edge flash + commentary chip on goal */
  const goalCount = state.score.home + state.score.away
  const isGoalHeadline = state.headline?.kind === 'goal'

  const fullscreen = () => {
    const el = wrapRef.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen?.()
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div
        ref={wrapRef}
        className="group relative aspect-video w-full overflow-hidden rounded-card border border-line bg-inset"
      >
        {connecting ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-inset">
            <span className="font-mono text-xs text-wccf-dim">🏁 Live match — connecting…</span>
            <div className="h-[2px] w-40 overflow-hidden rounded-full bg-raised">
              <div className="h-full w-1/4 rounded-full bg-accent animate-loading-bar" />
            </div>
          </div>
        ) : (
          <>
            <PitchLayer
              timeline={timeline}
              clockRef={clockRef}
              initialClock={clock}
              homeColor={timeline.home.color}
              awayColor={timeline.away.color}
            />
            {/* goal edge flash */}
            <div key={`flash-${goalCount}`} className={cn('pointer-events-none absolute inset-0 rounded-card', goalCount > 0 && 'animate-edge-flash')} />

            <div className="absolute left-2 top-2">
              <ScoreBug
                homeShort={timeline.home.short}
                awayShort={timeline.away.short}
                homeColor={timeline.home.color}
                awayColor={timeline.away.color}
                homeScore={state.score.home}
                awayScore={state.score.away}
                clock={state.displayClock}
                half={state.half}
                phase={state.phase}
              />
            </div>
            {live && state.phase !== 'fulltime' && (
              <div className="absolute right-2 top-2">
                <StatusPill variant="live" pulse />
              </div>
            )}
            {state.phase === 'fulltime' && (
              <div className="absolute right-2 top-2">
                <StatusPill variant="full">FULL TIME</StatusPill>
              </div>
            )}

            {/* bottom commentary line */}
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-[rgba(4,6,10,0.9)] to-transparent px-2.5 pb-1.5 pt-6">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={state.headline?.t ?? 'none'}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -8, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className={cn(
                    'truncate rounded px-1.5 py-0.5 font-mono text-[11px] tnum',
                    isGoalHeadline
                      ? 'bg-accent-dim text-accent'
                      : 'text-wccf-dim',
                  )}
                >
                  ▸ {state.headline?.text ?? 'Waiting for kick-off…'}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* hover controls bar */}
            <div className="absolute inset-x-0 top-8 flex items-center justify-end gap-2 px-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <span className="rounded bg-[rgba(8,10,15,0.85)] px-1.5 py-[3px] font-mono text-[9px] font-bold tracking-wider text-wccf-ink">
                HD
              </span>
              <button
                className="flex items-center gap-1 rounded bg-[rgba(8,10,15,0.85)] px-1.5 py-[3px] font-mono text-[9px] text-wccf-dim hover:text-wccf-ink"
                title="Sound (demo cabinets are muted)"
              >
                <VolumeX size={11} /> Tap for sound
              </button>
              <button
                onClick={fullscreen}
                aria-label="Fullscreen"
                className="rounded bg-[rgba(8,10,15,0.85)] p-1 text-wccf-dim hover:text-wccf-ink"
              >
                <Maximize2 size={12} />
              </button>
            </div>
            {seatContext && (
              <div className="absolute bottom-7 right-2 rounded bg-[rgba(8,10,15,0.8)] px-1.5 py-[2px] font-mono text-[9px] text-wccf-mute opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {seatContext}
              </div>
            )}
          </>
        )}
      </div>

      {/* drawer chevron */}
      <button
        onClick={() => setDrawer((d) => !d)}
        aria-expanded={drawer}
        className="mx-auto mt-1 flex items-center gap-1 rounded-btn px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-wccf-mute transition-colors hover:text-wccf-ink"
      >
        Match data
        <motion.span animate={{ rotate: drawer ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown size={12} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {drawer && (
          <motion.div
            key="drawer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-1 rounded-card border border-line bg-panel p-3">
              <div className="flex items-start justify-around gap-2">
                {(['home', 'away'] as const).map((side) => {
                  const t = side === 'home' ? timeline.home : timeline.away
                  const s = side === 'home' ? state.strengthHome : state.strengthAway
                  return (
                    <div key={side} className="flex flex-col items-center gap-1">
                      <span className="font-mono text-[10px] font-bold tracking-wider" style={{ color: t.color }}>
                        {t.short}
                      </span>
                      <TeamFormRadar strength={s} size={110} seedShift={side === 'home' ? 1.3 : 4.7} />
                    </div>
                  )
                })}
              </div>
              <div className="mt-1 flex items-center justify-center gap-3 font-mono text-[8.5px] text-wccf-mute">
                <span className="flex items-center gap-1"><i className="inline-block h-[2px] w-3 border-t border-dashed border-wccf-live" />formation</span>
                <span className="flex items-center gap-1"><i className="inline-block h-[2px] w-3 bg-wccf-caution" />practice</span>
                <span className="flex items-center gap-1"><i className="inline-block h-2 w-3 rounded-[2px] bg-[rgba(61,214,140,0.35)]" />performance</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div className="flex flex-col gap-1.5">
                  {state.homeXI.map((p, i) => <PlayerRow key={`h${i}`} p={p} align="left" />)}
                </div>
                <div className="flex flex-col gap-1.5">
                  {state.awayXI.map((p, i) => <PlayerRow key={`a${i}`} p={p} align="right" />)}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
