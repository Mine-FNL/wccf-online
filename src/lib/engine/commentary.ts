/**
 * Commentary line templates for the match engine.
 * All functions are pure; the simulator passes its seeded RNG in.
 */
import type { MatchTimeline } from './types'

type Rand = () => number

const pick = <T,>(arr: readonly T[], rand: Rand): T =>
  arr[Math.floor(rand() * arr.length)]

export function goalLine(
  rand: Rand,
  scorer: string,
  team: string,
  assist: string | null,
): string {
  const openers = [
    `GOAL! ${scorer} finds the net for ${team}!`,
    `IT'S IN! ${scorer} with a clinical finish!`,
    `${scorer} scores! ${team} are celebrating!`,
    `Brilliant from ${scorer} — that's a goal for ${team}!`,
  ]
  const line = pick(openers, rand)
  return assist ? `${line} Assist: ${assist}.` : line
}

export function chanceLine(rand: Rand, player: string, keeper: string): string {
  return pick(
    [
      `${player} turns his marker… still going… SAVED by ${keeper}!`,
      `${player} lets it fly — ${keeper} gets down well!`,
      `Big chance! ${player} forces a strong hand from ${keeper}.`,
      `${player} through on goal… ${keeper} says no!`,
    ],
    rand,
  )
}

export function missLine(rand: Rand, player: string): string {
  return pick(
    [
      `${player} drags it wide of the far post.`,
      `${player} skies it over the bar — head in hands.`,
      `Just wide from ${player}. The crowd gasps.`,
      `${player} bends one… inches past the upright.`,
    ],
    rand,
  )
}

export function yellowLine(rand: Rand, player: string): string {
  return pick(
    [
      `${player} goes into the book for a late challenge.`,
      `Yellow card — ${player} stopped the counter the hard way.`,
      `The referee reaches for his pocket. ${player} is cautioned.`,
    ],
    rand,
  )
}

export function redLine(rand: Rand, player: string): string {
  return pick(
    [
      `RED CARD! ${player} is sent off!`,
      `It's all kicking off — ${player} sees red!`,
    ],
    rand,
  )
}

export function subLine(off: string, on: string, team: string): string {
  return `Substitution for ${team}: ${on} replaces ${off}.`
}

export function kickoffLine(home: string, away: string): string {
  return `We're underway — ${home} v ${away}.`
}

export function halftimeLine(home: string, hs: number, as: number): string {
  return `Half-time at the cabinet: ${home} ${hs} — ${as}.`
}

export function fulltimeLine(home: string, away: string, hs: number, as: number): string {
  return `Full-time: ${home} ${hs} — ${as} ${away}.`
}

/** "67:24" style clock. Stoppage time runs past 45:00 / 90:00 like TV. */
export function formatClock(tl: MatchTimeline, clock: number): string {
  const c = Math.max(0, Math.min(clock, tl.duration))
  const m = Math.floor(c / 60)
  const s = Math.floor(c % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function halfAt(tl: MatchTimeline, clock: number): 1 | 2 {
  return clock <= tl.halfOneEnd ? 1 : 2
}

export function phaseAt(
  tl: MatchTimeline,
  clock: number,
): 'pre' | 'playing' | 'halftime' | 'fulltime' {
  if (clock < 0) return 'pre'
  if (clock > tl.duration) return 'fulltime'
  if (clock > tl.halfOneEnd && clock <= tl.halfOneEnd + 60) return 'halftime'
  return 'playing'
}
