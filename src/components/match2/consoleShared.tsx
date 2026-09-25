/**
 * Shared console primitives — the arcade button language (spec §1).
 * Flat panels, hard borders, mono kbd hints; active buttons stay lit with
 * the accent glow. No gradients, no rounded cartoon chrome.
 */
import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[3px] border border-line-strong bg-inset px-1 py-[1px] font-mono text-[8px] font-bold leading-none text-wccf-mute">
      {children}
    </span>
  )
}

export function ConsoleButton({
  active = false,
  gold = false,
  disabled = false,
  onPress,
  hint,
  label,
  sub,
  className,
}: {
  /** stays lit while the tactic/stance is active */
  active?: boolean
  /** gold = special command available (KP SPIRIT MAX) */
  gold?: boolean
  disabled?: boolean
  onPress?: () => void
  hint?: string
  label: ReactNode
  sub?: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPress}
      className={cn(
        'flex flex-col items-center justify-center gap-[2px] rounded-btn border px-2 py-1.5 transition-colors duration-100 select-none',
        gold
          ? 'border-wccf-gold bg-[rgba(232,184,75,0.14)] text-wccf-gold shadow-[0_0_12px_rgba(232,184,75,0.35)]'
          : active
            ? 'border-accent bg-accent-dim text-accent shadow-[0_0_10px_rgba(255,138,30,0.3)]'
            : 'border-line-strong bg-raised text-wccf-dim hover:border-accent hover:text-wccf-ink',
        disabled && 'cursor-not-allowed opacity-35 hover:border-line-strong hover:text-wccf-dim',
        className,
      )}
    >
      <span className="font-display text-[13px] font-bold uppercase leading-none tracking-[0.06em]">
        {label}
      </span>
      {sub && (
        <span className="font-mono text-[8px] uppercase tracking-[0.08em] opacity-80">{sub}</span>
      )}
      {hint && <Kbd>{hint}</Kbd>}
    </button>
  )
}

/** Big convex arcade button (SHOOT / GK RUSH) with hold support. */
export function BigArcadeButton({
  color,
  label,
  hint,
  sub,
  pulse = false,
  disabled = false,
  onTap,
  onHoldRelease,
}: {
  color: string
  label: string
  hint: string
  sub?: string
  /** pulses while its chance window is open */
  pulse?: boolean
  disabled?: boolean
  onTap: () => void
  /** release after hold — heldMs ≥ 800 = rush (GK) */
  onHoldRelease?: (heldMs: number) => void
}) {
  const downAt = useRef<number | null>(null)
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={() => {
        downAt.current = performance.now()
      }}
      onPointerUp={() => {
        const held = downAt.current == null ? 0 : performance.now() - downAt.current
        downAt.current = null
        if (onHoldRelease) onHoldRelease(held)
        else onTap()
      }}
      onPointerLeave={() => {
        /* releasing off-button still counts as a release */
        if (downAt.current != null && onHoldRelease) {
          const held = performance.now() - downAt.current
          downAt.current = null
          onHoldRelease(held)
        }
      }}
      className={cn(
        'flex h-[74px] w-[74px] flex-col items-center justify-center gap-[3px] rounded-full border-2 transition-transform duration-75 select-none active:scale-95',
        disabled && 'cursor-not-allowed opacity-35',
        pulse && 'animate-pulse',
      )}
      style={{
        borderColor: color,
        backgroundColor: `${color}1f`,
        color,
        boxShadow: pulse ? `0 0 18px ${color}66, inset 0 0 10px ${color}33` : `inset 0 0 8px ${color}22`,
      }}
    >
      <span className="font-display text-[13px] font-bold uppercase leading-none tracking-[0.04em]">
        {label}
      </span>
      {sub && <span className="font-mono text-[7.5px] uppercase opacity-80">{sub}</span>}
      <Kbd>{hint}</Kbd>
    </button>
  )
}
