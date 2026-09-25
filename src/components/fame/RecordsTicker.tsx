import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { RECORD_LABELS, type DemoRecordRow } from './demoData'

/**
 * Slim records-only marquee strip under the Hall of Fame header —
 * gold-left-border cards, 20s loop, pauses on hover. Fresh rows (first seen
 * after mount via the 10s poll) get a gold flash that decays over ~2s
 * (design.md §5, hall-of-fame.md §1).
 */
export default function RecordsTicker({
  rows,
  freshIds,
}: {
  rows: DemoRecordRow[]
  freshIds: ReadonlySet<number>
}) {
  if (rows.length === 0) return null
  const items = [...rows, ...rows]
  return (
    <div className="overflow-hidden border-y border-line bg-panel">
      <div
        className="marquee-track flex w-max items-stretch gap-3 px-4 py-2 animate-marquee"
        style={{ animationDuration: '20s' }}
      >
        {items.map((r, i) => {
          const fresh = freshIds.has(r.id)
          const card = (
            <span
              className="flex shrink-0 items-center gap-2 rounded-card border border-line border-l-2 border-l-wccf-gold bg-raised px-3 py-1.5"
              key={i}
            >
              <Trophy size={12} className="shrink-0 text-wccf-gold" />
              <span className="whitespace-nowrap text-[12px] text-wccf-dim">
                New online record —{' '}
                <span className="font-semibold text-wccf-ink">{r.holderClubName}</span>:{' '}
                <span className="font-semibold text-wccf-gold">
                  {RECORD_LABELS[r.category] ?? r.category} {r.value}
                </span>
                {r.detail ? <span className="text-wccf-mute"> · {r.detail}</span> : null}
              </span>
            </span>
          )
          /* gold flash decay on fresh rows (framer-motion, transform-free) */
          return fresh ? (
            <motion.span
              key={i}
              initial={{ backgroundColor: 'rgba(232,184,75,0.35)' }}
              animate={{ backgroundColor: 'rgba(232,184,75,0)' }}
              transition={{ duration: 2, ease: 'easeOut' }}
              className="flex rounded-card"
            >
              {card}
            </motion.span>
          ) : (
            card
          )
        })}
      </div>
    </div>
  )
}
