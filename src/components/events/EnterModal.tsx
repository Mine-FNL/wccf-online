import { useMemo } from 'react'
import { Link } from 'react-router'
import Modal from '@/components/Modal'
import { LOGIN_PATH } from '@/const'
import { Armchair, Coins, ShieldCheck } from 'lucide-react'

export interface EnterTarget {
  name: string
  entry: string
  seats: number
}

/**
 * Event entry confirm modal — entry fee, club, demo seat assignment →
 * Registered state. Signed-out users get the LOGIN_PATH CTA (events.md
 * interactions).
 */
export default function EnterModal({
  target,
  isAuthenticated,
  clubName,
  onClose,
  onConfirm,
}: {
  target: EnterTarget | null
  isAuthenticated: boolean
  clubName?: string
  onClose: () => void
  onConfirm: (t: EnterTarget) => void
}) {
  /* deterministic demo seat assignment per club+event */
  const seat = useMemo(() => {
    if (!target) return 1
    const s = `${target.name}|${clubName ?? 'guest'}`
    let h = 0
    for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    return (h % target.seats) + 1
  }, [target, clubName])

  return (
    <Modal open={target !== null} onClose={onClose} title="Event entry" widthClass="max-w-sm">
      {target && (
        <div>
          <div className="font-display text-2xl font-semibold uppercase tracking-[0.04em] text-wccf-ink">
            {target.name}
          </div>

          {!isAuthenticated ? (
            <div className="mt-3">
              <p className="text-[14px] text-wccf-dim">
                Sign in to register your club for this event.
              </p>
              <Link
                to={LOGIN_PATH}
                className="mt-4 block rounded-btn bg-accent px-4 py-2.5 text-center font-sans text-[13px] font-bold uppercase tracking-[0.06em] text-[#0B0E14] transition-colors hover:bg-accent-hover"
              >
                Sign in to enter
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-4 flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-card border border-line bg-raised px-3 py-2">
                  <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-wccf-mute">
                    <ShieldCheck size={13} className="text-accent" />
                    Club
                  </span>
                  <span className="font-mono text-[13px] font-bold text-wccf-ink">
                    {clubName ?? 'Your club'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-card border border-line bg-raised px-3 py-2">
                  <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-wccf-mute">
                    <Coins size={13} className="text-wccf-gold" />
                    Entry fee
                  </span>
                  <span className="font-mono text-[13px] font-bold text-wccf-ink">{target.entry}</span>
                </div>
                <div className="flex items-center justify-between rounded-card border border-line bg-raised px-3 py-2">
                  <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-wccf-mute">
                    <Armchair size={13} className="text-accent" />
                    Seat
                  </span>
                  <span className="font-mono text-[13px] font-bold text-accent tnum">
                    #{seat} of {target.seats}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onConfirm(target)}
                className="mt-4 w-full rounded-btn bg-accent px-4 py-2.5 font-sans text-[13px] font-bold uppercase tracking-[0.06em] text-[#0B0E14] transition-all duration-150 hover:bg-accent-hover active:scale-[0.97]"
              >
                Confirm entry
              </button>
              <p className="mt-2 text-center font-mono text-[11px] text-wccf-mute">
                Demo entry — no credits are charged.
              </p>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
