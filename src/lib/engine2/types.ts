/**
 * engine2 — interactive WCCF arcade match stepper (gameplay-fidelity-spec §7).
 *
 * Deterministic + interactive: the same (seed, teams, command log) always
 * produces the identical event list and final score. engine v1
 * (`src/lib/engine/`) stays untouched for the lobby spectator sim.
 */
import type {
  EnginePlayer,
  MatchEventKind,
  PlayerLive,
  SquadStrength,
  TeamSide,
} from '../engine/types'
import type { Position, PlayerStats } from '../data/types'

/* ------------------------------------------------------------------ */
/* Teams                                                               */
/* ------------------------------------------------------------------ */

/** Engine player with the card's identity + trait (Footista C SKILL). */
export interface EnginePlayer2 extends EnginePlayer {
  id?: string
  trait?: string
}

export type Era = 'classic' | 'kp' | 'footista'

/** Condition arrows shown pre-match (↑↗→↘↓) — ±10% individual stats. */
export type Arrow = 'up' | 'up-right' | 'flat' | 'down-right' | 'down'

/** KP-era Team Style, ranked E→S through use. */
export interface Style {
  name: string
  rank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S'
}

export type Lane = 'balanced' | 'left' | 'right' | 'centre'
export type Stance = 'normal' | 'counter' | 'press'

export interface TacticState {
  lane: Lane
  stance: Stance
}

/** Pre-match management phase effects (spec §3.0), pre-applied. */
export interface Management {
  teamAction?: 'practice' | 'rest'
  individual?: { slot: number; stat: keyof PlayerStats }[]
}

/** Team description handed to the interactive stepper. */
export interface TeamInput2 {
  name: string
  /** 3–4 letter broadcast abbreviation for the scorebug */
  short: string
  /** club color chip, hex */
  color: string
  xi: EnginePlayer2[]
  /** the 5 sub cards on the panel */
  bench: EnginePlayer2[]
  era?: Era
  /** KP era: one style per Off/Def/Sup slot */
  styles?: { off?: Style; def?: Style; sup?: Style }
  /** Footista: the 3 chosen manager abilities (of the 14) */
  abilities?: string[]
  /** seeded pre-match condition arrows per XI slot; generated if absent */
  condition?: Arrow[]
  /** initial spirit / morale 0–100 (default 55 ± seeded condition) */
  spirit?: number
  /** hexagon practice levels 0–100 per axis (OFF/DEF/POS/WIN/SPD/POW) */
  practiceLevels?: number[]
  /** initial line nudges from the card arrangement, each ∈ {-1,0,1} */
  lineNudges?: { df: number; mf: number; fw: number }
  management?: Management
}

/* ------------------------------------------------------------------ */
/* Commands (§7)                                                       */
/* ------------------------------------------------------------------ */

export type Command =
  | { type: 'tactic'; tactic: TacticState }
  | { type: 'shoot'; quality: number }
  | { type: 'keeper'; quality: number; rush?: boolean }
  | { type: 'sub'; outSlot: number; inCardId: string }
  | { type: 'teamtalk'; choice: 0 | 1 | 2 }
  /** KP era: activate the rubbed card's Team Style (one per slot) */
  | { type: 'style'; slot: 'off' | 'def' | 'sup' }
  /** KP era: long-press at SPIRIT ≥ 95 — next window conversion ×2.5 */
  | { type: 'special' }
  /** Footista C: trigger the touched player's card trait for 10 s */
  | { type: 'skill'; slot: number }
  /** Footista D: link ≤3 player slots for 20 s */
  | { type: 'hotline'; slots: number[] }
  /** Footista E: mark the opponent's top scorer for 30 s */
  | { type: 'manmark' }
  /** Footista B: 15 s team press burst */
  | { type: 'press' }

export type CommandLogEntry = Command & { at: number }

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

export type MatchEvent2Kind =
  | MatchEventKind
  | 'window-open'
  | 'window-resolve'
  | 'tactic'
  | 'steal'
  | 'talk'
  | 'style'
  | 'skill'
  | 'hotline'
  | 'break'
  | 'pk'

export interface MatchEvent2 {
  /** match clock seconds */
  t: number
  /** displayed minute */
  minute: number
  stoppage: boolean
  kind: MatchEvent2Kind
  team: TeamSide | null
  player?: string
  assist?: string
  /** rendered commentary line */
  text: string
  /** structured payload: window quality/outcome, tactic value, pk round… */
  data?: Record<string, unknown>
}

/* ------------------------------------------------------------------ */
/* Chance windows (§3.4)                                               */
/* ------------------------------------------------------------------ */

