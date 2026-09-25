/**
 * PitchView — the match screen's center pitch (spec §2): top-down dark-felt
 * view in the v1 viewer's visual language. Player chips carry shirt numbers
 * and sit on formation anchors, drifting toward the ball (the v1
 * `pitchDots` math, ported to run off the live stepper state: seed + clock
 * + ball + your formation anchors). The pitch edge flashes orange while our
 * attack window is open, blue while we defend.
 */
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { formationSlots } from '@/lib/arrangement'
import type { MatchState2 } from '@/lib/engine2'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** mirrored 4-4-2 anchors for the opponent (v1 sim.ts FORMATION_442) */
const AWAY_442: [number, number][] = [
  [0.94, 0.5],
  [0.78, 0.16], [0.8, 0.39], [0.8, 0.61], [0.78, 0.84],
  [0.54, 0.14], [0.57, 0.4], [0.57, 0.6], [0.54, 0.86],
  [0.32, 0.36], [0.32, 0.64],
]

interface Chip {
  side: 'home' | 'away'
  x: number
  y: number
  slot: number
}

/** v1 pitchDots drift math, live-state edition (pure in seed+clock+ball). */
function liveChips(
  seed: number,
  clock: number,
  ball: { x: number; y: number },
  homeAnchors: [number, number][],
): Chip[] {
  const t = clock
  const chips: Chip[] = []
  for (const side of ['home', 'away'] as const) {
    const mirror = side === 'away'
    for (let i = 0; i < 11; i++) {
      const [ax0, ay] = mirror ? AWAY_442[i] : homeAnchors[i]
      const ax = mirror ? ax0 : ax0
      const ph = ((seed >> (i % 24)) & 0xff) / 40 + i * 1.7
      const w1 = 0.11 + (i % 5) * 0.017
      const w2 = 0.09 + (i % 3) * 0.021
      const pull = i === 0 ? 0.04 : 0.22
      const tx = mirror ? 1 - ball.x : ball.x
      const x = ax + (tx - ax) * pull * 0.5 + Math.sin(t * w1 + ph) * (i === 0 ? 0.008 : 0.028)
      const y = ay + (ball.y - ay) * pull * 0.35 + Math.cos(t * w2 + ph * 1.3) * (i === 0 ? 0.01 : 0.05)
      chips.push({ side, x: clamp(x, 0.03, 0.97), y: clamp(y, 0.04, 0.96), slot: i })
    }
  }
  return chips
}

export default function PitchView({
  snap,
  seed,
  formation,
  homeColor,
}: {
  snap: MatchState2
  seed: number
  /** human club formation — home chip anchors */
  formation: string
  homeColor: string
}) {
  const homeAnchors = useMemo<[number, number][]>(
    () => formationSlots(formation).map((s) => [s.x, s.y]),
    [formation],
  )
  const chips = useMemo(
    () => liveChips(seed, snap.clock, snap.ball, homeAnchors),
    [seed, snap.clock, snap.ball, homeAnchors],
  )

  const winSide = snap.window?.side ?? null

  return (
    <div
      className={cn(
        'relative aspect-video w-full overflow-hidden rounded-card border bg-inset transition-[border-color,box-shadow] duration-200',
        winSide === 'home' && 'border-accent shadow-[0_0_28px_rgba(255,138,30,0.45),inset_0_0_30px_rgba(255,138,30,0.18)]',
        winSide === 'away' && 'border-[#4DD0E1] shadow-[0_0_28px_rgba(77,208,225,0.4),inset_0_0_30px_rgba(77,208,225,0.16)]',
        !winSide && 'border-line',
      )}
    >
      <img
        src="/pitch-texture.svg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-90"
        draggable={false}
      />

      {/* player chips */}
      {chips.map((c) => {
        const live = c.side === 'home' ? snap.homeXI[c.slot] : snap.awayXI[c.slot]
        const out = live?.subbedOff || live?.sentOff
        return (
          <span
            key={`${c.side}-${c.slot}`}
            className="absolute flex items-center justify-center rounded-[4px] font-mono text-[8px] font-bold"
            style={{
              width: 17,
              height: 13,
              left: `${c.x * 100}%`,
              top: `${c.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              transition: 'left 500ms ease, top 500ms ease',
              backgroundColor: c.side === 'home' ? homeColor : '#3A4356',
              color: c.side === 'home' ? '#0B0E14' : '#B8C0CF',
              boxShadow:
                c.side === 'home'
                  ? `0 0 6px ${homeColor}77`
                  : '0 0 4px rgba(138,148,167,0.5)',
              opacity: out ? 0.3 : 1,
            }}
          >
            {live?.number ?? ''}
          </span>
        )
      })}

      {/* ball */}
      <span
        className="absolute h-[6px] w-[6px] rounded-full bg-[#E8ECF4]"
        style={{
          left: `${snap.ball.x * 100}%`,
          top: `${snap.ball.y * 100}%`,
          transform: 'translate(-50%, -50%)',
          transition: 'left 300ms ease, top 300ms ease',
          boxShadow: '0 0 6px rgba(232,236,244,0.9)',
        }}
      />

      {/* window banner */}
      {snap.window && (
        <div className="absolute left-1/2 top-2 -translate-x-1/2">
          <span
            className={cn(
              'rounded-full px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em]',
              winSide === 'home' ? 'bg-accent-dim text-accent' : 'bg-[rgba(77,208,225,0.14)] text-[#4DD0E1]',
            )}
          >
            {winSide === 'home'
              ? `Chance — ${snap.window.shooter}`
              : `Danger — ${snap.window.shooter} at ${snap.window.keeper}`}
          </span>
        </div>
      )}
    </div>
  )
}
