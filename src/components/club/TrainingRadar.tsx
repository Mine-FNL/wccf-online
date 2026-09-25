import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { TRAINING_AREAS, TRAINING_KEYS, type TrainingLevels } from './clubUtils'

/**
 * Hexagon radar of the six manager-training areas (0–5 scale).
 * Polygon morphs (600ms) when levels change; faint grid rings overlaid.
 * Shared by My Club training tab and the Clubs detail modal (read-only).
 */
export default function TrainingRadar({
  levels,
  size = 240,
  showLabels = true,
  color = '#FF8A1E',
}: {
  levels: TrainingLevels
  size?: number
  showLabels?: boolean
  color?: string
}) {
  const pad = showLabels ? 26 : 8
  const cx = size / 2
  const cy = size / 2
  const R = size / 2 - pad

  const pt = (i: number, f: number) => {
    const a = (Math.PI / 3) * i - Math.PI / 2
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f] as const
  }

  const ring = (f: number) =>
    Array.from({ length: 6 }, (_, i) => pt(i, f).join(',')).join(' ')

  const poly = useMemo(
    () =>
      TRAINING_KEYS.map((k, i) => pt(i, Math.max(0.05, levels[k] / 5)).join(',')).join(' '),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levels, size],
  )

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Training radar"
    >
      {[1, 0.8, 0.6, 0.4, 0.2].map((f) => (
        <polygon
          key={f}
          points={ring(f)}
          fill="none"
          stroke="#323B4E"
          strokeOpacity={f === 1 ? 0.9 : 0.45}
          strokeWidth={1}
        />
      ))}
      {TRAINING_KEYS.map((_, i) => {
        const [x, y] = pt(i, 1)
        return (
          <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#323B4E" strokeOpacity={0.5} strokeWidth={1} />
        )
      })}
      <motion.polygon
        initial={false}
        animate={{ points: poly, fillOpacity: 0.22 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        fill={color}
        stroke={color}
        strokeWidth={1.5}
      />
      {TRAINING_KEYS.map((k, i) => {
        const v = Math.max(0.05, levels[k] / 5)
        const [x, y] = pt(i, v)
        return <circle key={k} cx={x} cy={y} r={2.5} fill={color} />
      })}
      {showLabels &&
        TRAINING_AREAS.map((a, i) => {
          const [x, y] = pt(i, 1.18)
          return (
            <text
              key={a.key}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fontFamily="'JetBrains Mono', monospace"
              fill="#8A94A7"
            >
              {a.label.slice(0, 3).toUpperCase()} {levels[a.key]}
            </text>
          )
        })}
    </svg>
  )
}
