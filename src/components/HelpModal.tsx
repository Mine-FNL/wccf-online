/* eslint-disable react-refresh/only-export-components -- shared demo data + hooks intentionally co-located */
import Modal from './Modal'

/** Cabinet key bindings (home.md §5) — shared with the lobby controls panel. */
export const KEY_BINDINGS: { keys: string[]; label: string }[] = [
  { keys: ['↑', '←', '→', '↓'], label: 'Move cursor' },
  { keys: ['Enter'], label: 'Start / confirm (the yellow button)' },
  { keys: ['T'], label: 'Team talk' },
  { keys: ['S'], label: 'Substitution' },
  { keys: ['K'], label: 'Set Key Player' },
  { keys: ['I'], label: 'Insert card at the card screen' },
  { keys: ['M'], label: 'Match commands' },
]

/** How a seat works (home.md §5). */
export const SEAT_STEPS: string[] = [
  'Take an open seat',
  'Your starting XI loads from My Club',
  "Play the cabinet's next match",
  'Cabinet ejects a reward card',
  'Card lands in your collection',
]

export function KeyCap({ label }: { label: string }) {
  return (
    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-btn border border-line-strong bg-raised px-1.5 font-mono text-xs font-bold text-wccf-ink shadow-[0_2px_0_0_rgba(0,0,0,0.5)]">
      {label}
    </span>
  )
}

/**
 * Help modal — opened from the navbar "?" on every page.
 * Cabinet controls + how a seat works (home.md).
 */
export default function HelpModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="Cabinet controls" widthClass="max-w-lg">
      <div className="flex flex-col gap-5">
        <div>
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-wccf-dim">
            Keys
          </div>
          <ul className="flex flex-col gap-2">
            {KEY_BINDINGS.map((b) => (
              <li key={b.label} className="flex items-center gap-2">
                <span className="flex gap-1">
                  {b.keys.map((k) => (
                    <KeyCap key={k} label={k} />
                  ))}
                </span>
                <span className="text-[13px] text-wccf-dim">{b.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-wccf-dim">
            How a seat works
          </div>
          <ol className="flex flex-col gap-2">
            {SEAT_STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent text-center font-mono text-[11px] font-bold text-accent">
                  {i + 1}
                </span>
                <span className="text-[13px] text-wccf-ink">{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-btn border border-line bg-inset px-3 py-2 font-mono text-[11px] leading-relaxed text-wccf-mute">
            Reward card ejects after every session — win or lose. One club per
            seat, no queue sniping, be decent in chat.
          </p>
        </div>
      </div>
    </Modal>
  )
}
