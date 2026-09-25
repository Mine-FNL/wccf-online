import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { PlayerCardData, Position, Rarity } from '@/lib/data/types'
import { cardTotal } from '@/lib/data/cards'

export type CardSize = 'xs' | 'sm' | 'md' | 'lg'

const SIZE_W: Record<CardSize, number> = { xs: 64, sm: 120, md: 200, lg: 280 }

interface Skin {
  bg: string
  ink: string
  sub: string
  bar: string
  frame: string
  foil: boolean
  paper?: boolean
}

/** Rarity skins (design.md §2). */
const SKINS: Record<Rarity, Skin> = {
  REG: { bg: '#F2EFE7', ink: '#15171C', sub: '#5A564A', bar: '#FF8A1E', frame: '#D8D3C4', foil: false, paper: true },
  SPE: { bg: '#101114', ink: '#F2F3F5', sub: '#9AA0AA', bar: '#C8CDD6', frame: '#2A2D33', foil: false },
  RAR: { bg: '#101114', ink: '#F2F3F5', sub: '#9AA0AA', bar: '#7A5CFF', frame: '#7A5CFF', foil: true },
  WBE: { bg: '#14100A', ink: '#F5E9C8', sub: '#B89B5E', bar: '#E8B84B', frame: '#E8B84B', foil: true },
  WGK: { bg: '#0B1416', ink: '#D9F4F8', sub: '#6FA8B5', bar: '#4DD0E1', frame: '#4DD0E1', foil: true },
  MVP: { bg: '#170A10', ink: '#FFE3EC', sub: '#C06A88', bar: '#FF3D71', frame: '#FF3D71', foil: true },
  ATLE: { bg: '#E8DCC0', ink: '#5C4A28', sub: '#8A744A', bar: '#C9A86A', frame: '#C9A86A', foil: false, paper: true },
  YS: { bg: '#0B1512', ink: '#D9F5E8', sub: '#5FA886', bar: '#3DD68C', frame: '#3DD68C', foil: true },
}

const STAT_KEYS = ['off', 'def', 'tec', 'pow', 'spd', 'sta'] as const
const STAT_LABELS = ['OFF', 'DEF', 'TEC', 'POW', 'SPD', 'STA']

/** Hexagon radar of the six WCCF parameters (0–20 scale). */
export function StatRadar({
  stats,
  size,
  color,
  ink,
  fillOpacity = 0.28,
  showLabels = false,
}: {
  stats: PlayerCardData['stats']
  size: number
  color: string
  ink: string
  fillOpacity?: number
  showLabels?: boolean
}) {
  const cx = size / 2
  const cy = size / 2
  const R = size / 2 - (showLabels ? 14 : 3)
  const pt = (i: number, v: number) => {
    const a = (Math.PI / 3) * i - Math.PI / 2
    return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v] as const
  }
  const ring = (f: number) =>
    Array.from({ length: 6 }, (_, i) => pt(i, f).join(',')).join(' ')
  const values = STAT_KEYS.map((k) => stats[k] / 20)
  const poly = values.map((v, i) => pt(i, Math.max(0.06, v)).join(',')).join(' ')
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[1, 0.66, 0.33].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke={ink} strokeOpacity={0.22} strokeWidth={1} />
      ))}
      {values.map((_, i) => {
        const [x, y] = pt(i, 1)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={ink} strokeOpacity={0.18} strokeWidth={1} />
      })}
      <polygon points={poly} fill={color} fillOpacity={fillOpacity} stroke={color} strokeWidth={1.5} />
      {showLabels &&
        values.map((_, i) => {
          const [x, y] = pt(i, 1.22)
          return (
            <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
              fontSize={9} fontFamily="'JetBrains Mono', monospace" fill={ink} opacity={0.85}>
              {STAT_LABELS[i]}
            </text>
          )
        })}
    </svg>
  )
}

