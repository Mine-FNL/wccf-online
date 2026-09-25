import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StatusVariant = 'playing' | 'open' | 'live' | 'strong' | 'queued' | 'full'

const STYLES: Record<StatusVariant, { chip: string; dot: string; label: string }> = {
  playing: {
    chip: 'bg-[rgba(61,214,140,0.12)] text-wccf-live border-[rgba(61,214,140,0.35)]',
    dot: 'bg-wccf-live',
    label: 'PLAYING',
  },
  open: {
    chip: 'bg-raised text-wccf-mute border-line',
    dot: 'bg-wccf-mute',
    label: 'OPEN',
  },
  live: {
    chip: 'bg-[rgba(255,77,79,0.12)] text-wccf-danger border-[rgba(255,77,79,0.4)]',
    dot: 'bg-wccf-danger',
    label: 'LIVE',
  },
  strong: {
    chip: 'bg-[rgba(61,214,140,0.12)] text-wccf-live border-[rgba(61,214,140,0.35)]',
    dot: 'bg-wccf-live',
    label: 'STRONG',
  },
  queued: {
    chip: 'bg-[rgba(255,197,49,0.1)] text-wccf-caution border-[rgba(255,197,49,0.35)]',
    dot: 'bg-wccf-caution',
    label: 'QUEUED',
  },
  full: {
    chip: 'bg-[rgba(255,77,79,0.12)] text-wccf-danger border-[rgba(255,77,79,0.4)]',
    dot: 'bg-wccf-danger',
    label: 'FULL',
  },
}

export default function StatusPill({
  variant,
  pulse = false,
  children,
  className,
}: {
  variant: StatusVariant
  /** animate the leading dot (live signals) */
  pulse?: boolean
  children?: ReactNode
  className?: string
}) {
  const s = STYLES[variant]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px]',
        'font-sans text-[10px] font-bold uppercase tracking-[0.08em] leading-none',
        s.chip,
        className,
      )}
    >
      <span className="relative flex h-[5px] w-[5px]">
        {pulse && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full animate-pulse-halo',
              s.dot,
            )}
          />
        )}
        <span
          className={cn(
            'relative inline-flex h-[5px] w-[5px] rounded-full',
            s.dot,
            pulse && 'animate-pulse-dot',
          )}
        />
      </span>
      {children ?? s.label}
    </span>
  )
}
