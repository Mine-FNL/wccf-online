import { Trophy } from 'lucide-react'
import type { PastResult } from './data'

/**
 * Past results strip — horizontal auto-scrolling marquee (60s loop, pause
 * on hover) of past-event champion chips (events.md §4).
 */
export default function PastResultsStrip({ results }: { results: PastResult[] }) {
  const items = [...results, ...results]
  return (
    <div className="overflow-hidden rounded-panel border border-line bg-panel py-3">
      <div
        className="marquee-track flex w-max items-center gap-3 px-4 animate-marquee"
        style={{ animationDuration: '60s' }}
      >
        {items.map((r, i) => (
          <span
            key={i}
            className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-raised px-3 py-1.5"
          >
            <Trophy size={12} className="text-wccf-gold" />
            <span className="whitespace-nowrap font-mono text-[12px] text-wccf-dim">
              {r.event}
            </span>
            <img src={r.avatar} alt="" className="h-4 w-4 rounded-full object-cover" />
            <span className="whitespace-nowrap font-mono text-[12px] font-bold text-wccf-ink">
              {r.winner}
            </span>
            <span className="whitespace-nowrap font-mono text-[11px] text-wccf-mute">{r.date}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
