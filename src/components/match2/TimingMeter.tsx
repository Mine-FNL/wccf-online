/**
 * TimingMeter — the SHOOT/GK timing bar of the original cabinet (spec §3.4).
 *
 * When the engine opens a chance window for the human side a marker sweeps
 * across the bar (~2.4 sweeps per 2.5 s window); a bright sweet-spot zone
 * sits dead center. The console signals a press (button or key) and the
 * meter captures quality = 1 - |marker - center| / halfWidth, then fires
 * the shoot/keeper command through `onFire`. Holding the GK button ≥0.8 s
 * sends rush=true (keeper rushes out — high risk/reward).
 *
 * Resolution flash: PERFECT ≥0.85 · GOOD ≥0.55 · POOR ≥0.25 · WHIFF <0.25.
 * Window expiry without a press = engine baselines it (no flash).
 */
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ChanceWindow } from '@/lib/engine2'

/** sweeps across the bar per window (0→1→0… in window real time) */
const SWEEPS = 2.4
const FLASH_MS = 1200

const tri = (v: number) => {
  const t = v % 2
  return t < 1 ? t : 2 - t
}

export function qualityTierLabel(q: number): 'PERFECT' | 'GOOD' | 'POOR' | 'WHIFF' {
  return q >= 0.85 ? 'PERFECT' : q >= 0.55 ? 'GOOD' : q >= 0.25 ? 'POOR' : 'WHIFF'
}

const TIER_COLOR: Record<string, string> = {
  PERFECT: 'text-wccf-gold',
  GOOD: 'text-wccf-live',
  POOR: 'text-wccf-caution',
  WHIFF: 'text-wccf-danger',
}

/** Signal the console bumps when SHOOT / GK / A is pressed. */
export interface PressSignal {
  seq: number
  /** ms the button was held (≥800 on defense = keeper rush) */
  heldMs: number
}

export default function TimingMeter({
  win,
  mode,
  pressSignal,
  onFire,
}: {
  /** live engine window (null when closed) */
  win: ChanceWindow | null
  /** human perspective: attack = SHOOT meter, defense = GK meter */
  mode: 'attack' | 'defense' | null
  pressSignal: PressSignal | null
  /** capture → fire the engine command */
  onFire: (quality: number, rush: boolean) => void
}) {
  const [marker, setMarker] = useState(0.5)
  const [flash, setFlash] = useState<{ label: string; id: number } | null>(null)
  const markerRef = useRef(0.5)
  const openedAtRef = useRef(0)
  const handledSeqRef = useRef(0)
  const winKeyRef = useRef<string | null>(null)
  const flashTimerRef = useRef<number | null>(null)

  const open = !!win && !!mode

  /* marker sweep — rAF while the window is open */
  useEffect(() => {
    if (!open || !win) return
    const key = `${win.opensAt}:${win.side}:${win.shooter}`
    if (winKeyRef.current !== key) {
      winKeyRef.current = key
      openedAtRef.current = performance.now()
      markerRef.current = 0
      setMarker(0)
    }
    let raf = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const elapsed = (now - openedAtRef.current) / 1000
      const pos = tri((elapsed / win.durationReal) * SWEEPS)
      markerRef.current = pos
      setMarker(pos)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [open, win])

  /* capture on console press */
  useEffect(() => {
    if (!pressSignal || pressSignal.seq === handledSeqRef.current) return
    handledSeqRef.current = pressSignal.seq
    if (!open || !win || !mode) return
    if (mode === 'attack' && win.attackQuality != null) return
    if (mode === 'defense' && win.keeperQuality != null) return
    const q = Math.max(0, Math.min(1, 1 - Math.abs(markerRef.current - 0.5) / 0.5))
    const rush = mode === 'defense' && pressSignal.heldMs >= 800
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current)
    setFlash({ label: rush ? `RUSH ${qualityTierLabel(q)}` : qualityTierLabel(q), id: pressSignal.seq })
    flashTimerRef.current = window.setTimeout(() => setFlash(null), FLASH_MS)
    onFire(q, rush)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pressSignal])

  /* reset when the window closes */
  useEffect(() => {
    if (!open) winKeyRef.current = null
  }, [open])

  useEffect(
    () => () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current)
    },
    [],
  )

  const accent = mode === 'defense' ? '#4DD0E1' : '#FF8A1E'
  const remain = win ? Math.max(0, win.remainReal / win.durationReal) : 0

  return (
    <div
      className={cn(
        'relative flex flex-col gap-1 rounded-panel border px-3 py-2 transition-colors duration-150',
        open ? 'border-line-strong bg-raised' : 'border-line bg-panel opacity-50',
      )}
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between font-mono text-[9px] font-bold uppercase tracking-[0.14em]">
        <span style={{ color: open ? accent : '#5C6678' }}>
          {open ? (mode === 'attack' ? 'Shoot meter' : 'GK meter') : 'Timing meter'}
        </span>
        <span className="text-wccf-mute">
          {open
            ? mode === 'attack'
              ? `${win?.shooter} through on goal`
              : `${win?.shooter} bears down — ${win?.keeper} guards`
            : 'wait for a chance window'}
        </span>
      </div>

      {/* the bar */}
      <div className="relative h-4 overflow-hidden rounded-[4px] bg-inset">
        {/* sweet-spot zone */}
        <div
          className="absolute inset-y-0 left-1/2 -translate-x-1/2"
          style={{
            width: '30%',
            backgroundColor: open ? `${accent}22` : 'transparent',
            borderLeft: `1px solid ${open ? `${accent}55` : 'transparent'}`,
            borderRight: `1px solid ${open ? `${accent}55` : 'transparent'}`,
          }}
        />
        {/* perfect core */}
        <div
          className="absolute inset-y-0 left-1/2 -translate-x-1/2"
          style={{ width: '8%', backgroundColor: open ? `${accent}33` : 'transparent' }}
        />
        {/* sweeping marker */}
        {open && (
          <div
            className="absolute inset-y-0 w-[3px] rounded-full"
            style={{
              left: `calc(${marker * 100}% - 1px)`,
              backgroundColor: accent,
              boxShadow: `0 0 8px ${accent}`,
            }}
          />
        )}
        {/* resolution flash */}
        <AnimatePresence>
          {flash && (
            <motion.div
              key={flash.id}
              initial={{ opacity: 0, scale: 1.3 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 flex items-center justify-center bg-[rgba(4,6,10,0.72)]"
            >
              <span
                className={cn(
                  'font-display text-sm font-bold uppercase tracking-[0.2em]',
                  TIER_COLOR[flash.label.replace('RUSH ', '')] ?? 'text-wccf-ink',
                )}
              >
                {flash.label}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* window time remaining */}
      <div className="h-[3px] overflow-hidden rounded-full bg-inset">
        <div
          className="h-full rounded-full transition-[width] duration-100 ease-linear"
          style={{ width: `${remain * 100}%`, backgroundColor: accent }}
        />
      </div>
    </div>
  )
}
