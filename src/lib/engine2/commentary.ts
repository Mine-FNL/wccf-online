/**
 * engine2 commentary — extends the v1 broadcast lines with the interactive
 * systems: chance windows, steals, tactics, team talks, styles, skills,
 * hotlines, breaks and PK drama. Tone: terse broadcast English.
 * All functions are pure; the simulator passes its seeded RNG in.
 */
import type { TacticState, TeamSide } from './types'

type Rand = () => number

const pick = <T,>(arr: readonly T[], rand: Rand): T =>
  arr[Math.floor(rand() * arr.length)]

/* ---------------- chance windows ---------------- */

export function windowOpenLine(rand: Rand, player: string, team: string): string {
  return pick(
    [
      `Chance building for ${team}… the crowd urges the shot!`,
      `${player} finds space — ${team} can pull the trigger here!`,
      `Opening for ${team}! ${player} wants the ball…`,
      `${team} pour forward — this is the moment!`,
    ],
    rand,
  )
}

export function windowFizzleLine(rand: Rand, team: string): string {
  return pick(
    [
      `No shot comes — the ${team} move fizzles out.`,
      `${team} hesitate… and the window slams shut.`,
      `The chance goes begging for ${team}.`,
    ],
    rand,
  )
}

export function keeperRushLine(rand: Rand, keeper: string): string {
  return pick(
    [
      `${keeper} is rushing out to narrow the angle!`,
      `Here comes ${keeper} — all or nothing!`,
    ],
    rand,
  )
}

/* ---------------- tactics & steals ---------------- */

export function tacticLine(rand: Rand, team: string, tactic: TacticState): string {
  const laneText =
    tactic.lane === 'left'
      ? `${team} switch play down the left flank.`
      : tactic.lane === 'right'
        ? `${team} switch play down the right flank.`
        : tactic.lane === 'centre'
          ? `${team} look to break through the middle.`
          : `${team} balance their attack across the pitch.`
  const stanceText =
    tactic.stance === 'counter'
      ? `${team} sit in and wait for the counter.`
      : tactic.stance === 'press'
        ? `${team} press high up the pitch.`
        : `${team} return to their normal shape.`
  return pick([laneText, stanceText], rand)
}

export function stealLine(rand: Rand, player: string, team: string): string {
  return pick(
    [
      `${player} wins it back — the ${team} press bites!`,
      `Stolen by ${player}! ${team} swarm the ball.`,
      `${player} picks a pocket. ${team} are hunting in packs.`,
    ],
    rand,
  )
}

/* ---------------- half-time ---------------- */

export const TALK_NAMES = [
  'Push higher',
  'Stay calm, keep the ball',
  'Win every duel',
] as const

export function talkLine(choice: 0 | 1 | 2, team: string): string {
  return `The ${team} manager at the break: "${TALK_NAMES[choice]}."`
}

/** 2012-13 halftime flavor events — small scripted drama. */
export type HalftimeFlavor = 'injury-scare' | 'argument' | 'youngster'

export function halftimeFlavorLine(
  rand: Rand,
  flavor: HalftimeFlavor,
  team: string,
  player: string,
): string {
  switch (flavor) {
    case 'injury-scare':
      return `Scare for ${team}: ${player} is having his ankle strapped — he'll continue.`
    case 'argument':
      return pick(
        [
          `Raised voices in the ${team} dressing room — the manager restores order.`,
          `${player} is furious with the marking. ${team} clear the air at the break.`,
        ],
        rand,
      )
    case 'youngster':
      return `The ${team} youngster ${player} is shining — the bench are on their feet applauding.`
  }
}

/* ---------------- KP era: styles & special ---------------- */

export function styleLine(styleName: string, team: string, rank: string): string {
  return `${team} activate Team Style "${styleName}" (rank ${rank}).`
}

export function specialLine(team: string): string {
  return `SPECIAL COMMAND! ${team} burn their SPIRIT — the next chance will be golden!`
}

/* ---------------- Footista ---------------- */

export function skillLine(player: string, trait: string): string {
  return `${player} — "${trait}"! He's everywhere right now.`
}

export function hotlineLine(team: string, count: number): string {
  return `${team} open a hotline — ${count} players linked up.`
}

export function breakLine(rand: Rand, player: string, team: string): string {
  return pick(
    [
      `BREAK! ${player} smashes the ${team} hotline apart!`,
      `${player} reads the link play — the ${team} hotline is destroyed!`,
    ],
    rand,
  )
}

export function manmarkLine(marker: string, target: string): string {
  return `${marker} is glued to ${target} — man-marking orders.`
}

/* ---------------- PK shootout ---------------- */

export function pkIntroLine(rand: Rand, home: string, away: string): string {
  return pick(
    [
      `We're going to penalties — ${home} v ${away}. Nerves of steel required.`,
      `Nothing between them! ${home} and ${away} head to a shootout.`,
    ],
    rand,
  )
}

export function pkLine(
  rand: Rand,
  player: string,
  scored: boolean,
  round: number,
): string {
  if (scored) {
    return pick(
      [
        `Round ${round}: ${player} scores from the spot!`,
        `Round ${round}: ${player} sends the keeper the wrong way!`,
        `Round ${round}: cool as you like from ${player}.`,
      ],
      rand,
    )
  }
  return pick(
    [
      `Round ${round}: ${player} misses! The crowd can't watch.`,
      `Round ${round}: SAVED! ${player} is denied!`,
      `Round ${round}: ${player} crashes it off the woodwork!`,
    ],
    rand,
  )
}

export function pkWinnerLine(team: string, hs: number, as: number): string {
  return `${team} win the shootout ${hs}–${as}!`
}

export const sideName = (side: TeamSide, home: string, away: string) =>
  side === 'home' ? home : away
