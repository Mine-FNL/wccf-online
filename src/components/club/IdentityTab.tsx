import { useState } from 'react'
import { motion } from 'framer-motion'
import { Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { trpc } from '@/providers/trpc'
import type { Club } from './clubUtils'

/** 12 preset team colors (primary/secondary swatch columns). */
const KIT_COLORS = [
  '#FF8A1E', '#FF4D4F', '#E8B84B', '#3DD68C',
  '#1E7A4C', '#4DD0E1', '#3B82F6', '#7A5CFF',
  '#FF3D71', '#F2EFE7', '#8A94A7', '#12161F',
]

/** Mini kit preview (shirt + shorts) with 3D hover tilt. */
function KitPreview({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <motion.div
      className="flex items-center justify-center rounded-panel border border-line bg-inset py-6"
      whileHover={{ rotateX: 4, rotateY: -4 }}
      transition={{ type: 'spring', stiffness: 200, damping: 14 }}
      style={{ transformStyle: 'preserve-3d', perspective: 600 }}
    >
      <svg width="150" height="150" viewBox="0 0 150 150" aria-label="Kit preview">
        {/* shirt */}
        <g style={{ transition: 'fill 200ms' }}>
          <path
            d="M50 22 L30 32 L18 58 L34 66 L42 52 L42 100 L108 100 L108 52 L116 66 L132 58 L120 32 L100 22 Q75 36 50 22 Z"
            fill={primary}
            stroke="#0B0E14"
            strokeWidth="2"
            style={{ transition: 'fill 200ms' }}
          />
          {/* collar + cuff in secondary */}
          <path d="M50 22 Q75 36 100 22 L96 30 Q75 42 54 30 Z" fill={secondary} style={{ transition: 'fill 200ms' }} />
          <rect x="20" y="56" width="16" height="7" fill={secondary} style={{ transition: 'fill 200ms' }} />
          <rect x="114" y="56" width="16" height="7" fill={secondary} style={{ transition: 'fill 200ms' }} />
          {/* shorts */}
          <path
            d="M48 108 L102 108 L106 140 L82 140 L75 118 L68 140 L44 140 Z"
            fill={secondary}
            stroke="#0B0E14"
            strokeWidth="2"
            style={{ transition: 'fill 200ms' }}
          />
        </g>
      </svg>
    </motion.div>
  )
}

function SwatchColumn({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (hex: string) => void
}) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-wccf-mute">
        {label} <span className="text-wccf-dim">{value}</span>
      </p>
      <div className="grid grid-cols-6 gap-1.5 min-[560px]:grid-cols-12">
        {KIT_COLORS.map((hex) => (
          <button
            key={hex}
            onClick={() => onChange(hex)}
            aria-label={`${label} ${hex}`}
            className={cn(
              'h-7 w-7 rounded-btn border transition-transform hover:scale-110',
              value.toLowerCase() === hex.toLowerCase()
                ? 'border-accent ring-2 ring-accent/50'
                : 'border-line',
            )}
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Identity tab — club name (≤60), short name (≤4 uppercase), kit colors.
 * Save persists via club.update.
 */
export default function IdentityTab({ club }: { club: Club }) {
  const { toast } = useToast()
  const utils = trpc.useUtils()

  const [name, setName] = useState(club.name)
  const [shortName, setShortName] = useState(club.shortName)
  const [kitPrimary, setKitPrimary] = useState(club.kitPrimary)
  const [kitSecondary, setKitSecondary] = useState(club.kitSecondary)
  const [saved, setSaved] = useState({
    name: club.name,
    shortName: club.shortName,
    kitPrimary: club.kitPrimary,
    kitSecondary: club.kitSecondary,
  })

  const dirty =
    name.trim() !== saved.name ||
    shortName.trim().toUpperCase() !== saved.shortName ||
    kitPrimary !== saved.kitPrimary ||
    kitSecondary !== saved.kitSecondary

  const valid = name.trim().length >= 1 && name.trim().length <= 60 && shortName.trim().length >= 1

  const update = trpc.club.update.useMutation({
    onSuccess: (data) => {
      setSaved({
        name: data.club.name,
        shortName: data.club.shortName,
        kitPrimary: data.club.kitPrimary,
        kitSecondary: data.club.kitSecondary,
      })
      setName(data.club.name)
      setShortName(data.club.shortName)
      toast('Club identity saved.', 'success')
    },
    onError: (e) => toast(e.message || 'Could not save identity', 'danger'),
    onSettled: () => utils.club.me.invalidate(),
  })

  return (
    <div className="grid gap-6 min-[900px]:grid-cols-[1fr_280px]">
      <div className="flex flex-col gap-5 rounded-panel border border-line bg-panel p-4">
        <div>
          <label htmlFor="club-name" className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-wccf-mute">
            Club name
          </label>
          <input
            id="club-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-btn border border-line bg-raised px-3 py-2 font-display text-xl font-semibold uppercase tracking-[0.03em] text-wccf-ink caret-accent focus:border-accent focus:outline-none"
          />
          <p className="mt-1 text-right font-mono text-[10px] text-wccf-mute tnum">{name.length}/60</p>
        </div>

        <div>
          <label htmlFor="club-short" className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-wccf-mute">
            Scorebug chip (max 4 letters)
          </label>
          <input
            id="club-short"
            value={shortName}
            maxLength={4}
            onChange={(e) => setShortName(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            className="w-32 rounded-btn border border-line bg-raised px-3 py-2 font-mono text-lg font-bold uppercase text-accent caret-accent focus:border-accent focus:outline-none"
          />
          <p className="mt-1.5 font-mono text-[10px] text-wccf-mute">
            Shown on the scorebug during matches — e.g. <span className="text-wccf-dim">{shortName || 'NEW'} 2 — 1 OPP</span>
          </p>
        </div>

        <SwatchColumn label="Kit primary" value={kitPrimary} onChange={setKitPrimary} />
        <SwatchColumn label="Kit secondary" value={kitSecondary} onChange={setKitSecondary} />

        <button
          onClick={() =>
            update.mutate({
              name: name.trim(),
              shortName: shortName.trim(),
              kitPrimary,
              kitSecondary,
            })
          }
          disabled={!dirty || !valid || update.isPending}
          className={cn(
            'mt-1 flex w-fit items-center gap-1.5 rounded-full px-5 py-2 text-[12px] font-bold uppercase tracking-[0.06em] transition-all',
            dirty && valid
              ? 'bg-accent text-[#0B0E14] hover:bg-accent-hover active:scale-[0.97]'
              : 'cursor-not-allowed border border-line bg-raised text-wccf-mute',
          )}
        >
          <Save size={13} />
          {update.isPending ? 'Saving…' : dirty ? 'Save identity' : 'Saved'}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <KitPreview primary={kitPrimary} secondary={kitSecondary} />
        <p className="text-center font-mono text-[11px] text-wccf-mute">
          Live kit preview — your colors show on the scorebug and club chip.
        </p>
      </div>
    </div>
  )
}
