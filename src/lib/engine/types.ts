/**
 * WCCF match engine — type contracts (design.md §8).
 *
 * The engine is a deterministic, seeded, client-side simulator:
 * the same (seed, homeXI, awayXI) always produces the same timeline, so every
 * visitor watching a cabinet sees the SAME match at the SAME minute.
 */
import type { PlayerStats, Position } from '../data/types'

/** A player as the engine sees them (derived from a WCCF card). */
export interface EnginePlayer {
  name: string
  number: number
  position: Position
  stats: PlayerStats
}

/** Structural subset of a WCCF card the engine needs to build teams. */
export type PlayerCardDataLike = Pick<
  import('../data/types').PlayerCardData,
  'name' | 'number' | 'positions' | 'stats'
>

/** Team description handed to the simulator. */
export interface TeamInput {
  name: string
  /** 3–4 letter broadcast abbreviation for the scorebug */
  short: string
  /** club color chip, hex */
  color: string
  xi: EnginePlayer[]
}

/** Squad strength derived from the XI's stats — drives match probabilities. */
export interface SquadStrength {
  attack: number // 0..100
  midfield: number
  defense: number
  keeper: number
  stamina: number
  overall: number
}

export type TeamSide = 'home' | 'away'

export type MatchEventKind =
  | 'kickoff'
  | 'goal'
  | 'chance' // shot on target, saved
  | 'miss' // shot off target
  | 'yellow'
  | 'red'
  | 'sub'
  | 'halftime'
  | 'fulltime'
  | 'info'

export interface MatchEvent {
  /** match clock seconds */
  t: number
  /** displayed minute, e.g. 67 (stoppage shown via `stoppage` flag) */
  minute: number
  stoppage: boolean
  kind: MatchEventKind
  team: TeamSide | null
  player?: string
  assist?: string
  /** rendered commentary line */
  text: string
}

/** Live per-player render state (drawer XI lists). */
export interface PlayerLive {
  name: string
  number: number
  position: Position
  /** 0..100 strength gauge = overall of the card */
  strength: number
  /** 0..100, drains live */
  stamina: number
  card: 'yellow' | 'red' | null
  subbedOff: boolean
  subbedOn: boolean
  subMinute: number | null
}

export type MatchPhase = 'pre' | 'playing' | 'halftime' | 'fulltime'

/** 1 Hz renderable snapshot — everything a MatchViewer needs for one frame. */
export interface MatchState {
  clock: number // seconds of match clock
  displayClock: string // "67:24" (may exceed 45/90 in stoppage)
  displayMinute: number
  half: 1 | 2
  phase: MatchPhase
  score: { home: number; away: number }
  /** home share 0..1 (e.g. 0.54) */
  possession: number
  /** ball on the pitch plane, 0..1 in both axes (x: home goal → away goal) */
  ball: { x: number; y: number }
  /** events with t <= clock, newest first */
  events: MatchEvent[]
  /** most recent non-info event, for the commentary ticker line */
  headline: MatchEvent | null
  homeXI: PlayerLive[]
  awayXI: PlayerLive[]
  strengthHome: SquadStrength
  strengthAway: SquadStrength
}

/**
 * Fully simulated match. Simulate once with `createMatch`, then query
 * `stateAt(timeline, clock)` at 1 Hz. Reused by Theatre replays and the
 * seat match flow.
 */
export interface MatchTimeline {
  seed: number
  home: TeamInput
  away: TeamInput
  strengthHome: SquadStrength
  strengthAway: SquadStrength
  /** all events, ascending by t */
  events: MatchEvent[]
  /** end of regulation + stoppage, seconds */
  duration: number
  /** seconds in half 1 (incl. 1st-half stoppage) */
  halfOneEnd: number
  finalScore: { home: number; away: number }
  /** 100 - rate * minutesPlayed, per XI slot, home then away */
  staminaRates: number[]
  /** per-player booking minute (or -1), per XI slot */
  bookingAt: Int32Array
  /** substitution map: slot index -> { minute, name, number } */
  subs: { slot: number; side: TeamSide; minute: number; onName: string; onNumber: number }[]
  /** ball track sampled at 1 Hz: [x0,y0,x1,y1,...] */
  ballTrack: Float32Array
  /** home possession share sampled every 5 s */
  possessionTrack: Float32Array
}

/** A dot on the top-down pitch view (viewer-side, derived from state). */
export interface PitchDot {
  side: TeamSide | 'ball'
  x: number
  y: number
}
