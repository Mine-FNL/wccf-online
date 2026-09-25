import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import StatusPill from './StatusPill'

export interface SeatTileProps {
  seatNumber: number
  /** occupant club name, or null for an open seat */
  occupant: string | null
  /** occupant is currently in a live match */
  playing?: boolean
  onTakeSeat?: (seatNumber: number) => void
  className?: string
}

/**
 * One cabinet seat (8 per cabinet). OPEN tiles morph to "TAKE SEAT →"
 * on hover and fire onTakeSeat on click (confirm modal lives in the parent).
 */
export default function SeatTile({
  seatNumber,
  occupant,
  playing = false,
  onTakeSeat,
  className,
}: SeatTileProps) {
  const [hover, setHover] = useState(false)
  const open = occupant === null

  return (
    <button
      type="button"
      disabled={!open}
      onClick={() => open && onTakeSeat?.(seatNumber)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        'group flex flex-col gap-1.5 rounded-card border border-line bg-raised p-2 text-left transition-colors duration-150',
        open && 'cursor-pointer hover:border-accent',
        !open && 'cursor-default',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-wccf-mute">
          Seat {seatNumber}
        </span>
        {open ? (
          <StatusPill variant="open" />
        ) : playing ? (
          <StatusPill variant="playing" pulse />
        ) : (
          <StatusPill variant="queued" />
        )}
      </div>
      <div className="relative h-[18px] overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {open && hover ? (
            <motion.span
              key="take"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 text-[13px] font-semibold text-accent"
            >
              TAKE SEAT →
            </motion.span>
          ) : (
            <motion.span
              key="label"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'absolute inset-0 truncate text-[13px] font-semibold',
                open ? 'text-wccf-mute' : 'text-wccf-ink',
              )}
            >
              {occupant ?? '—'}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </button>
  )
}
