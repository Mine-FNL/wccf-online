/**
 * TeamTalkModal — half-time team talk (spec §3.5, §4).
 *
 * Three talk cards (exact names/effects), each with its hexagon delta hint;
 * a 6 s countdown auto-picks "Stay calm, keep the ball" (index 1). Also
 * shows the 2012-13 flavor event line when the engine emitted one.
 */
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { TALKS } from './catalog'

const COUNTDOWN_S = 6
const AUTO_PICK: 0 | 1 | 2 = 1

export default function TeamTalkModal({
  homeShort,
  awayShort,
  score,
  flavorLine,
  onPick,
}: {
  homeShort: string
  awayShort: string
  score: { home: number; away: number }
  /** 2012-13 halftime flavor line (injury scare / argument / youngster) */
  flavorLine: string | null
  onPick: (choice: 0 | 1 | 2) => void
}) {
  const [picked, setPicked] = useState<0 | 1 | 2 | null>(null)
  const [remain, setRemain] = useState(COUNTDOWN_S)
  const startRef = useRef(performance.now())
  const firedRef = useRef(false)

  /* countdown → auto-pick index 1 just before the engine's own 6 s pick */
  useEffect(() => {
    const id = window.setInterval(() => {
      const elapsed = (performance.now() - startRef.current) / 1000
      setRemain(Math.max(0, COUNTDOWN_S - elapsed))
      if (elapsed >= COUNTDOWN_S - 0.25 && !firedRef.current) {
        firedRef.current = true
        setPicked((p) => p ?? AUTO_PICK)
        onPick(AUTO_PICK)
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [onPick])

  const pick = (choice: 0 | 1 | 2) => {
    if (firedRef.current) return
    firedRef.current = true
    setPicked(choice)
    onPick(choice)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-card bg-[rgba(4,6,10,0.88)] p-4 backdrop-blur-sm"
    >
      <span className="rounded-full bg-accent-dim px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
        Half-time — team talk
      </span>
      <div className="font-mono text-2xl font-bold text-wccf-ink tnum">
        {homeShort} {score.home} — {score.away} {awayShort}
      </div>
      {flavorLine && (
        <p className="max-w-md text-center text-[12px] italic text-wccf-dim">{flavorLine}</p>
      )}

      <div className="flex flex-wrap items-stretch justify-center gap-2">
        {TALKS.map((t, i) => (
          <button
            key={t.name}
            type="button"
            disabled={picked != null}
            onClick={() => pick(i as 0 | 1 | 2)}
            className={cn(
              'flex w-[180px] flex-col items-center gap-1.5 rounded-panel border px-3 py-3 text-center transition-colors',
              picked === i
                ? 'border-accent bg-accent-dim text-accent shadow-[0_0_14px_rgba(255,138,30,0.35)]'
                : picked != null
                  ? 'border-line bg-panel text-wccf-mute opacity-45'
                  : 'border-line-strong bg-raised text-wccf-ink hover:border-accent',
            )}
          >
            <span className="font-display text-[15px] font-bold uppercase leading-tight tracking-[0.04em]">
              “{t.name}”
            </span>
            <span className="rounded-[3px] bg-inset px-1.5 py-[2px] font-mono text-[9px] font-bold tracking-[0.08em] text-wccf-live">
              {t.hint}
            </span>
            <span className="font-mono text-[9px] leading-snug text-wccf-dim">{t.detail}</span>
          </button>
        ))}
      </div>

      {/* countdown */}
      <div className="flex w-56 flex-col items-center gap-1">
        <div className="h-[4px] w-full overflow-hidden rounded-full bg-inset">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-100 ease-linear"
            style={{ width: `${(remain / COUNTDOWN_S) * 100}%` }}
          />
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-wccf-mute">
          {picked != null
            ? 'Talk given — second half in a moment'
            : `Auto-pick “${TALKS[AUTO_PICK].name}” in ${remain.toFixed(1)}s`}
        </span>
      </div>
    </motion.div>
  )
}
