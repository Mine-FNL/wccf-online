import { useId, useState } from 'react'

/**
 * Last-10 rating sparkline — 40×16 SVG polyline in accent,
 * hover shows the exact rating points (design: hall-of-fame.md §2).
 */
export default function Sparkline({
  points,
  width = 40,
  height = 16,
}: {
  points: number[]
  width?: number
  height?: number
}) {
  const [hover, setHover] = useState(false)
  const id = useId()
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = Math.max(1, max - min)
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (width - 2) + 1
    const y = height - 2 - ((p - min) / span) * (height - 4)
    return [x, y] as const
  })
  const d = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <svg width={width} height={height} className="block" aria-hidden>
        <path d={d} fill="none" stroke="#FF8A1E" strokeWidth="1.2" strokeLinejoin="round" />
        <circle
          cx={coords[coords.length - 1][0]}
          cy={coords[coords.length - 1][1]}
          r="1.6"
          fill="#FF8A1E"
        />
      </svg>
      {hover && (
        <span
          key={id}
          className="absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-btn border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] text-wccf-ink"
        >
          {points[points.length - 2]} → {points[points.length - 1]}
        </span>
      )}
    </span>
  )
}
