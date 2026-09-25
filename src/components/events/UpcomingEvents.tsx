import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import StatusPill from '@/components/StatusPill'
import { cn } from '@/lib/utils'
import { fmtDay, fmtTime, type UpcomingEvent } from './data'

/**
 * Upcoming events list — rows slide up staggered 90ms on scroll; hover zooms
 * the thumbnail and slides in an accent left bar (events.md §2).
 */
export default function UpcomingEvents({
  events,
  registered,
  onEnter,
}: {
  events: UpcomingEvent[]
  registered: ReadonlySet<string>
  onEnter: (ev: UpcomingEvent) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {events.map((ev, i) => {
        const isRegistered = registered.has(ev.id)
        const full = ev.status === 'full'
        return (
          <motion.div
            key={ev.id}
            initial={{ y: 16, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ delay: i * 0.09, duration: 0.35, ease: 'easeOut' }}
            className="group relative flex flex-col gap-4 overflow-hidden rounded-panel border border-line bg-panel p-5 transition-colors hover:border-line-strong min-[900px]:flex-row min-[900px]:items-center"
          >
            {/* accent border-left slide-in on hover */}
            <span className="absolute bottom-0 left-0 top-0 w-[3px] origin-bottom scale-y-0 bg-accent transition-transform duration-200 group-hover:scale-y-100" />

            {/* banner thumb */}
            <div className="h-[120px] w-full shrink-0 overflow-hidden rounded-card border border-line min-[900px]:h-[92px] min-[900px]:w-[220px]">
              <img
                src={ev.banner}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>

            {/* middle */}
            <div className="min-w-0 flex-1">
              <div className="font-display text-2xl font-semibold uppercase tracking-[0.04em] text-wccf-ink">
                {ev.name}
              </div>
              <div className="mt-1 font-mono text-[12px] text-wccf-mute tnum">
                {fmtDay(ev.start)} {fmtTime(ev.start)} → {fmtDay(ev.end)} {fmtTime(ev.end)} ·{' '}
                {ev.host} · {ev.seats} seats · {ev.entry}
              </div>
              <p className="mt-1.5 text-[14px] text-wccf-dim">{ev.description}</p>
            </div>

            {/* right: status + CTA */}
            <div className="flex shrink-0 flex-row items-center gap-3 min-[900px]:flex-col min-[900px]:items-end">
              <StatusPill variant={ev.status} pulse={ev.status === 'open'}>
                {ev.statusLabel}
              </StatusPill>
              {isRegistered ? (
                <span className="flex items-center gap-1.5 rounded-btn border border-[rgba(61,214,140,0.4)] bg-[rgba(61,214,140,0.1)] px-4 py-2 font-sans text-[12px] font-bold uppercase tracking-[0.06em] text-wccf-live">
                  <Check size={13} />
                  Registered
                </span>
              ) : (
                <button
                  disabled={full}
                  onClick={() => onEnter(ev)}
                  className={cn(
                    'rounded-btn px-4 py-2 font-sans text-[12px] font-bold uppercase tracking-[0.06em] transition-all duration-150 active:scale-[0.97]',
                    full
                      ? 'cursor-not-allowed border border-line text-wccf-mute'
                      : 'bg-accent text-[#0B0E14] hover:bg-accent-hover',
                  )}
                >
                  {full ? 'Full' : 'Enter'}
                </button>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
