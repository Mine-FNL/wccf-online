import { useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeftRight, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TapeEvent } from './tape'
import { commentaryLine, eventSide, fmtClock, normKind } from './tape'

const POP = {
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
}

/**
 * Event-timeline scrubber — a 0→90'+ minute track with a marker per match
 * event. Clicking anywhere on the track (or a marker) seeks the playhead.
 * Hovering a marker shows a tooltip with the minute + commentary text.
 */
export default function TimelineScrubber({
  events,
  t,
  end,
  homeName,
  awayName,
  homeColor,
  awayColor,
  onSeek,
}: {
  events: TapeEvent[]
  /** playhead minute (float) */
  t: number
  /** end of tape in minutes (>= 90) */
  end: number
  homeName: string
  awayName: string
  homeColor: string
  awayColor: string
  onSeek: (min: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      onSeek(frac * end)
    },
    [end, onSeek],
  )

  const pct = (min: number) => `${Math.min(100, Math.max(0, (min / end) * 100))}%`

  return (
    <div className="select-none">
      <div
        ref={trackRef}
        role="slider"
        aria-label="Replay timeline"
        aria-valuemin={0}
        aria-valuemax={end}
        aria-valuenow={Math.round(t)}
        tabIndex={0}
        onClick={(e) => seekFromClientX(e.clientX)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') onSeek(Math.max(0, t - 1))
          if (e.key === 'ArrowRight') onSeek(Math.min(end, t + 1))
        }}
        className="relative h-12 cursor-pointer rounded-card border border-line bg-inset px-0 outline-none focus-visible:border-line-strong"
      >
        {/* base track */}
        <div className="absolute inset-x-3 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-raised" />
        {/* elapsed fill */}
        <div
          className="absolute left-3 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-accent/70"
          style={{ width: `calc((100% - 24px) * ${Math.min(1, t / end)})` }}
        />

        {/* event markers */}
        {events.map((ev, i) => {
          const kind = normKind(ev.type)
          const side = eventSide(ev, awayName)
          const line = commentaryLine(ev, homeName, awayName)
          const passed = ev.min <= t
          const left = `calc(12px + (100% - 24px) * ${Math.min(1, ev.min / end)})`
          const key = `${i}-${ev.min}-${ev.type}`

          /* phase lines (ht / ft) — full-height white notches */
          if (kind === 'ht' || kind === 'ft') {
            return (
              <div key={key} className="group absolute top-0 h-full" style={{ left }}>
                <div className={cn('h-full w-px', kind === 'ft' ? 'bg-white/70' : 'bg-white/40')} />
                <span className="absolute left-1/2 top-[2px] -translate-x-1/2 font-mono text-[8px] font-bold text-white/70">
                  {kind.toUpperCase()}
                </span>
                <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden w-44 -translate-x-1/2 rounded-card border border-line bg-panel px-2.5 py-2 shadow-modal group-hover:block">
                  <span className="font-mono text-[10px] font-bold text-accent">{fmtClock(ev.min)}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-wccf-dim">{line}</span>
                </span>
              </div>
            )
          }

          return (
            <motion.div
              key={key}
              {...POP}
              transition={{ delay: 0.05 + i * 0.02, type: 'spring', stiffness: 500, damping: 26 }}
              className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left }}
            >
              <button
                aria-label={`${fmtClock(ev.min)} — ${line}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onSeek(ev.min)
                }}
                className="flex h-6 w-6 items-center justify-center"
              >
                {kind === 'goal' && (
                  <span
                    className={cn(
                      'h-[10px] w-[10px] rounded-full border border-black/50 transition-opacity',
                      !passed && 'opacity-45',
                    )}
                    style={{
                      backgroundColor: side === 'away' ? awayColor : homeColor,
                      boxShadow: `0 0 8px ${side === 'away' ? awayColor : homeColor}66`,
                    }}
                  />
                )}
                {kind === 'booking' && (
                  <span className={cn('h-[11px] w-[4px] rounded-[1px] bg-wccf-caution', !passed && 'opacity-45')} />
                )}
                {kind === 'red' && (
                  <span className={cn('h-[11px] w-[4px] rounded-[1px] bg-wccf-danger', !passed && 'opacity-45')} />
                )}
                {kind === 'sub' && (
                  <ArrowLeftRight size={11} className={cn('text-[#4DD0E1]', !passed && 'opacity-45')} />
                )}
                {kind === 'kp' && (
                  <Star size={10} className={cn('text-wccf-gold', !passed && 'opacity-45')} fill="currentColor" />
                )}
                {(kind === 'chance' || kind === 'miss' || kind === 'kickoff' || kind === 'info') && (
                  <span className={cn('h-[5px] w-[5px] rounded-full bg-wccf-mute', !passed && 'opacity-40')} />
                )}
              </button>
              {/* tooltip */}
              <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 hidden w-44 -translate-x-1/2 rounded-card border border-line bg-panel px-2.5 py-2 shadow-modal group-hover:block">
                <span className="font-mono text-[10px] font-bold text-accent">{fmtClock(ev.min)}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-wccf-dim">{line}</span>
              </span>
            </motion.div>
          )
        })}

        {/* playhead */}
        <div
          className="pointer-events-none absolute top-0 h-full"
          style={{ left: `calc(12px + (100% - 24px) * ${Math.min(1, t / end)})` }}
        >
          <div className="absolute top-0 h-full w-[2px] -translate-x-1/2 bg-accent" />
          <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-inset" />
        </div>

        {/* minute ruler */}
        {[0, 15, 30, 45, 60, 75, 90].map((m) => (
          <span
            key={m}
            className="pointer-events-none absolute bottom-[3px] -translate-x-1/2 font-mono text-[8px] text-wccf-mute tnum"
            style={{ left: pct(m) }}
          >
            {m}&prime;
          </span>
        ))}
      </div>
    </div>
  )
}
