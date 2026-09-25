import { useEffect, useState } from 'react'

/**
 * Live countdown to a target date — four mono tiles (DD HH MM SS).
 * Each digit cell flips (rotateX 90°→0, 200ms) when its value changes.
 * Pure CSS/WAAPI-free animation via an injected keyframe so this component
 * stays GSAP-compatible inside the pinned hero (no framer-motion mixing).
 */

const FLIP_CSS = `
@keyframes cd-flip {
  from { transform: rotateX(90deg); opacity: 0.2; }
  to { transform: rotateX(0deg); opacity: 1; }
}
`

let cssInjected = false
function injectCss() {
  if (cssInjected || typeof document === 'undefined') return
  const el = document.createElement('style')
  el.textContent = FLIP_CSS
  document.head.appendChild(el)
  cssInjected = true
}

function pad(n: number): string {
  return String(Math.max(0, n)).padStart(2, '0')
}

function parts(target: Date): { d: string; h: string; m: string; s: string } {
  const diff = Math.max(0, target.getTime() - Date.now())
  const total = Math.floor(diff / 1000)
  return {
    d: pad(Math.floor(total / 86400)),
    h: pad(Math.floor((total % 86400) / 3600)),
    m: pad(Math.floor((total % 3600) / 60)),
    s: pad(total % 60),
  }
}

function DigitCell({ ch }: { ch: string }) {
  return (
    <span className="inline-block" style={{ perspective: '120px' }}>
      <span
        key={ch}
        className="inline-block font-mono text-[28px] font-bold leading-none text-wccf-ink tnum min-[768px]:text-[32px]"
        style={{ animation: 'cd-flip 0.2s ease-out', transformOrigin: 'center bottom' }}
      >
        {ch}
      </span>
    </span>
  )
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="cd-tile flex min-w-[64px] flex-col items-center gap-1 rounded-card border border-line bg-raised px-3 py-2.5">
      <span className="flex">
        {value.split('').map((ch, i) => (
          <DigitCell key={i} ch={ch} />
        ))}
      </span>
      <span className="font-sans text-[9px] font-bold uppercase tracking-[0.12em] text-wccf-mute">
        {label}
      </span>
    </div>
  )
}

export default function CountdownFlip({ target }: { target: Date }) {
  injectCss()
  const [now, setNow] = useState(() => parts(target))

  useEffect(() => {
    const t = setInterval(() => setNow(parts(target)), 1000)
    return () => clearInterval(t)
  }, [target])

  return (
    <div className="flex items-center gap-2">
      <Tile value={now.d} label="Days" />
      <span className="font-mono text-xl font-bold text-wccf-mute">:</span>
      <Tile value={now.h} label="Hours" />
      <span className="font-mono text-xl font-bold text-wccf-mute">:</span>
      <Tile value={now.m} label="Min" />
      <span className="font-mono text-xl font-bold text-wccf-mute">:</span>
      <Tile value={now.s} label="Sec" />
    </div>
  )
}