export interface ChanceWindow {
  /** attacking side; the other side defends with the keeper meter */
  side: TeamSide
  /** match clock when the window opened (clock freezes while open) */
  opensAt: number
  /** real seconds remaining at 1× (2.5 s window) */
  remainReal: number
  /** total real duration of the window */
  durationReal: number
  shooter: string
  keeper: string
  /** quality 0..1 once the attacker pressed SHOOT (null = not yet) */
  attackQuality: number | null
  /** quality 0..1 once the defender pressed GK (null = not yet) */
  keeperQuality: number | null
  /** keeper rushing out (hold ≥0.8 s) */
  rush: boolean
}

/* ------------------------------------------------------------------ */
/* PK shootout (§3.8)                                                  */
/* ------------------------------------------------------------------ */

export interface PKKick {
  round: number
  side: TeamSide
  player: string
  scored: boolean
}

export interface PKState {
  round: number
  kicks: PKKick[]
  score: { home: number; away: number }
  decided: boolean
  winner: TeamSide | null
}

/* ------------------------------------------------------------------ */
/* Hexagon (§5)                                                        */
/* ------------------------------------------------------------------ */

/** Axes order: Offence / Defence / Possession / Winning / Speed / Power. */
export interface Hexagon {
  formation: number[]
  practice: number[]
  performance: number[]
}

/* ------------------------------------------------------------------ */
/* State / timeline                                                    */
/* ------------------------------------------------------------------ */

export type MatchPhase2 = 'pre' | 'playing' | 'halftime' | 'pk' | 'fulltime'

export interface PlayerLive2 extends PlayerLive {
  id?: string
  trait?: string
  condition: Arrow
  sentOff?: boolean
}

/** Live snapshot — everything the match screen needs for one frame. */
export interface MatchState2 {
  clock: number
  displayClock: string
  displayMinute: number
  half: 1 | 2
  phase: MatchPhase2
  score: { home: number; away: number }
  /** home share 0..1 */
  possession: number
  /** ball on the pitch plane, 0..1 (x: home goal → away goal) */
  ball: { x: number; y: number }
  /** vertical third the ball is in */
  lane: 'left' | 'centre' | 'right'
  /** events with t <= clock, newest first */
  events: MatchEvent2[]
  headline: MatchEvent2 | null
  homeXI: PlayerLive2[]
  awayXI: PlayerLive2[]
  strengthHome: SquadStrength
  strengthAway: SquadStrength
  tacticHome: TacticState
  tacticAway: TacticState
  spiritHome: number
  spiritAway: number
  window: ChanceWindow | null
  /** home side hexagon (OFF/DEF/POS/WIN/SPD/POW) */
  hexagon: Hexagon
  hexagonAway: Hexagon
  conditionHome: Arrow[]
  conditionAway: Arrow[]
  stylesActive: {
    home: { off: boolean; def: boolean; sup: boolean }
    away: { off: boolean; def: boolean; sup: boolean }
  }
  abilitiesActive: { home: string[]; away: string[] }
  /** Footista instruction cost pools, 0–100, regen 6/s */
  instructionCost: { home: number; away: number }
  /** linked player slots while a hotline is up (≤3) */
  hotline: number[] | null
  hotlineAway: number[] | null
  subsUsed: { home: number; away: number }
  pk: PKState | null
}

/** Fully simulated interactive match. */
export interface MatchTimeline2 {
  seed: number
  home: TeamInput2
  away: TeamInput2
  strengthHome: SquadStrength
  strengthAway: SquadStrength
  /** all events, ascending by t */
  events: MatchEvent2[]
  /** end of regulation + stoppage, seconds */
  duration: number
  /** seconds in half 1 (incl. 1st-half stoppage) */
  halfOneEnd: number
  finalScore: { home: number; away: number }
  result: 'home' | 'away' | 'draw'
  pk: PKState | null
  /** every command received, with its match-clock timestamp */
  commandLog: CommandLogEntry[]
  /** 100 - rate * minutesPlayed, per XI slot, home then away */
  staminaRates: number[]
  subs: {
    slot: number
    side: TeamSide
    minute: number
    onName: string
    onNumber: number
  }[]
}

/* ------------------------------------------------------------------ */
/* Stepper                                                             */
/* ------------------------------------------------------------------ */

export interface StepperOptions {
  /** cup match: level at full time → PK shootout */
  cup?: boolean
  /** AI/spectator sides auto-press windows + auto-tactic (default true) */
  aiHome?: boolean
  aiAway?: boolean
}

export interface Stepper {
  state(): MatchState2
  /** advance by real seconds; returns newly emitted events */
  step(dtRealSeconds: number): MatchEvent2[]
  command(cmd: Command): void
  done(): boolean
  /** valid anytime; complete when done() */
  timeline(): MatchTimeline2
  commandLog(): CommandLogEntry[]
}

export type { EnginePlayer, PlayerLive, Position, SquadStrength, TeamSide }
