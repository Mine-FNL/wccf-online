import { motion } from 'framer-motion'
import { Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeaderRow } from './demoData'

const MEDAL = [
  { border: 'border-wccf-gold', text: 'text-wccf-gold', chip: 'border-wccf-gold/70' },
  { border: 'border-[#9AA5B1]', text: 'text-[#9AA5B1]', chip: 'border-[#9AA5B1]/70' },
  { border: 'border-[#B0793D]', text: 'text-[#B0793D]', chip: 'border-[#B0793D]/70' },
] as const

function PodiumCard({ row, place, delay }: { row: LeaderRow; place: 1 | 2 | 3; delay: number }) {
  const medal = MEDAL[place - 1]
  const first = place === 1
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 12 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{
        delay,
        duration: first ? 0.5 : 0.35,
        type: first ? 'spring' : 'tween',
        stiffness: 180,
        damping: 16,
        ease: 'easeOut',
      }}
      className={cn(
        'relative overflow-hidden rounded-panel border bg-panel p-4 text-center',
        medal.border,
        first && 'shadow-[0_0_40px_rgba(232,184,75,0.12)] min-[768px]:-translate-y-3',
      )}
    >
      {/* gold radial glow + emblem watermark behind the #1 crest */}
      {first && (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 60% 50% at 50% 30%, rgba(232,184,75,0.16), transparent 70%)',
            }}
          />
          <img
            src="/circle-emblem.svg"
            alt=""
            className="pointer-events-none absolute left-1/2 top-8 h-28 w-28 -translate-x-1/2 opacity-[0.06]"
          />
        </>
      )}

      <div className={cn('relative mx-auto mb-2 flex items-center justify-center gap-1 font-mono text-[11px] font-bold', medal.text)}>
        {first && <Crown size={13} className="text-wccf-gold" fill="currentColor" />}
        #{place}
      </div>

      <img
        src={row.avatar}
        alt=""
        className={cn(
          'relative mx-auto rounded-full border-2 object-cover',
          medal.chip,
          first ? 'h-16 w-16' : 'h-12 w-12',
        )}
      />

      <div
        className={cn(
          'relative mt-2 truncate font-display font-semibold uppercase tracking-[0.04em] text-wccf-ink',
          first ? 'text-2xl' : 'text-xl',
        )}
        title={row.name}
      >
        {row.name}
      </div>
      <div className="relative truncate text-[12px] text-wccf-dim">
        {row.manager ?? row.shortName}
      </div>

      {/* kit-color chips */}
      <div className="relative mt-2 flex items-center justify-center gap-1">
        <span
          className="h-2.5 w-2.5 rounded-[3px] border border-line"
          style={{ backgroundColor: row.kitPrimary }}
          title="Home kit"
        />
        <span
          className="h-2.5 w-2.5 rounded-[3px] border border-line"
          style={{ backgroundColor: row.kitSecondary }}
          title="Away kit"
        />
        <span className="ml-1 rounded bg-accent-dim px-1.5 py-[1px] font-mono text-[10px] font-bold uppercase text-accent">
          {row.shortName}
        </span>
      </div>

      <div className={cn('relative mt-2 font-mono font-bold tnum', medal.text, first ? 'text-[28px]' : 'text-2xl')}>
        {row.rating}
      </div>
      <div className="relative font-mono text-[11px] text-wccf-mute tnum">
        {row.wins}W – {row.draws}D – {row.losses}L
      </div>
    </motion.div>
  )
}

/** Top-3 podium — #1 center/elevated gold, #2 silver, #3 bronze (hall-of-fame.md §2). */
export default function Podium({ rows }: { rows: LeaderRow[] }) {
  const top = rows.slice(0, 3)
  if (top.length < 3) return null
  /* entrance: #1 first, then #2/#3 stagger 150ms */
  const ordered: { row: LeaderRow; place: 1 | 2 | 3; delay: number }[] = [
    { row: top[1], place: 2, delay: 0.5 },
    { row: top[0], place: 1, delay: 0 },
    { row: top[2], place: 3, delay: 0.65 },
  ]
  return (
    <div className="grid items-end gap-3 min-[768px]:grid-cols-3">
      {ordered.map((p) => (
        <PodiumCard key={p.row.id} {...p} />
      ))}
    </div>
  )
}
