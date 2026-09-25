import Modal from '@/components/Modal'
import Sparkline from './Sparkline'
import type { LeaderRow } from './demoData'

/** Ranking-row club detail modal (placeholder for the shared Clubs page modal). */
export default function ClubModal({
  row,
  onClose,
}: {
  row: LeaderRow | null
  onClose: () => void
}) {
  const total = row ? row.wins + row.draws + row.losses : 0
  return (
    <Modal open={row !== null} onClose={onClose} title={row?.name ?? ''} widthClass="max-w-sm">
      {row && (
        <div className="flex flex-col items-center text-center">
          <img
            src={row.avatar}
            alt=""
            className="h-16 w-16 rounded-full border-2 border-line-strong object-cover"
          />
          <div className="mt-2 flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-[3px] border border-line"
              style={{ backgroundColor: row.kitPrimary }}
            />
            <span
              className="h-2.5 w-2.5 rounded-[3px] border border-line"
              style={{ backgroundColor: row.kitSecondary }}
            />
            <span className="rounded bg-accent-dim px-1.5 py-[1px] font-mono text-[10px] font-bold uppercase text-accent">
              {row.shortName}
            </span>
          </div>
          {row.manager && <div className="mt-1 text-[13px] text-wccf-dim">{row.manager}</div>}

          <div className="mt-3 font-mono text-[28px] font-bold text-accent tnum">{row.rating}</div>
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-wccf-mute">
            Rating · Rank #{row.rank}
          </div>

          <div className="mt-4 grid w-full grid-cols-3 gap-2">
            {[
              { label: 'Wins', value: row.wins, cls: 'text-wccf-live' },
              { label: 'Draws', value: row.draws, cls: 'text-wccf-dim' },
              { label: 'Losses', value: row.losses, cls: 'text-wccf-danger' },
            ].map((s) => (
              <div key={s.label} className="rounded-card border border-line bg-raised px-2 py-2">
                <div className={`font-mono text-lg font-bold tnum ${s.cls}`}>{s.value}</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-wccf-mute">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex w-full items-center justify-between rounded-card border border-line bg-raised px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-wccf-mute">
              Win rate
            </span>
            <span className="font-mono text-[13px] font-bold text-wccf-ink tnum">
              {total === 0 ? '—' : `${Math.round((row.wins / total) * 100)}%`}
            </span>
          </div>
          <div className="mt-2 flex w-full items-center justify-between rounded-card border border-line bg-raised px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-wccf-mute">
              Last 10 ratings
            </span>
            <Sparkline points={row.history} width={80} height={24} />
          </div>
        </div>
      )}
    </Modal>
  )
}
