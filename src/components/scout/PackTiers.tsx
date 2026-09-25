import { motion } from 'framer-motion'
import { Link } from 'react-router'
import { Coins, Crown, Layers, Loader2, Lock, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LOGIN_PATH } from '@/const'
import { SCOUT_COST, type ScoutTier } from './odds'

interface PackTiersProps {
  isAuthenticated: boolean
  authLoading: boolean
  credits: number | null
  pulling: ScoutTier | null
  insufficient: ScoutTier | null
  onPull: (tier: ScoutTier) => void
  onShowOdds: () => void
}

/** Metallic kira icon with permanent slow shine sweep (tier 3 teaser / elite). */
function KiraIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn('relative flex items-center justify-center overflow-hidden rounded-card border border-[#7A5CFF66] bg-[#101114]', className)}
    >
      <Sparkles size={26} className="relative text-[#B7A5FF]" />
      <span className="pointer-events-none absolute inset-0 kira-shine opacity-80" />
    </span>
  )
}

function TierIcon({ kind, className }: { kind: 'pro' | 'elite' | 'legends'; className?: string }) {
  if (kind === 'pro') {
    return (
      <span className={cn('flex items-center justify-center rounded-card border border-[#D8D3C4] bg-[#F2EFE7]', className)}>
        <Layers size={26} className="text-[#15171C]" />
      </span>
    )
  }
  if (kind === 'elite') {
    return <KiraIcon className={className} />
  }
  return (
    <span className={cn('flex items-center justify-center rounded-card border border-[#C9A86A55] bg-[#1A150C]', className)}>
      <Crown size={26} className="text-[#C9A86A]" />
    </span>
  )
}

/**
 * The three scout pack tier cards — Pro / Elite active, World Legends teaser.
 */
export default function PackTiers({
  isAuthenticated,
  authLoading,
  credits,
  pulling,
  insufficient,
  onPull,
  onShowOdds,
}: PackTiersProps) {
  const tiers: {
    key: ScoutTier | 'legends'
    icon: 'pro' | 'elite' | 'legends'
    name: string
    contents: string
    cost: number | null
    note?: string
    locked?: boolean
  }[] = [
    {
      key: 'pro',
      icon: 'pro',
      name: 'Pro Scout',
      contents: '5 cards · regulars base pool, one feature slot with kira chance',
      cost: SCOUT_COST.pro,
      note: 'Feature slot: RAR 30% · YS 8% · WBE/WGK/MVP 5% · ATLE 2%',
    },
    {
      key: 'elite',
      icon: 'elite',
      name: 'Elite Scout',
      contents: '5 cards · no regulars — one slot guaranteed Rare (kira) or better',
      cost: SCOUT_COST.elite,
      note: 'Base slots: SPE 50% · RAR 35% · YS 10%',
    },
    {
      key: 'legends',
      icon: 'legends',
      name: 'World Legends',
      contents: 'ATLE-only pool. The all-time greats return during events.',
      cost: null,
      locked: true,
    },
  ]

  return (
    <div className="grid gap-4 min-[900px]:grid-cols-3">
      {tiers.map((t, i) => {
        const isLive = !t.locked
        const affordable = credits !== null && t.cost !== null && credits >= t.cost
        const isPulling = pulling === t.key
        const showInsufficient = insufficient === t.key

        return (
          <motion.div
            key={t.key}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 * i, duration: 0.35, ease: 'easeOut' }}
            whileHover={isLive ? { y: -4 } : undefined}
            className={cn(
              'group flex flex-col rounded-panel border bg-panel p-4 transition-colors duration-150',
              isLive ? 'border-line hover:border-accent/60' : 'border-line opacity-75',
              t.key === 'elite' && 'hover:border-[#7A5CFF88]',
            )}
          >
            <div className="flex items-start justify-between">
              <TierIcon kind={t.icon} className="h-16 w-16" />
              {t.locked && (
                <span className="flex items-center gap-1 rounded-full border border-line px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-wccf-mute">
                  <Lock size={10} /> Locked
                </span>
              )}
              {t.key === 'elite' && (
                <span className="rounded-full bg-[#7A5CFF22] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#B7A5FF]">
                  ≥ RAR guaranteed
                </span>
              )}
            </div>

            <h3 className="mt-3 font-display text-[22px] font-semibold uppercase tracking-[0.04em] text-wccf-ink">
              {t.name}
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-wccf-dim">{t.contents}</p>
            {t.note && <p className="mt-1.5 font-mono text-[11px] text-wccf-mute">{t.note}</p>}

            <div className="mt-auto pt-4">
              {t.locked ? (
                <button
                  disabled
                  className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-btn border border-line bg-raised px-4 py-2.5 font-sans text-[13px] font-bold uppercase tracking-[0.04em] text-wccf-mute"
                >
                  <Lock size={13} /> Returns during events
                </button>
              ) : !isAuthenticated ? (
                <Link
                  to={LOGIN_PATH}
                  className={cn(
                    'flex w-full items-center justify-center gap-2 rounded-btn bg-accent px-4 py-2.5 font-sans text-[13px] font-bold uppercase tracking-[0.04em] text-[#0B0E14] transition-colors hover:bg-accent-hover',
                    authLoading && 'pointer-events-none opacity-60',
                  )}
                >
                  Sign in to scout
                </Link>
              ) : (
                <>
                  <button
                    disabled={!affordable || pulling !== null}
                    title={!affordable ? 'Play matches to earn credits' : undefined}
                    onClick={() => onPull(t.key as ScoutTier)}
                    className={cn(
                      'flex w-full items-center justify-center gap-2 rounded-btn px-4 py-2.5 font-sans text-[13px] font-bold uppercase tracking-[0.04em] transition-all duration-150 active:scale-[0.97]',
                      affordable && pulling === null
                        ? 'bg-accent text-[#0B0E14] hover:bg-accent-hover'
                        : 'cursor-not-allowed border border-line bg-raised text-wccf-mute',
                    )}
                  >
                    {isPulling ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Contacting cabinet…
                      </>
                    ) : (
                      <>
                        <Coins size={14} />
                        Scout · <span className="font-mono tnum">{t.cost?.toLocaleString()}</span> cr
                      </>
                    )}
                  </button>
                  {showInsufficient && (
                    <p className="mt-2 text-center font-mono text-[11px] text-wccf-danger">
                      Not enough credits — play matches to earn more.
                    </p>
                  )}
                  {!showInsufficient && !affordable && credits !== null && (
                    <p className="mt-2 text-center font-mono text-[11px] text-wccf-mute">
                      Play matches to earn credits
                    </p>
                  )}
                </>
              )}
              {isLive && (
                <button
                  onClick={onShowOdds}
                  className="mt-2 w-full text-center font-mono text-[11px] uppercase tracking-[0.1em] text-wccf-mute transition-colors hover:text-accent"
                >
                  odds &amp; drop table
                </button>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
