import { motion } from 'framer-motion'
import { Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TapeEvent } from './tape'
import { commentaryLine, fmtClock, normKind } from './tape'

/**
 * Commentary feed beneath/beside the stage — the events the playhead has
 * already passed, newest at top. The newest line is highlighted accent-dim;
 * the container keeps scroll pinned to the top so it auto-follows playback.
 */
export default function CommentaryFeed({
  passed,
  homeName,
  awayName,
  className,
}: {
  /** events with min <= playhead, any order */
  passed: TapeEvent[]
  homeName: string
  awayName: string
  className?: string
}) {
  const ordered = [...passed].sort((a, b) => b.min - a.min)

  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden rounded-card border border-line bg-panel', className)}>
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <Radio size={12} className="text-accent" />
        <span className="font-display text-sm font-semibold uppercase tracking-[0.06em] text-wccf-ink">
          Commentary
        </span>
        <span className="ml-auto font-mono text-[10px] text-wccf-mute tnum">
          {ordered.length} {ordered.length === 1 ? 'line' : 'lines'}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {ordered.length === 0 ? (
          <p className="px-3 py-4 font-mono text-[11px] text-wccf-mute">
            Tape cued — press play or drag the timeline.
          </p>
        ) : (
          <ul className="flex flex-col">
            {ordered.map((ev, i) => {
              const kind = normKind(ev.type)
              const current = i === 0
              return (
                <motion.li
                  key={`${i}-${ev.min}-${ev.type}`}
                  layout="position"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className={cn(
                    'flex items-start gap-2 border-b border-line/50 px-3 py-2',
                    current && 'bg-accent-dim',
                    kind === 'goal' && !current && 'bg-[rgba(61,214,140,0.05)]',
                  )}
                >
                  <span
                    className={cn(
                      'mt-px shrink-0 font-mono text-[10px] font-bold tnum',
                      current ? 'text-accent' : 'text-wccf-mute',
                    )}
                  >
                    {fmtClock(ev.min)}
                  </span>
                  <span
                    className={cn(
                      'text-[12px] leading-snug',
                      current ? 'text-wccf-ink' : 'text-wccf-dim',
                      kind === 'goal' && 'font-semibold text-wccf-ink',
                      kind === 'red' && 'text-wccf-danger',
                    )}
                  >
                    {commentaryLine(ev, homeName, awayName)}
                  </span>
                </motion.li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
