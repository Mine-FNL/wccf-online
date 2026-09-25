import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RECORD_LABELS, type DemoRecordRow } from './demoData'

/** Count-up tween for gold record values on tab entry (hall-of-fame.md §3). */
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  return value
}

const standingSince = (d: Date | string) => {
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function RecordCard({
  row,
  index,
  flashing,
}: {
  row: DemoRecordRow
  index: number
  flashing: boolean
}) {
  const value = useCountUp(row.value)
  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: 'easeOut' }}
      className={cn(
        'relative overflow-hidden rounded-panel border bg-panel p-4 transition-colors duration-700',
        flashing ? 'border-wccf-gold bg-[rgba(232,184,75,0.14)]' : 'border-line',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-sans text-[12px] font-bold uppercase tracking-[0.08em] text-wccf-dim">
          {RECORD_LABELS[row.category] ?? row.category}
        </div>
        <Trophy size={16} className={flashing ? 'text-wccf-gold' : 'text-wccf-mute'} />
      </div>

      <div className="mt-3 font-mono text-[26px] font-bold leading-none text-wccf-gold tnum">
        {value}
      </div>

      <div className="mt-2 truncate font-display text-xl font-semibold uppercase tracking-[0.04em] text-accent">
        {row.holderClubName}
      </div>
      {row.detail && <div className="mt-0.5 truncate text-[13px] text-wccf-dim">{row.detail}</div>}
      <div className="mt-2 font-mono text-[11px] text-wccf-mute">
        standing since {standingSince(row.createdAt)}
      </div>

      {/* live-break flash overlay, decays over ~2s */}
      {flashing && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          initial={{ backgroundColor: 'rgba(232,184,75,0.35)' }}
          animate={{ backgroundColor: 'rgba(232,184,75,0)' }}
          transition={{ duration: 2, ease: 'easeOut' }}
        />
      )}
    </motion.div>
  )
}

/**
 * Record Book — current holder per category in a 2-col grid ≥900px.
 * Cards flash gold when the live ticker reports that record being broken.
 */
export default function RecordBook({
  rows,
  flashingCategories,
}: {
  rows: DemoRecordRow[]
  flashingCategories: ReadonlySet<string>
}) {
  return (
    <div className="grid gap-3 min-[900px]:grid-cols-2">
      {rows.map((r, i) => (
        <RecordCard key={r.category} row={r} index={i} flashing={flashingCategories.has(r.category)} />
      ))}
    </div>
  )
}