/** Mini pitch with lit dots for playable positions (card back). */
function PositionPitch({ positions, skin }: { positions: Position[]; skin: Skin }) {
  const SPOTS: Record<Position, [number, number]> = {
    GK: [50, 88], CB: [50, 70], LSB: [20, 66], RSB: [80, 66],
    DMF: [50, 54], CMF: [50, 42], OMF: [50, 28], SMF: [24, 38],
    FW: [30, 16], CF: [62, 14],
  }
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <rect x="4" y="4" width="92" height="92" rx="4" fill="none" stroke={skin.ink} strokeOpacity={0.35} strokeWidth={2} />
      <line x1="4" y1="50" x2="96" y2="50" stroke={skin.ink} strokeOpacity={0.25} strokeWidth={2} />
      <circle cx="50" cy="50" r="14" fill="none" stroke={skin.ink} strokeOpacity={0.25} strokeWidth={2} />
      {(Object.keys(SPOTS) as Position[]).map((p) => {
        const [x, y] = SPOTS[p]
        const lit = positions.includes(p)
        return (
          <g key={p}>
            <circle cx={x} cy={y} r={lit ? 6 : 3.5}
              fill={lit ? skin.bar : 'none'}
              stroke={lit ? skin.bar : skin.ink}
              strokeOpacity={lit ? 1 : 0.35} strokeWidth={1.5} />
            <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="middle"
              fontSize={lit ? 4.6 : 3.6} fontFamily="'JetBrains Mono', monospace"
              fill={lit ? skin.bg : skin.ink} opacity={lit ? 1 : 0.5}>
              {p}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/**
 * Faithful WCCF player card — aspect 5:7, front/back flip on click,
 * 8 rarity skins, kira shine sweep on foil cards.
 */
export default function PlayerCard({
  card,
  size = 'md',
  flippable = true,
  className,
}: {
  card: PlayerCardData
  size?: CardSize
  flippable?: boolean
  className?: string
}) {
  const [flipped, setFlipped] = useState(false)
  const w = SIZE_W[size]
  const h = Math.round((w * 7) / 5)
  const skin = SKINS[card.rarity]
  const compact = size === 'xs' || size === 'sm'
  const tiny = size === 'xs'
  const total = useMemo(() => cardTotal(card), [card])

  const fs = w / 200 // font scale relative to md

  return (
    <div
      className={cn('select-none', flippable && 'cursor-pointer', className)}
      style={{ width: w, height: h, perspective: 800 }}
      onClick={() => flippable && setFlipped((f) => !f)}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      >
        {/* ---------------- FRONT ---------------- */}
        <div
          className="absolute inset-0 overflow-hidden rounded-card border"
          style={{
            backfaceVisibility: 'hidden',
            backgroundColor: skin.bg,
            borderColor: skin.frame,
            boxShadow: skin.foil ? `0 0 0 1px ${skin.frame}55, 0 4px 18px rgba(0,0,0,0.5)` : '0 4px 18px rgba(0,0,0,0.4)',
          }}
        >
          {skin.foil && (
            <>
              <div className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-overlay"
                style={{ backgroundImage: 'url(/kira-foil.png)', backgroundSize: 'cover' }} />
              <div className="pointer-events-none absolute inset-0 kira-shine opacity-70" />
            </>
          )}
          <div className="relative flex h-full flex-col" style={{ padding: 8 * fs }}>
            {/* club + emblem chip */}
            <div className="flex items-center gap-1.5" style={{ opacity: 0.95 }}>
              <span className="rounded-[3px] font-mono font-bold"
                style={{ backgroundColor: skin.bar, color: skin.paper ? '#F2EFE7' : skin.bg, fontSize: 8 * fs, padding: `${1.5 * fs}px ${4 * fs}px` }}>
                {card.rarity}
              </span>
              <span className="truncate font-sans font-semibold uppercase"
                style={{ color: skin.sub, fontSize: 9 * fs, letterSpacing: '0.08em' }}>
                {card.club}
              </span>
            </div>
            {/* shirt number */}
            <div className="font-mono font-bold leading-none"
              style={{ color: skin.ink, fontSize: tiny ? 20 * fs : 34 * fs, opacity: 0.92, marginTop: 4 * fs }}>
              {card.number}
            </div>
            {/* name */}
            <div className="font-display font-bold uppercase leading-[0.95]"
              style={{ color: skin.ink, fontSize: tiny ? 12 * fs : 19 * fs, letterSpacing: '0.03em', marginTop: 2 * fs }}>
              {card.name}
            </div>
            {/* position + trait */}
            <div className="flex items-center gap-1.5" style={{ marginTop: 3 * fs }}>
              <span className="rounded-[3px] border font-mono font-bold"
                style={{ borderColor: skin.frame, color: skin.bar, fontSize: 8.5 * fs, padding: `${1 * fs}px ${3.5 * fs}px` }}>
                {card.positions.join('/')}
              </span>
              {!tiny && (
                <span className="truncate italic" style={{ color: skin.sub, fontSize: 8.5 * fs }}>
                  {card.trait}
                </span>
              )}
            </div>
            {!compact && (
              <>
                <div className="mx-auto" style={{ marginTop: 4 * fs }}>
                  <StatRadar stats={card.stats} size={Math.round(96 * fs)} color={skin.bar} ink={skin.ink} showLabels={size === 'lg'} />
                </div>
                <div className="flex flex-col" style={{ gap: 2.5 * fs, marginTop: 5 * fs }}>
                  {STAT_KEYS.map((k, i) => (
                    <div key={k} className="flex items-center" style={{ gap: 4 * fs }}>
                      <span className="font-mono font-bold" style={{ color: skin.sub, fontSize: 8 * fs, width: 20 * fs }}>
                        {STAT_LABELS[i]}
                      </span>
                      <div className="flex-1 overflow-hidden rounded-full" style={{ height: 3 * fs, backgroundColor: `${skin.ink}22` }}>
                        <div className="h-full rounded-full" style={{ width: `${(card.stats[k] / 20) * 100}%`, backgroundColor: skin.bar }} />
                      </div>
                      <span className="font-mono font-bold tnum" style={{ color: skin.ink, fontSize: 8.5 * fs, width: 12 * fs, textAlign: 'right' }}>
                        {card.stats[k]}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="mt-auto flex items-end justify-between">
              <span className="font-mono" style={{ color: skin.sub, fontSize: 8 * fs }}>
                No. {card.cardNo}
              </span>
              <span className="font-mono font-bold tnum" style={{ color: skin.bar, fontSize: 10 * fs }}>
                Σ {total}
              </span>
            </div>
          </div>
        </div>

        {/* ---------------- BACK ---------------- */}
        <div
          className="absolute inset-0 overflow-hidden rounded-card border"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            backgroundColor: skin.bg,
            borderColor: skin.frame,
          }}
        >
          {skin.foil && (
            <div className="pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-overlay"
              style={{ backgroundImage: 'url(/kira-foil.png)', backgroundSize: 'cover' }} />
          )}
          <div className="relative flex h-full flex-col" style={{ padding: 8 * fs }}>
            <div className="font-display font-bold uppercase" style={{ color: skin.ink, fontSize: 13 * fs, letterSpacing: '0.04em' }}>
              {card.name}
            </div>
            <div className="font-mono" style={{ color: skin.sub, fontSize: 8.5 * fs }}>
              {card.version} · No. {card.cardNo}
            </div>
            <div style={{ height: tiny ? 0 : 6 * fs }} />
            {!tiny && (
              <div className="mx-auto" style={{ width: '82%', aspectRatio: '1' }}>
                <PositionPitch positions={card.positions} skin={skin} />
              </div>
            )}
            {!compact && (
              <div className="grid grid-cols-3" style={{ gap: 4 * fs, marginTop: 6 * fs }}>
                {STAT_KEYS.map((k, i) => (
                  <div key={k} className="rounded-[4px] border text-center"
                    style={{ borderColor: `${skin.frame}88`, padding: `${3 * fs}px 0` }}>
                    <div className="font-mono" style={{ color: skin.sub, fontSize: 7.5 * fs }}>{STAT_LABELS[i]}</div>
                    <div className="font-mono font-bold tnum" style={{ color: skin.ink, fontSize: 12 * fs }}>{card.stats[k]}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-auto flex items-center justify-between">
              <span className="italic" style={{ color: skin.sub, fontSize: 8.5 * fs }}>{card.trait}</span>
              <span className="font-mono font-bold tnum" style={{ color: skin.bar, fontSize: 10 * fs }}>Σ {total}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
