import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface ScoreBugProps {
  homeShort: string
  awayShort: string
  homeColor: string
  awayColor: string
  homeScore: number
  awayScore: number
  /** "67:24" */
  clock: string
  /** 1 | 2 — renders 1H/2H, hidden at FT when `phase === 'fulltime'` */
  half: 1 | 2
  phase?: 'pre' | 'playing' | 'halftime' | 'fulltime'
  className?: string
}

/**
 * Broadcast-style score bug, fixed top-left of every match viewport.
 * Score digits pop (scale spring) whenever they change.
 */
export default function ScoreBug({
  homeShort,
  awayShort,
  homeColor,
  awayColor,
  homeScore,
  awayScore,
  clock,
  half,
  phase = 'playing',
  className,
}: ScoreBugProps) {
  return (
    <div
      className={cn(
        'pointer-events-none inline-flex items-stretch overflow-hidden rounded-md border border-line bg-[rgba(8,10,15,0.88)] backdrop-blur-sm',
        'font-mono text-[13px] font-bold text-wccf-ink shadow-modal',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 px-2 py-1">
        <span
          className="h-2 w-2 rounded-[2px]"
          style={{ backgroundColor: homeColor }}
        />
        <span className="tracking-wide">{homeShort}</span>
      </div>
      <div className="flex items-center gap-1 bg-raised px-2 py-1 tnum">
        <motion.span
          key={`h-${homeScore}`}
          initial={{ scale: 1.35 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
        >
          {homeScore}
        </motion.span>
        <span className="text-wccf-mute">—</span>
        <motion.span
          key={`a-${awayScore}`}
          initial={{ scale: 1.35 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
        >
          {awayScore}
        </motion.span>
      </div>
      <div className="flex items-center gap-1.5 px-2 py-1">
        <span
          className="h-2 w-2 rounded-[2px]"
          style={{ backgroundColor: awayColor }}
        />
        <span className="tracking-wide">{awayShort}</span>
      </div>
      <div className="flex items-center gap-1.5 border-l border-line bg-[rgba(255,138,30,0.1)] px-2 py-1 tnum">
        {phase === 'fulltime' ? (
          <span className="text-wccf-accent">FT</span>
        ) : phase === 'halftime' ? (
          <span className="text-wccf-accent">HT</span>
        ) : (
          <>
            <span>{clock}</span>
            <span className="text-[10px] text-wccf-accent">{half}H</span>
          </>
        )}
      </div>
    </div>
  )
}
