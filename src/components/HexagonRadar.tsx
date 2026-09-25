import { useMemo } from 'react'
import { motion } from 'framer-motion'

/**
 * WCCF team-grid hexagon — the signature 3-zone radar (spec §5).
 * Axes clockwise from top: OFF / DEF / POS / WIN / SPD / POW (0–100).
 *
 * - Green stroked polygon   = formation level (the XI as arranged)
 * - Yellow stroked polygon  = practice level (club training)
 * - Bright green fill       = performance = elementwise min(formation, practice)
 */

export const HEX_AXES = ['OFF', 'DEF', 'POS', 'WIN', 'SPD', 'POW'] as const

const COLOR_FORMATION = '#1E7A4C'
const COLOR_PRACTICE = '#FFC531'
const COLOR_PERFORMANCE = '#3DD68C'
const COLOR_GRID = '#323B4E'
const COLOR_LABEL = '#8A94A7'

export interface TacticArrows {
  lane: 'balanced' | 'left' | 'right' | 'centre'
  stance: 'normal' | 'counter' | 'press'
}

const clamp = (v: number) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0))

export default function HexagonRadar({
  formation,
  practice,
  size = 260,
  showLabels = true,
  arrows,
}: {
  /** Formation zone, 6 values 0–100 in HEX_AXES order. */
  formation: number[]
  /** Practice zone (training), same shape. Optional. */
  practice?: number[]
  size?: number
  showLabels?: boolean
  /** Small tactic arrows on the OFF (lane) and DEF (stance) axes. */
  arrows?: TacticArrows
}) {
  const pad = showLabels ? 30 : 10
  const cx = size / 2
  const cy = size / 2
  const R = size / 2 - pad

  const pt = (i: number, f: number) => {
    const a = (Math.PI / 3) * i - Math.PI / 2
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f] as const
  }
  const ring = (f: number) => Array.from({ length: 6 }, (_, i) => pt(i, f).join(',')).join(' ')
  const polyOf = (vals: number[]) =>
    vals.map((v, i) => pt(i, Math.max(0.04, clamp(v) / 100)).join(',')).join(' ')

  const formVals = useMemo(() => HEX_AXES.map((_, i) => clamp(formation[i] ?? 0)), [formation])
  const pracVals = useMemo(
    () => (practice ? HEX_AXES.map((_, i) => clamp(practice[i] ?? 0)) : null),
    [practice],
  )
  const perfVals = useMemo(
    () => (pracVals ? formVals.map((v, i) => Math.min(v, pracVals[i])) : formVals),
    [formVals, pracVals],
  )

  const formPoly = polyOf(formVals)
  const pracPoly = pracVals ? polyOf(pracVals) : null
  const perfPoly = polyOf(perfVals)

  /* tactic arrow anchors: OFF axis = index 0 (top), DEF axis = index 1 */
  const [offX, offY] = pt(0, 1.02)
  const [defX, defY] = pt(1, 1.06)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Team hexagon — formation, practice and performance zones"
      className="select-none"
    >
      {/* gridlines at 25 / 50 / 75 / 100 */}
      {[1, 0.75, 0.5, 0.25].map((f) => (
        <polygon
          key={f}
          points={ring(f)}
          fill="none"
          stroke={COLOR_GRID}
          strokeOpacity={f === 1 ? 0.9 : 0.45}
          strokeWidth={1}
        />
      ))}
      {HEX_AXES.map((_, i) => {
        const [x, y] = pt(i, 1)
        return (
          <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={COLOR_GRID} strokeOpacity={0.5} strokeWidth={1} />
        )
      })}

      {/* performance — bright green translucent fill (min of the two zones) */}
      <motion.polygon
        initial={false}
        animate={{ points: perfPoly }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        fill={COLOR_PERFORMANCE}
        fillOpacity={pracVals ? 0.34 : 0.14}
        stroke={COLOR_PERFORMANCE}
        strokeOpacity={pracVals ? 0.9 : 0.4}
        strokeWidth={1}
      />
      {/* formation — green stroked */}
      <motion.polygon
        initial={false}
        animate={{ points: formPoly }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        fill="none"
        stroke={COLOR_FORMATION}
        strokeWidth={2}
      />
      {/* practice — yellow stroked */}
      {pracPoly && (
        <motion.polygon
          initial={false}
          animate={{ points: pracPoly }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          fill="none"
          stroke={COLOR_PRACTICE}
          strokeWidth={1.5}
          strokeDasharray="5 3"
        />
      )}

      {/* vertex dots on the formation zone */}
      {formVals.map((v, i) => {
        const [x, y] = pt(i, Math.max(0.04, v / 100))
        return <circle key={i} cx={x} cy={y} r={2.4} fill={COLOR_FORMATION} />
      })}

      {/* tactic arrows */}
      {arrows && arrows.lane !== 'balanced' && (
        <g stroke={COLOR_PERFORMANCE} fill={COLOR_PERFORMANCE}>
          {arrows.lane === 'left' && (
            <path d={`M ${offX + 7} ${offY - 4} h 14 M ${offX + 7} ${offY - 4} l 5 -4 M ${offX + 7} ${offY - 4} l 5 4`} fill="none" strokeWidth={2} strokeLinecap="round" />
          )}
          {arrows.lane === 'right' && (
            <path d={`M ${offX - 21} ${offY - 4} h 14 M ${offX - 7} ${offY - 4} l -5 -4 M ${offX - 7} ${offY - 4} l -5 4`} fill="none" strokeWidth={2} strokeLinecap="round" />
          )}
          {arrows.lane === 'centre' && (
            <path d={`M ${offX} ${offY + 2} v -13 M ${offX} ${offY - 11} l -4 5 M ${offX} ${offY - 11} l 4 5`} fill="none" strokeWidth={2} strokeLinecap="round" />
          )}
        </g>
      )}
      {arrows && arrows.stance !== 'normal' && (
        <g stroke={COLOR_PRACTICE} fill={COLOR_PRACTICE}>
          {arrows.stance === 'press' && (
            <>
              <circle cx={defX} cy={defY - 6} r={6} fill="none" strokeWidth={2} />
              <circle cx={defX} cy={defY - 6} r={1.8} stroke="none" />
            </>
          )}
          {arrows.stance === 'counter' && (
            <path d={`M ${defX} ${defY - 13} v 12 M ${defX} ${defY - 1} l -4 -5 M ${defX} ${defY - 1} l 4 -5`} fill="none" strokeWidth={2} strokeLinecap="round" />
          )}
        </g>
      )}

      {/* axis labels */}
      {showLabels &&
        HEX_AXES.map((label, i) => {
          const [x, y] = pt(i, 1.2)
          return (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fontFamily="'JetBrains Mono', monospace"
              fontWeight={700}
              letterSpacing="0.08em"
              fill={COLOR_LABEL}
            >
              {label} {formVals[i]}
            </text>
          )
        })}
    </svg>
  )
}
