import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Sparkline from './Sparkline'
import type { LeaderRow } from './demoData'

const RANK_COLOR = ['text-wccf-gold', 'text-[#9AA5B1]', 'text-[#B0793D]']

function winPct(r: LeaderRow): string {
  const total = r.wins + r.draws + r.losses
  if (total === 0) return '—'
  return `${Math.round((r.wins / total) * 100)}%`
}

/**
 * Dense rankings table (44px rows): rank, club, rating, W-D-L, win%, goals,
 * streak chip, last-10 sparkline. Hover bg-raised; own row gets an accent
 * left border + YOU pill (hall-of-fame.md §2).
 */
export default function RankingsTable({
  rows,
  ownClubId,
  pageKey,
  onSelect,
}: {
  rows: LeaderRow[]
  ownClubId?: number
  pageKey: number
  onSelect: (row: LeaderRow) => void
}) {
  return (
    <div className="overflow-x-auto rounded-panel border border-line bg-panel">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-wccf-mute">
            <th className="w-10 px-3 py-2.5">#</th>
            <th className="px-3 py-2.5">Club</th>
            <th className="px-3 py-2.5 text-right">Rating</th>
            <th className="px-3 py-2.5 text-right">W-D-L</th>
            <th className="px-3 py-2.5 text-right">Win%</th>
            <th className="px-3 py-2.5 text-right">Goals</th>
            <th className="px-3 py-2.5 text-right">Streak</th>
            <th className="px-3 py-2.5 text-right">Last 10</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const own = ownClubId !== undefined && r.id === ownClubId
            return (
              <motion.tr
                key={`${pageKey}-${r.id}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.025, duration: 0.25, ease: 'easeOut' }}
                onClick={() => onSelect(r)}
                className={cn(
                  'h-11 cursor-pointer border-b border-line/60 transition-colors last:border-0 hover:bg-raised',
                  own && 'border-l-2 border-l-accent bg-accent-dim/40',
                )}
              >
                <td
                  className={cn(
                    'px-3 py-2 font-mono text-[13px] font-bold tnum',
                    r.rank <= 3 ? RANK_COLOR[r.rank - 1] : 'text-wccf-mute',
                  )}
                >
                  {r.rank}
                </td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2.5">
                    <img
                      src={r.avatar}
                      alt=""
                      className="h-7 w-7 rounded-full border border-line object-cover"
                    />
                    <span className="truncate text-[14px] font-semibold text-wccf-ink">
                      {r.name}
                    </span>
                    <span className="rounded bg-raised px-1.5 py-[1px] font-mono text-[10px] font-bold uppercase text-accent">
                      {r.shortName}
                    </span>
                    {own && (
                      <span className="rounded-full bg-accent px-1.5 py-[1px] font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-[#0B0E14]">
                        You
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-[14px] font-bold text-accent tnum">
                  {r.rating}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[12px] text-wccf-dim tnum">
                  {r.wins}-{r.draws}-{r.losses}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[12px] text-wccf-dim tnum">
                  {winPct(r)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[12px] text-wccf-dim tnum">
                  {r.goalsFor ?? '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.streak ? (
                    <span
                      className={cn(
                        'inline-block rounded px-1.5 py-[1px] font-mono text-[10px] font-bold tnum',
                        r.streak.type === 'W'
                          ? 'bg-[rgba(61,214,140,0.12)] text-wccf-live'
                          : 'bg-[rgba(255,77,79,0.12)] text-wccf-danger',
                      )}
                    >
                      {r.streak.type}
                      {r.streak.n}
                    </span>
                  ) : (
                    <span className="font-mono text-[12px] text-wccf-mute">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Sparkline points={r.history} />
                </td>
              </motion.tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
