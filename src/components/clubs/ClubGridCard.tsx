import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { DisplayClub } from './displayClub'

/**
 * Directory club card — crest, name, kit-colored shortName chip,
 * mono stats row, status line. Sims carry a dashed "House club" frame.
 */
export default function ClubGridCard({
  club,
  index,
  onClick,
}: {
  club: DisplayClub
  index: number
  onClick: () => void
}) {
  return (
    <motion.button
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: Math.min(index, 10) * 0.05 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={cn(
        'w-full rounded-panel border bg-panel p-4 text-left transition-colors',
        club.kind === 'sim'
          ? 'border-dashed border-line hover:border-line-strong'
          : 'border-line hover:border-accent/60',
      )}
    >
      <div className="flex items-center gap-3">
        <img src={club.avatar} alt="" className="h-11 w-11 rounded-card border border-line object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-[20px] font-semibold uppercase leading-tight tracking-[0.03em] text-wccf-ink transition-colors">
              {club.name}
            </span>
            <span
              className="shrink-0 rounded px-1.5 py-[1px] font-mono text-[10px] font-bold uppercase"
              style={{ backgroundColor: `${club.kitPrimary}22`, color: club.kitPrimary }}
            >
              {club.shortName}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[12px] text-wccf-mute">
            {club.manager ? `@${club.manager.toLowerCase().replace(/\s+/g, '.')}` : 'Registered manager'}
            {club.kind === 'sim' && ' · house club'}
          </p>
        </div>
        {club.online && (
          <span className="relative flex h-2 w-2 shrink-0" title="In lobby">
            <span className="absolute h-full w-full rounded-full bg-wccf-live animate-pulse-halo" />
            <span className="relative h-2 w-2 rounded-full bg-wccf-live animate-pulse-dot" />
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 font-mono text-[11px] tnum">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-wccf-mute">Rating</p>
          <p className="mt-0.5 text-[13px] font-bold text-accent">{club.rating}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-wccf-mute">W–D–L</p>
          <p className="mt-0.5 text-[13px] text-wccf-ink">
            {club.wins}-{club.draws}-{club.losses}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-wccf-mute">Goals</p>
          <p className="mt-0.5 text-[13px] text-wccf-ink">
            {club.goalsFor}:{club.goalsAgainst}
          </p>
        </div>
      </div>
    </motion.button>
  )
}
