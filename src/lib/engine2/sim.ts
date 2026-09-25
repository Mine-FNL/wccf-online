/**
 * engine2 — deterministic, interactive WCCF arcade match stepper
 * (gameplay-fidelity-spec §3, §4, §5, §7).
 *
 * Usage (seat match):
 *   const st = createStepper(seed, home, away, { cup: false, aiAway: true, aiHome: false })
 *   // rAF loop: const fresh = st.step(dt); render(st.state())
 *   // button console: st.command({ type: 'shoot', quality })
 *
 * Usage (Theatre replay / tests):
 *   const tl = createMatch2(seed, home, away, storedCommandLog)
 *
 * Determinism: every command mixes entropy into the tick RNG
 * (`mix(hashSeed(seed:clock:cmd))`) and every chance window resolves from a
 * dedicated sub-stream seeded by (seed, window#), so identical command logs
 * replay byte-identically while untimed button noise cannot leak
 * nondeterminism into the event stream.
 */
import { hashSeed, mulberry32, squadStrength } from '../engine/sim'
import {
  chanceLine,
  fulltimeLine,
  goalLine,
  halftimeLine,
  kickoffLine,
  missLine,
  redLine,
  subLine,
  yellowLine,
} from '../engine/commentary'
import type { EnginePlayer, SquadStrength, TeamSide } from '../engine/types'
import { computeHexagon, type LineNudges } from './hexagon'
import {
  breakLine,
  halftimeFlavorLine,
  hotlineLine,
  keeperRushLine,
  manmarkLine,
  pkIntroLine,
  pkLine,
  pkWinnerLine,
  skillLine,
  specialLine,
  stealLine,
  styleLine,
  tacticLine,
  talkLine,
  windowFizzleLine,
  windowOpenLine,
  type HalftimeFlavor,
} from './commentary'
import type {
  Arrow,
  ChanceWindow,
  Command,
  CommandLogEntry,
  EnginePlayer2,
  Hexagon,
  MatchEvent2,
  MatchPhase2,
  MatchState2,
  MatchTimeline2,
  PKState,
  PlayerLive2,
  Stepper,
  StepperOptions,
  Style,
  TacticState,
  TeamInput2,
} from './types'

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ */
/* Tunables                                                            */
/* ------------------------------------------------------------------ */

/** match-clock seconds per real second — full match ≈ 165 s at 1× */
const RATE = 35
/** chance window length in real seconds (§3.4) */
const WINDOW_REAL = 2.5
/** half-time break in real seconds (6 s auto-pick, §3.5) */
const HT_REAL = 6
/** baseline share of chances that become goals */
const CONVERSION = 0.3

const STYLE_MULT: Record<Style['rank'], number> = {
  E: 1.0,
  D: 1.05,
  C: 1.1,
  B: 1.18,
  A: 1.27,
  S: 1.4,
}

const ARROW_MULT: Record<Arrow, number> = {
  up: 1.1,
  'up-right': 1.05,
  flat: 1,
  'down-right': 0.95,
  down: 0.9,
}

/** SHOOT/GK timing quality → resolution multiplier (§4) */
const qualityTier = (q: number): number =>
  q >= 0.85 ? 1.9 : q >= 0.55 ? 1.3 : q >= 0.25 ? 0.9 : 0.45

/** Footista instruction costs A/B/C/D/E */
const COST = { shoot: 25, press: 20, skill: 30, hotline: 35, manmark: 20 }

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const pickWeighted = <T,>(
  rand: () => number,
  items: T[],
  weight: (x: T) => number,
): T => {
  const ws = items.map(weight)
  const total = ws.reduce((a, b) => a + b, 0)
  let r = rand() * total
  for (let i = 0; i < items.length; i++) {
    r -= ws[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

const keeperOf = (ps: LivePl[]) =>
  ps.find((p) => p.p.position === 'GK') ?? ps[0]

/** re-seedable RNG stream — the tick stream commands mix entropy into */
const mkStream = (seed0: number) => {
  let s = seed0 >>> 0
  let r = mulberry32(s)
  return {
    next: () => r(),
    mix: (h: number) => {
      s = (s ^ h) >>> 0
      r = mulberry32(s)
    },
  }
}

interface LivePl {
  p: EnginePlayer2 // effective (condition-adjusted) stats
  stamina: number
  card: 'yellow' | 'red' | null
  subbedOff: boolean
  subbedOn: boolean
  subMinute: number | null
  drain: number // stamina per match minute
}

interface WindowState extends ChanceWindow {
  elapsed: number
  wr: () => number
  shooterPl: LivePl
  keeperPl: LivePl
  aiShoot: { at: number; q: number } | null
  aiKeep: { at: number; q: number } | null
}

interface Side {
  key: TeamSide
  input: TeamInput2
  ai: boolean
  era: 'classic' | 'kp' | 'footista'
  tactic: TacticState
  spirit: number
  spiritFloor: number
  players: LivePl[]
  bench: EnginePlayer2[]
  sentOff: Set<number>
  subsUsed: number
  cond: Arrow[]
  styles: { off?: Style; def?: Style; sup?: Style }
  stylesActive: { off: boolean; def: boolean; sup: boolean }
  specialPending: boolean
  abilities: string[]
  cost: number
  hotline: number[] | null
  hotlineT: number
  skillSlot: number | null
  skillT: number
  manmarkTarget: number | null // opponent slot being marked
  manmarkT: number
  pressT: number // Footista B burst, real seconds remaining
  talkApplied: boolean
  talkOffsets: number[] // hexagon shifts from the team talk (6 axes)
  lineNudges: LineNudges
  practiceLevels?: number[]
  aiNextTacticAt: number
  aiSubPlan: { slot: number; minute: number }[]
  aiSubBenchIdx: number
}

const other = (s: TeamSide): TeamSide => (s === 'home' ? 'away' : 'home')

/* ------------------------------------------------------------------ */
/* Stepper                                                             */
/* ------------------------------------------------------------------ */

export function createStepper(
  seedInput: number | string,
  home: TeamInput2,
  away: TeamInput2,
  opts: StepperOptions = {},
): Stepper {
  const seed =
    typeof seedInput === 'string' ? hashSeed(seedInput) : seedInput >>> 0
  const rand = mulberry32(seed) // pre-match draws, fixed order
  const userSide: TeamSide = 'home'

  /* ---- pre-match: condition arrows → effective stats → strengths ---- */

  const genArrow = (): Arrow => {
    const r = rand()
    return r < 0.15
      ? 'up'
      : r < 0.35
        ? 'up-right'
        : r < 0.65
          ? 'flat'
          : r < 0.85
            ? 'down-right'
            : 'down'
  }
  const condHome = home.condition ?? home.xi.map(genArrow)
  const condAway = away.condition ?? away.xi.map(genArrow)

  const effPlayer = (
    p: EnginePlayer2,
    arrow: Arrow,
    mgmt?: { slot: number; stat: keyof EnginePlayer['stats'] }[],
    slot?: number,
  ): EnginePlayer2 => {
    const m = ARROW_MULT[arrow]
    const boost =
      mgmt?.find((i) => i.slot === slot)?.stat ?? null
    const s = p.stats
    return {
      ...p,
      stats: {
        off: clamp(s.off * m + (boost === 'off' ? 1 : 0), 0, 20),
        def: clamp(s.def * m + (boost === 'def' ? 1 : 0), 0, 20),
        tec: clamp(s.tec * m + (boost === 'tec' ? 1 : 0), 0, 20),
        pow: clamp(s.pow * m + (boost === 'pow' ? 1 : 0), 0, 20),
        spd: clamp(s.spd * m + (boost === 'spd' ? 1 : 0), 0, 20),
        sta: clamp(s.sta * m + (boost === 'sta' ? 1 : 0), 0, 20),
      },
    }
  }

  const mkLive = (p: EnginePlayer2, stamina: number, drain: number): LivePl => ({
    p,
    stamina,
    card: null,
    subbedOff: false,
    subbedOn: false,
    subMinute: null,
    drain,
  })

  const drainOf = (p: EnginePlayer) =>
    p.position === 'GK'
      ? 0.16 + rand() * 0.06
      : clamp((21 - p.stats.sta) * 0.052 + 0.12 + rand() * 0.06, 0.2, 0.72)

  const homeEff = home.xi.map((p, i) =>
    effPlayer(p, condHome[i] ?? 'flat', home.management?.individual, i),
  )
  const awayEff = away.xi.map((p, i) =>
    effPlayer(p, condAway[i] ?? 'flat', away.management?.individual, i),
  )

  const mkSide = (
    key: TeamSide,
    input: TeamInput2,
    eff: EnginePlayer2[],
    ai: boolean,
  ): Side => {
    const era = input.era ?? 'classic'
    const abilities = input.abilities ?? []
    const spirit0 =
      input.spirit ??
      clamp(
        55 +
          Math.round((rand() - 0.5) * 10) +
          (input.management?.teamAction === 'rest' ? 6 : 0),
        0,
        100,
      )
    const players = eff.map((p) => mkLive(p, 100, drainOf(p)))
    /* AI subs: 55'–82', highest-drain outfielders first (v1 pattern) */
    const aiSubPlan = players
      .map((pl, i) => ({ i, d: pl.drain }))
      .filter((s) => players[s.i].p.position !== 'GK')
      .sort((a, b) => b.d - a.d)
      .slice(0, 3)
      .map((s, k) => ({ slot: s.i, minute: 55 + Math.floor(rand() * 27) + k }))
    return {
      key,
      input,
      ai,
      era,
      tactic: { lane: 'balanced', stance: 'normal' },
      spirit: spirit0,
      spiritFloor: abilities.includes('Leadership') ? 40 : 0,
      players,
      bench: [...(input.bench ?? [])],
      sentOff: new Set(),
      subsUsed: 0,
      cond: key === 'home' ? condHome : condAway,
      styles: input.styles ?? {},
      stylesActive: { off: false, def: false, sup: false },
      specialPending: false,
      abilities,
      cost: 100,
      hotline: null,
      hotlineT: 0,
      skillSlot: null,
      skillT: 0,
      manmarkTarget: null,
      manmarkT: 0,
      pressT: 0,
      talkApplied: false,
      talkOffsets: [0, 0, 0, 0, 0, 0],
      lineNudges: input.lineNudges ?? { df: 0, mf: 0, fw: 0 },
      practiceLevels: input.practiceLevels,
      aiNextTacticAt: 30 + Math.floor(rand() * 10),
      aiSubPlan,
      aiSubBenchIdx: 0,
    }
  }

  const H = mkSide('home', home, homeEff, opts.aiHome ?? true)
  const A = mkSide('away', away, awayEff, opts.aiAway ?? true)
  const sides: Record<TeamSide, Side> = { home: H, away: A }

  let strengthHome = squadStrength(H.players.map((p) => p.p))
  let strengthAway = squadStrength(A.players.map((p) => p.p))

  /* ---- match length / expected goals ---- */

  const stoppage1 = 60 + Math.floor(rand() * 180)
  const stoppage2 = 120 + Math.floor(rand() * 240)
  const halfOneEnd = 45 * 60 + stoppage1
  const duration = halfOneEnd + 45 * 60 + stoppage2

  const xg = (att: SquadStrength, def: SquadStrength) =>
    clamp(1.05 + (att.attack - def.defense) / 34 + (rand() - 0.5) * 0.6, 0.15, 4.2)
  const xgHome = xg(strengthHome, strengthAway)
  const xgAway = xg(strengthAway, strengthHome)
  const pChanceBase = {
    home: xgHome / (duration * CONVERSION),
    away: xgAway / (duration * CONVERSION),
  }

  const possBase = clamp(
    0.5 + (strengthHome.midfield - strengthAway.midfield) / 160,
    0.34,
    0.66,
  )

  /* seeded half-time flavor + auto talk choices */
  const flavors: HalftimeFlavor[] = ['injury-scare', 'argument', 'youngster']
  const htFlavor = flavors[Math.floor(rand() * flavors.length)]
  const htFlavorSide: TeamSide = rand() < 0.5 ? 'home' : 'away'
  const autoTalk = {
    home: Math.floor(rand() * 3) as 0 | 1 | 2,
    away: Math.floor(rand() * 3) as 0 | 1 | 2,
  }

  /* ---- mutable match state ---- */

  const tr = mkStream(hashSeed(`${seed}:play`))
  const events: MatchEvent2[] = []
  const cmdLog: CommandLogEntry[] = []
  const subsTl: MatchTimeline2['subs'] = []
  const staminaRates = [
    ...H.players.map((p) => p.drain),
    ...A.players.map((p) => p.drain),
  ]

  let clock = 0
  let acc = 0
  let phase: MatchPhase2 = 'playing'
  let emitted = 0
  const score = { home: 0, away: 0 }
  let poss = possBase
  let bx = 0.5
  let by = 0.5
  let win: WindowState | null = null
  let winCount = 0
  let lastStoppage = -999
  let htReal = 0
  let htLastTalkReal = -1
  let pkState: PKState | null = null
  let pkReal = 0
  let pkRand: (() => number) | null = null
  let pkOrder: Record<TeamSide, LivePl[]> | null = null

  const minuteOf = (t: number) => Math.floor(t / 60)
  const isStoppage = (t: number) =>
    (t > 45 * 60 && t <= halfOneEnd) || t > halfOneEnd + 45 * 60

  const push = (e: MatchEvent2) => events.push(e)

  push({
    t: 0,
    minute: 0,
    stoppage: false,
    kind: 'kickoff',
    team: null,
    text: kickoffLine(home.name, away.name),
  })

  /* ---- spirit ---- */
  const bumpSpirit = (s: Side, d: number) => {
    s.spirit = clamp(s.spirit + d, s.spiritFloor, 100)
  }

  /* ---- scorer weights: position × off × tactics/skill/manmark ---- */
  const scorerWeight = (s: Side, pl: LivePl, slot: number): number => {
    const p = pl.p
    const posW =
      p.position === 'CF' || p.position === 'FW'
        ? 2.6
        : p.position === 'OMF'
          ? 1.7
          : p.position === 'SMF'
            ? 1.4
            : p.position === 'CMF'
              ? 1.0
              : p.position === 'DMF'
                ? 0.55
                : p.position === 'GK'
                  ? 0.01
                  : 0.35
    let w = posW * (0.5 + p.stats.off / 20)
    /* lane attacks shift scorer weights (§4) */
    if (
      (s.tactic.lane === 'left' || s.tactic.lane === 'right') &&
      (p.position === 'SMF' || p.position === 'FW')
    )
      w *= 1.5
    if (
      s.tactic.lane === 'centre' &&
      (p.position === 'CF' || p.position === 'OMF')
    )
      w *= 1.5
    /* Footista C SKILL: involvement ×2 for 10 s */
    if (s.skillSlot === slot) w *= 2
    /* Footista E MAN-MARK: opponent's top scorer ×0.4 */
    const opp = sides[other(s.key)]
    if (opp.manmarkTarget === slot && opp.manmarkT > 0) w *= 0.4
    return w
  }

  /* ---- chance frequency per tick, with all tactic multipliers (§4) ---- */
  const chanceP = (s: Side): number => {
    const opp = sides[other(s.key)]
    let p = pChanceBase[s.key]
    if (s.tactic.lane !== 'balanced') p *= 1.08 // lane attack: +8% frequency
    if (s.tactic.stance === 'counter' && opp.tactic.lane !== 'balanced')
      p *= 1.6 // counter vs a lane attack
    if (s.tactic.stance === 'press') p *= 1.05
    if (opp.tactic.stance === 'press') p *= 0.85
    if (s.pressT > 0) p *= 1.08 // Footista B burst
    if (opp.pressT > 0) p *= 0.8
    if (s.hotline) p *= 1.15 // hotline: +15% chance creation
    if (s.stylesActive.sup && s.styles.sup)
      p *= STYLE_MULT[s.styles.sup.rank]
    if (s.abilities.includes('Late Bloomer') && minuteOf(clock) >= 75)
      p *= 1.1
    return p
  }

  /* ---- chance windows (§3.4) ---- */

  const openWindow = (sideKey: TeamSide) => {
    const att = sides[sideKey]
    const def = sides[other(sideKey)]
    winCount++
    const wr = mulberry32(hashSeed(`${seed}:win:${winCount}`))
    const available = att.players.filter((_, i) => !att.sentOff.has(i))
    const shooterPl = pickWeighted(wr, available, (pl) =>
      scorerWeight(att, pl, att.players.indexOf(pl)),
    )
    const keeperPl = keeperOf(def.players)
    const w: WindowState = {
      side: sideKey,
      opensAt: clock,
      remainReal: WINDOW_REAL,
      durationReal: WINDOW_REAL,
      shooter: shooterPl.p.name,
      keeper: keeperPl.p.name,
      attackQuality: null,
      keeperQuality: null,
      rush: false,
      elapsed: 0,
      wr,
      shooterPl,
      keeperPl,
      /* AI/spectator sides auto-press at a seeded moment + quality */
      aiShoot: att.ai
        ? { at: 0.35 + wr() * 1.7, q: 0.2 + wr() * 0.8 }
        : null,
      aiKeep: def.ai ? { at: 0.3 + wr() * 1.7, q: 0.2 + wr() * 0.8 } : null,
    }
    win = w
    bx = sideKey === 'home' ? 0.82 : 0.18
    push({
      t: clock,
      minute: minuteOf(clock),
      stoppage: isStoppage(clock),
      kind: 'window-open',
      team: sideKey,
      player: shooterPl.p.name,
      text: windowOpenLine(wr, shooterPl.p.name, att.input.name),
      data: {
        side: sideKey,
        shooter: shooterPl.p.name,
        keeper: keeperPl.p.name,
        durationReal: WINDOW_REAL,
      },
    })
  }

  const resolveWindow = () => {
    const w = win
    if (!w) return
    win = null
    const att = sides[w.side]
    const def = sides[other(w.side)]
    const wr = w.wr
    const strAtt = w.side === 'home' ? strengthHome : strengthAway
    const strDef = w.side === 'home' ? strengthAway : strengthHome

    /* defender quality: pressed > AI-scheduled > idle baseline */
    let keeperQ =
      w.keeperQuality ?? w.aiKeep?.q ?? 0.45
    if (def.abilities.includes('Keeper Reflex'))
      keeperQ = clamp(keeperQ + 0.15, 0, 1)
    if (w.rush) keeperQ = clamp(keeperQ * 1.5, 0, 1)
    const keeperMult = qualityTier(keeperQ)
    /* attack quality: no press → fizzle ×0.55 */
    const attackQ = w.attackQuality ?? w.aiShoot?.q ?? null
    const attackMult = attackQ == null ? 0.55 : qualityTier(attackQ)

    const base = clamp(
      0.2 +
        (strAtt.attack - strDef.keeper) / 220 +
        (w.shooterPl.p.stats.off - 14) / 90,
      0.06,
      0.52,
    )
    let conv = base * attackMult
    conv *= 0.8 + att.spirit / 250 // morale scales conversion (§4)
    if (att.tactic.stance === 'counter') conv *= 1.18
    if (
      att.tactic.stance === 'counter' &&
      att.abilities.includes('Counter Boost')
    )
      conv *= 1.1
    if (att.stylesActive.off && att.styles.off)
      conv *= STYLE_MULT[att.styles.off.rank]
    if (att.specialPending) conv *= 2.5
    if (def.stylesActive.def && def.styles.def)
      conv /= STYLE_MULT[def.styles.def.rank]
    const defScore = w.side === 'home' ? score.away : score.home
    const attScore = w.side === 'home' ? score.home : score.away
    if (def.abilities.includes('Iron Wall') && defScore > attScore)
      conv *= 0.94
    conv /= keeperMult
    const pGoal = clamp(conv, 0.02, 0.95)
    att.specialPending = false

    const fizzle = attackQ == null
    let outcome: 'goal' | 'saved' | 'missed'
    if (wr() < pGoal) {
      outcome = 'goal'
    } else if (w.rush) {
      /* failed rush = near-certain goal (§3.4) */
      const saveP = clamp(0.45 + 0.5 * keeperQ, 0, 0.95)
      outcome = wr() < saveP ? 'saved' : wr() < 0.9 ? 'goal' : 'missed'
    } else {
      outcome = wr() < 0.58 ? 'saved' : 'missed'
    }

    const attName = att.input.name
    const defName = def.input.name
    const minute = minuteOf(clock)
    const stoppage = isStoppage(clock)
    push({
      t: clock,
      minute,
      stoppage,
      kind: 'window-resolve',
      team: w.side,
      player: w.shooterPl.p.name,
      text:
        fizzle && outcome !== 'goal'
          ? windowFizzleLine(wr, attName)
          : `${attName} ${outcome === 'goal' ? 'convert the window' : outcome === 'saved' ? 'are denied' : 'miss the window'}.`,
      data: {
        side: w.side,
        outcome,
        attackQuality: attackQ,
        keeperQuality: keeperQ,
        fizzle,
        rush: w.rush,
        special: conv > base, // informational
      },
    })

    if (outcome === 'goal') {
      score[w.side]++
      bumpSpirit(att, 12)
      bumpSpirit(def, -10)
      const useAssist = wr() < 0.68
      const mates = att.players.filter(
        (pl, i) => pl !== w.shooterPl && !att.sentOff.has(i),
      )
      const assister = useAssist
        ? pickWeighted(wr, mates, (pl) => 0.3 + pl.p.stats.tec / 20)
        : null
      push({
        t: clock,
        minute,
        stoppage,
        kind: 'goal',
        team: w.side,
        player: w.shooterPl.p.name,
        assist: assister?.p.name ?? undefined,
        text: goalLine(wr, w.shooterPl.p.name, attName, assister?.p.name ?? null),
        data: { attackQuality: attackQ, window: true },
      })
      bx = w.side === 'home' ? 0.95 : 0.05
      by = 0.5
    } else if (outcome === 'saved') {
      push({
        t: clock,
        minute,
        stoppage,
        kind: 'chance',
        team: w.side,
        player: w.shooterPl.p.name,
        text: chanceLine(wr, w.shooterPl.p.name, w.keeperPl.p.name),
        data: { attackQuality: attackQ, keeperQuality: keeperQ },
      })
      void defName
      bx = w.side === 'home' ? 0.86 : 0.14
    } else {
      push({
        t: clock,
        minute,
        stoppage,
        kind: 'miss',
        team: w.side,
        player: w.shooterPl.p.name,
        text: missLine(wr, w.shooterPl.p.name),
        data: { attackQuality: attackQ },
      })
      bx = w.side === 'home' ? 0.8 : 0.2
    }
    lastStoppage = clock
  }

  /* ---- half-time (§3.5) ---- */

  const enterHalftime = () => {
    phase = 'halftime'
    htReal = 0
    push({
      t: clock,
      minute: 45,
      stoppage: stoppage1 > 0,
      kind: 'halftime',
      team: null,
      text: halftimeLine(home.name, score.home, score.away),
    })
    /* 2012-13 halftime flavor event: scripted drama + small morale effects */
    const fs = sides[htFlavorSide]
    const fp =
      fs.players[1 + Math.floor(tr.next() * (fs.players.length - 1))]
    push({
      t: clock,
      minute: 45,
      stoppage: true,
      kind: 'info',
      team: htFlavorSide,
      player: fp.p.name,
      text: halftimeFlavorLine(tr.next, htFlavor, fs.input.name, fp.p.name),
      data: { flavor: htFlavor },
    })
    bumpSpirit(
      fs,
      htFlavor === 'youngster' ? 4 : htFlavor === 'injury-scare' ? 2 : -3,
    )
    /* AI sides pick their talk immediately (seeded) */
    for (const s of [H, A]) if (s.ai) applyTalk(s, autoTalk[s.key], true)
  }

  const applyTalk = (s: Side, choice: 0 | 1 | 2, auto = false) => {
    if (s.talkApplied || phase !== 'halftime') return
    s.talkApplied = true
    const talkMaster = s.abilities.includes('Talk Master') ? 1.5 : 1
    const fx = (v: number) => Math.round(v * talkMaster)
    if (choice === 0) {
      /* "Push higher" — OFF +8, DEF −5, spirit +6 */
      s.talkOffsets[0] += fx(8)
      s.talkOffsets[1] -= fx(5)
      bumpSpirit(s, fx(6))
    } else if (choice === 1) {
      /* "Stay calm, keep the ball" — POS +8, spirit +4 */
      s.talkOffsets[2] += fx(8)
      bumpSpirit(s, fx(4))
    } else {
      /* "Win every duel" — WIN +8, spirit +8, stamina −5 all */
      s.talkOffsets[3] += fx(8)
      bumpSpirit(s, fx(8))
      for (const p of s.players) p.stamina = clamp(p.stamina - 5, 5, 100)
    }
    htLastTalkReal = htReal
    push({
      t: clock,
      minute: 45,
      stoppage: true,
      kind: 'talk',
      team: s.key,
      text: talkLine(choice, s.input.name),
      data: { choice, auto },
    })
  }

  /* ---- substitutions (§3.6) ---- */

  const doSub = (
    s: Side,
    slot: number,
    on: { name: string; number: number; card?: EnginePlayer2 },
  ) => {
    const old = s.players[slot]
    old.subbedOff = true
    old.subMinute = minuteOf(clock)
    const entering = on.card
      ? effPlayer(on.card, 'flat')
      : ({
          name: on.name,
          number: on.number,
          position: old.p.position,
          stats: old.p.stats,
        } as EnginePlayer2)
    const stamina = s.abilities.includes('Super Sub') ? 100 : 96
    const np = mkLive(
      { ...entering, position: old.p.position },
      stamina,
      old.drain * 0.4,
    )
    np.subbedOn = true
    np.subMinute = minuteOf(clock)
    s.players[slot] = np
    s.subsUsed++
    subsTl.push({
      slot,
      side: s.key,
      minute: minuteOf(clock),
      onName: on.name,
      onNumber: on.number,
    })
    if (s.key === 'home') strengthHome = squadStrength(s.players.map((p) => p.p))
    else strengthAway = squadStrength(s.players.map((p) => p.p))
    lastStoppage = clock
    push({
      t: clock,
      minute: minuteOf(clock),
      stoppage: isStoppage(clock),
      kind: 'sub',
      team: s.key,
      player: old.p.name,
      assist: on.name,
      text: subLine(old.p.name, on.name, s.input.name),
    })
  }

  const subAllowedNow = () =>
    phase === 'halftime' || win != null || clock - lastStoppage <= 12

  /* ---- AI tactic changes: every ~30 in-game seconds (§4) ---- */

  const aiTactic = (s: Side) => {
    if (tr.next() >= 0.6) return
    const lanes = ['balanced', 'left', 'right', 'centre'] as const
    const laneR = tr.next()
    const lane =
      laneR < 0.4
        ? lanes[0]
        : laneR < 0.6
          ? lanes[1]
          : laneR < 0.8
            ? lanes[2]
            : lanes[3]
    const stanceR = tr.next()
    const stance =
      stanceR < 0.55 ? 'normal' : stanceR < 0.8 ? 'counter' : 'press'
    s.tactic = { lane, stance }
    push({
      t: clock,
      minute: minuteOf(clock),
      stoppage: isStoppage(clock),
      kind: 'tactic',
      team: s.key,
      text: tacticLine(tr.next, s.input.name, s.tactic),
      data: { tactic: { ...s.tactic }, auto: true },
    })
  }

  /* ---- one match-clock second of open play ---- */

  const tick = () => {
    clock++
    const minute = minuteOf(clock)

    if (clock === halfOneEnd) {
      enterHalftime()
      return
    }
    if (clock >= duration) {
      enterFulltime()
      return
    }

    /* possession & ball random walks with tactic lane bias */
    const possTarget = clamp(
      possBase +
        (A.tactic.stance === 'counter' ? 0.06 : 0) -
        (H.tactic.stance === 'counter' ? 0.06 : 0),
      0.25,
      0.75,
    )
    poss += (possTarget - poss) * 0.02 + (tr.next() - 0.5) * 0.012
    poss = clamp(poss, 0.25, 0.75)
    const homeHasBall = tr.next() < poss
    const ballSide = homeHasBall ? H : A
    const targetX = homeHasBall ? 0.72 : 0.28
    const targetY =
      ballSide.tactic.lane === 'left'
        ? 0.3
        : ballSide.tactic.lane === 'right'
          ? 0.7
          : 0.5
    bx += (targetX - bx) * 0.03 + (tr.next() - 0.5) * 0.05
    by += (targetY - by) * 0.03 + (0.5 - by) * 0.01 + (tr.next() - 0.5) * 0.05
    bx = clamp(bx, 0.04, 0.96)
    by = clamp(by, 0.06, 0.94)

    /* stamina drain (press ×1.5 while active, §4) */
    for (const s of [H, A]) {
      const pressing = s.tactic.stance === 'press' || s.pressT > 0
      const secondWind =
        s.abilities.includes('Second Wind') && clock > halfOneEnd ? 0.8 : 1
      for (const p of s.players) {
        if (p.subbedOff) continue
        p.stamina = clamp(
          p.stamina -
            (p.drain / 60) * (pressing ? 1.5 : 1) * secondWind,
          5,
          100,
        )
      }
    }

    /* chance rolls → chance windows */
    if (tr.next() < chanceP(H)) openWindow('home')
    else if (tr.next() < chanceP(A)) openWindow('away')
    if (win) return // clock freezes while the window is open

    /* press steals */
    for (const s of [H, A]) {
      const pressing = s.tactic.stance === 'press' || s.pressT > 0
      if (!pressing || tr.next() >= 0.004) continue
      const opp = sides[other(s.key)]
      const candidates = s.players.filter(
        (p, i) => p.p.position !== 'GK' && !s.sentOff.has(i),
      )
      const stealer = candidates[Math.floor(tr.next() * candidates.length)]
      bumpSpirit(s, 3)
      push({
        t: clock,
        minute,
        stoppage: isStoppage(clock),
        kind: 'steal',
        team: s.key,
        player: stealer.p.name,
        text: stealLine(tr.next, stealer.p.name, s.input.name),
      })
      /* Footista BREAK: a press steal on a linked player kills the hotline */
      if (opp.hotline && tr.next() < 0.5) {
        const linked = opp.hotline
        opp.hotline = null
        opp.hotlineT = 0
        push({
          t: clock,
          minute,
          stoppage: isStoppage(clock),
          kind: 'break',
          team: s.key,
          player: stealer.p.name,
          text: breakLine(tr.next, stealer.p.name, opp.input.name),
          data: { linked },
        })
      }
    }

    /* bookings (v1 pattern) */
    if (tr.next() < 0.00042) {
      const s = tr.next() < 0.5 ? H : A
      const candidates = s.players
        .map((p, i) => ({ p, i }))
        .filter((c) => c.p.p.position !== 'GK' && !s.sentOff.has(c.i))
      if (candidates.length) {
        const { p, i } = candidates[Math.floor(tr.next() * candidates.length)]
        if (p.card === 'yellow' && tr.next() < 0.3) {
          p.card = 'red'
          s.sentOff.add(i)
          push({
            t: clock, minute, stoppage: isStoppage(clock), kind: 'red',
            team: s.key, player: p.p.name, text: redLine(tr.next, p.p.name),
          })
        } else if (!p.card) {
          p.card = 'yellow'
          push({
            t: clock, minute, stoppage: isStoppage(clock), kind: 'yellow',
            team: s.key, player: p.p.name, text: yellowLine(tr.next, p.p.name),
          })
        }
        lastStoppage = clock
      }
    }

    /* AI subs fire on their minute */
    for (const s of [H, A]) {
      if (!s.ai) continue
      for (const plan of s.aiSubPlan) {
        if (plan.minute !== minute || clock % 60 !== 12) continue
        if (s.subsUsed >= 3 || s.players[plan.slot].subbedOff) continue
        const benchCard = s.bench[s.aiSubBenchIdx]
        if (benchCard) {
          s.aiSubBenchIdx++
          doSub(s, plan.slot, {
            name: benchCard.name,
            number: benchCard.number,
            card: benchCard,
          })
          s.bench = s.bench.filter((b) => b !== benchCard)
        } else {
          doSub(s, plan.slot, {
            name: s.players[plan.slot].p.name.replace(/^./, 'S'),
            number: 12 + Math.floor(tr.next() * 20),
          })
        }
      }
    }

    /* AI tactic changes */
    for (const s of [H, A]) {
      if (!s.ai || clock < s.aiNextTacticAt) continue
      s.aiNextTacticAt += 30 + Math.floor(tr.next() * 10)
      aiTactic(s)
    }
  }

  /* ---- full-time + cup PK shootout (§3.8) ---- */

  const enterFulltime = () => {
    if (opts.cup && score.home === score.away) {
      phase = 'pk'
      pkReal = 0
      pkRand = mulberry32(hashSeed(`${seed}:pk`))
      const order = (s: Side) =>
        s.players
          .map((pl, slot) => ({ pl, slot }))
          .sort(
            (a, b) =>
              scorerWeight(s, b.pl, b.slot) - scorerWeight(s, a.pl, a.slot),
          )
          .map((x) => x.pl)
      pkOrder = { home: order(H), away: order(A) }
      pkState = { round: 1, kicks: [], score: { home: 0, away: 0 }, decided: false, winner: null }
      push({
        t: duration,
        minute: minuteOf(duration),
        stoppage: true,
        kind: 'info',
        team: null,
        text: pkIntroLine(pkRand, home.name, away.name),
        data: { pk: true },
      })
      return
    }
    finishFulltime()
  }

  /** resolve one PK kick per call; guaranteed decided by round 10 */
  const pkKick = () => {
    const pk = pkState
    const pr = pkRand
    const orders = pkOrder
    if (!pk || !pr || !orders || pk.decided) return
    const idx = pk.kicks.length
    const side: TeamSide = idx % 2 === 0 ? 'home' : 'away'
    const s = sides[side]
    const gk = keeperOf(sides[other(side)].players)
    const kicker = orders[side][Math.floor(idx / 2) % 11]
    let scored: boolean
    if (pk.round >= 10) {
      /* scripted coin flip weighted by spirit — always terminates */
      const winner: TeamSide =
        pr() < H.spirit / (H.spirit + A.spirit) ? 'home' : 'away'
      scored = side === winner
      pk.decided = true
      pk.winner = winner
    } else {
      const p = clamp(
        0.72 +
          (kicker.p.stats.off - gk.p.stats.def) * 0.012 +
          (s.spirit - 50) * 0.002,
        0.5,
        0.92,
      )
      scored = pr() < p
    }
    pk.kicks.push({ round: pk.round, side, player: kicker.p.name, scored })
    if (scored) pk.score[side]++
    bumpSpirit(s, scored ? 2 : -2)
    push({
      t: duration + idx + 1,
      minute: minuteOf(duration),
      stoppage: true,
      kind: 'pk',
      team: side,
      player: kicker.p.name,
      text: pkLine(pr, kicker.p.name, scored, pk.round),
      data: {
        round: pk.round,
        side,
        scored,
        scoreHome: pk.score.home,
        scoreAway: pk.score.away,
      },
    })

    /* decision checks */
    const kicksDone = (sd: TeamSide) => pk.kicks.filter((k) => k.side === sd).length
    const remaining = (sd: TeamSide) => Math.max(0, 5 - kicksDone(sd))
    if (!pk.decided && pk.round <= 5) {
      /* early decision inside the 5 rounds */
      if (
        pk.score.home > pk.score.away + remaining('away') ||
        pk.score.away > pk.score.home + remaining('home')
      ) {
        pk.decided = true
        pk.winner = pk.score.home > pk.score.away ? 'home' : 'away'
      }
    }
    if (!pk.decided && side === 'away' && pk.round >= 5) {
      if (pk.score.home !== pk.score.away) {
        /* sudden death: pair complete with a difference */
        pk.decided = true
        pk.winner = pk.score.home > pk.score.away ? 'home' : 'away'
      }
    }
    if (side === 'away' && !pk.decided) pk.round++
    if (pk.round > 10) pk.round = 10

    if (pk.decided) finishFulltime()
  }

  const finishFulltime = () => {
    phase = 'fulltime'
    const pk = pkState
    push({
      t: duration,
      minute: minuteOf(duration),
      stoppage: true,
      kind: 'fulltime',
      team: null,
      text: pk?.decided
        ? `${fulltimeLine(home.name, away.name, score.home, score.away)} ${pkWinnerLine(
            pk.winner === 'home' ? home.name : away.name,
            pk.winner === 'home' ? pk.score.home : pk.score.away,
            pk.winner === 'home' ? pk.score.away : pk.score.home,
          )}`
        : fulltimeLine(home.name, away.name, score.home, score.away),
      data: pk?.decided
        ? { pkHome: pk.score.home, pkAway: pk.score.away, winner: pk.winner }
        : undefined,
    })
  }

  /* ---- real-time effect timers ---- */

  const advanceTimers = (dt: number) => {
    for (const s of [H, A]) {
      if (s.era === 'footista') s.cost = clamp(s.cost + 6 * dt, 0, 100)
      if (s.hotlineT > 0) {
        s.hotlineT -= dt
        if (s.hotlineT <= 0) {
          s.hotline = null
          s.hotlineT = 0
        }
      }
      if (s.skillT > 0) {
        s.skillT -= dt
        if (s.skillT <= 0) {
          s.skillSlot = null
          s.skillT = 0
        }
      }
      if (s.manmarkT > 0) {
        s.manmarkT -= dt
        if (s.manmarkT <= 0) {
          s.manmarkTarget = null
          s.manmarkT = 0
        }
      }
      if (s.pressT > 0) s.pressT = Math.max(0, s.pressT - dt)
    }
  }

  /* ---- public: step ---- */

  const step = (dtRealSeconds: number): MatchEvent2[] => {
    const dt = clamp(dtRealSeconds, 0, 1)
    if (phase === 'fulltime') return []
    advanceTimers(dt)

    if (phase === 'halftime') {
      htReal += dt
      for (const s of [H, A]) {
        if (!s.talkApplied && htReal >= HT_REAL)
          applyTalk(s, autoTalk[s.key], true) // 6 s auto-pick (§3.5)
      }
      const allTalked = H.talkApplied && A.talkApplied
      if (
        allTalked &&
        htReal >= Math.min(HT_REAL, htLastTalkReal + 1.5)
      ) {
        phase = 'playing'
      }
    } else if (phase === 'pk') {
      pkReal += dt
      while (pkReal >= 0.8 && phase === 'pk') {
        pkReal -= 0.8
        pkKick()
      }
    } else if (win) {
      /* chance window runs on real time; match clock frozen */
      win.elapsed += dt
      win.remainReal = Math.max(0, WINDOW_REAL - win.elapsed)
      if (win.aiShoot && win.attackQuality == null && win.elapsed >= win.aiShoot.at)
        win.attackQuality = win.aiShoot.q
      if (win.aiKeep && win.keeperQuality == null && win.elapsed >= win.aiKeep.at)
        win.keeperQuality = win.aiKeep.q
      if (win.attackQuality != null || win.elapsed >= WINDOW_REAL)
        resolveWindow()
    } else if (phase === 'playing') {
      acc += dt * RATE
      while (acc >= 1 && !win && phase === 'playing') {
        acc -= 1
        tick()
      }
    }

    const fresh = events.slice(emitted)
    emitted = events.length
    return fresh
  }

  /* ---- public: command ---- */

  const command = (cmd: Command): void => {
    if (phase === 'fulltime') return
    /* every command mixes entropy — identical logs replay identically */
    const h = hashSeed(
      `${seed}:${clock.toFixed(3)}:${cmdLog.length}:${JSON.stringify(cmd)}`,
    )
    cmdLog.push({ ...cmd, at: clock } as CommandLogEntry)
    tr.mix(h)
    const cr = mulberry32(h)
    const me = sides[userSide]
    const opp = sides[other(userSide)]

    switch (cmd.type) {
      case 'tactic': {
        if (phase !== 'playing' && phase !== 'halftime') return
        me.tactic = { lane: cmd.tactic.lane, stance: cmd.tactic.stance }
        push({
          t: clock,
          minute: minuteOf(clock),
          stoppage: isStoppage(clock),
          kind: 'tactic',
          team: userSide,
          text: tacticLine(cr, me.input.name, me.tactic),
          data: { tactic: { ...me.tactic } },
        })
        return
      }
      case 'shoot': {
        if (!win || win.side !== userSide || win.attackQuality != null) return
        if (me.era === 'footista' && !spend(me, COST.shoot)) return
        win.attackQuality = clamp(cmd.quality, 0, 1)
        resolveWindow()
        return
      }
      case 'keeper': {
        if (!win || win.side === userSide || win.keeperQuality != null) return
        if (me.era === 'footista' && !spend(me, COST.shoot)) return
        win.keeperQuality = clamp(cmd.quality, 0, 1)
        win.rush = !!cmd.rush
        if (win.rush) {
          push({
            t: clock,
            minute: minuteOf(clock),
            stoppage: isStoppage(clock),
            kind: 'info',
            team: userSide,
            player: win.keeper,
            text: keeperRushLine(cr, win.keeper),
            data: { rush: true },
          })
        }
        return
      }
      case 'sub': {
        if (me.subsUsed >= 3 || !subAllowedNow()) return
        const slot = cmd.outSlot
        if (slot < 0 || slot >= me.players.length) return
        const old = me.players[slot]
        if (old.subbedOff || me.sentOff.has(slot)) return
        const card = me.bench.find(
          (b) => b.id === cmd.inCardId || b.name === cmd.inCardId,
        )
        if (!card) return
        /* position compatibility: GK can only swap with GK */
        if ((old.p.position === 'GK') !== (card.position === 'GK')) return
        me.bench = me.bench.filter((b) => b !== card)
        doSub(me, slot, { name: card.name, number: card.number, card })
        return
      }
      case 'teamtalk': {
        if (phase !== 'halftime' || me.talkApplied) return
        applyTalk(me, cmd.choice)
        return
      }
      case 'style': {
        if (me.era !== 'kp') return
        const style = me.styles[cmd.slot]
        if (!style || me.stylesActive[cmd.slot]) return
        me.stylesActive[cmd.slot] = true
        push({
          t: clock,
          minute: minuteOf(clock),
          stoppage: isStoppage(clock),
          kind: 'style',
          team: userSide,
          text: styleLine(style.name, me.input.name, style.rank),
          data: { slot: cmd.slot, style: style.name, rank: style.rank },
        })
        return
      }
      case 'special': {
        if (me.era !== 'kp' || me.spirit < 95 || me.specialPending) return
        me.specialPending = true
        me.spirit = 20
        push({
          t: clock,
          minute: minuteOf(clock),
          stoppage: isStoppage(clock),
          kind: 'style',
          team: userSide,
          text: specialLine(me.input.name),
          data: { special: true },
        })
        return
      }
      case 'skill': {
        if (me.era !== 'footista' || !spend(me, COST.skill)) return
        const slot = cmd.slot
        if (slot < 0 || slot >= me.players.length) return
        me.skillSlot = slot
        me.skillT = 10
        bumpSpirit(me, 4)
        const pl = me.players[slot]
        push({
          t: clock,
          minute: minuteOf(clock),
          stoppage: isStoppage(clock),
          kind: 'skill',
          team: userSide,
          player: pl.p.name,
          text: skillLine(pl.p.name, pl.p.trait ?? 'Skill Move'),
          data: { slot, trait: pl.p.trait },
        })
        return
      }
      case 'hotline': {
        if (me.era !== 'footista' || !spend(me, COST.hotline)) return
        const slots = [...new Set(cmd.slots)]
          .filter((i) => i >= 0 && i < me.players.length)
          .slice(0, 3)
        if (!slots.length) return
        me.hotline = slots
        me.hotlineT = 20
        push({
          t: clock,
          minute: minuteOf(clock),
          stoppage: isStoppage(clock),
          kind: 'hotline',
          team: userSide,
          text: hotlineLine(me.input.name, slots.length),
          data: { slots },
        })
        return
      }
      case 'manmark': {
        if (me.era !== 'footista' || !spend(me, COST.manmark)) return
        /* nearest DF marks their top scorer for 30 s (§4) */
        const target = opp.players
          .map((pl, slot) => ({ pl, slot }))
          .filter((x) => !opp.sentOff.has(x.slot))
          .sort(
            (a, b) =>
              scorerWeight(opp, b.pl, b.slot) - scorerWeight(opp, a.pl, a.slot),
          )[0]
        const marker =
          opp && me.players.find((p) => ['CB', 'LSB', 'RSB'].includes(p.p.position))
        if (!target || !marker) return
        me.manmarkTarget = target.slot
        me.manmarkT = 30
        push({
          t: clock,
          minute: minuteOf(clock),
          stoppage: isStoppage(clock),
          kind: 'tactic',
          team: userSide,
          player: marker.p.name,
          text: manmarkLine(marker.p.name, target.pl.p.name),
          data: { instruction: 'manmark', target: target.slot },
        })
        return
      }
      case 'press': {
        if (me.era !== 'footista' || !spend(me, COST.press)) return
        me.pressT = 15
        push({
          t: clock,
          minute: minuteOf(clock),
          stoppage: isStoppage(clock),
          kind: 'tactic',
          team: userSide,
          text: `${me.input.name} trigger the press — 15 seconds of fury.`,
          data: { instruction: 'press', durationReal: 15 },
        })
        return
      }
    }
  }

  const spend = (s: Side, cost: number): boolean => {
    if (s.cost < cost) return false
    s.cost -= cost
    return true
  }

  /* ---- public: state ---- */

  const HEADLINE_KINDS = new Set([
    'goal',
    'chance',
    'miss',
    'yellow',
    'red',
    'sub',
    'window-open',
    'window-resolve',
    'pk',
  ])

  const hexOf = (s: Side): Hexagon => {
    const hx = computeHexagon(
      s.players.map((p) => p.p),
      s.lineNudges,
      s.practiceLevels,
    )
    /* team talks visibly shift the hexagon (§3.5) */
    hx.formation = hx.formation.map((v, i) =>
      clamp(Math.round(v + s.talkOffsets[i]), 0, 100),
    )
    hx.performance = hx.formation.map((v, i) => Math.min(v, hx.practice[i]))
    return hx
  }

  const liveOf = (s: Side): PlayerLive2[] =>
    s.players.map((pl, slot) => {
      const st = pl.p.stats
      const overall =
        (st.off + st.def + st.tec + st.pow + st.spd + st.sta) / 6
      return {
        id: pl.p.id,
        name: pl.p.name,
        number: pl.p.number,
        position: pl.p.position,
        trait: pl.p.trait,
        strength: clamp(overall * 5, 25, 100),
        stamina: Math.round(pl.stamina),
        card: pl.card,
        subbedOff: pl.subbedOff,
        subbedOn: pl.subbedOn,
        subMinute: pl.subMinute,
        condition: s.cond[slot] ?? 'flat',
        sentOff: s.sentOff.has(slot),
      }
    })

  const displayClock = () => {
    const m = Math.floor(clock / 60)
    const s = Math.floor(clock % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const state = (): MatchState2 => {
    const visible = events.slice().reverse()
    const headline =
      visible.find((e) => HEADLINE_KINDS.has(e.kind)) ?? visible[0] ?? null
    return {
      clock,
      displayClock: displayClock(),
      displayMinute: minuteOf(clock),
      half: clock <= halfOneEnd ? 1 : 2,
      phase,
      score: { ...score },
      possession: poss,
      ball: { x: bx, y: by },
      lane: by < 0.36 ? 'left' : by > 0.64 ? 'right' : 'centre',
      events: visible,
      headline,
      homeXI: liveOf(H),
      awayXI: liveOf(A),
      strengthHome,
      strengthAway,
      tacticHome: { ...H.tactic },
      tacticAway: { ...A.tactic },
      spiritHome: Math.round(H.spirit),
      spiritAway: Math.round(A.spirit),
      window: win
        ? {
            side: win.side,
            opensAt: win.opensAt,
            remainReal: win.remainReal,
            durationReal: win.durationReal,
            shooter: win.shooter,
            keeper: win.keeper,
            attackQuality: win.attackQuality,
            keeperQuality: win.keeperQuality,
            rush: win.rush,
          }
        : null,
      hexagon: hexOf(H),
      hexagonAway: hexOf(A),
      conditionHome: [...H.cond],
      conditionAway: [...A.cond],
      stylesActive: {
        home: { ...H.stylesActive },
        away: { ...A.stylesActive },
      },
      abilitiesActive: { home: [...H.abilities], away: [...A.abilities] },
      instructionCost: { home: Math.round(H.cost), away: Math.round(A.cost) },
      hotline: H.hotline ? [...H.hotline] : null,
      hotlineAway: A.hotline ? [...A.hotline] : null,
      subsUsed: { home: H.subsUsed, away: A.subsUsed },
      pk: pkState
        ? {
            round: pkState.round,
            kicks: [...pkState.kicks],
            score: { ...pkState.score },
            decided: pkState.decided,
            winner: pkState.winner,
          }
        : null,
    }
  }

  const result = (): 'home' | 'away' | 'draw' => {
    if (score.home !== score.away) return score.home > score.away ? 'home' : 'away'
    if (pkState?.decided && pkState.winner) return pkState.winner
    return 'draw'
  }

  const timeline = (): MatchTimeline2 => ({
    seed,
    home,
    away,
    strengthHome,
    strengthAway,
    events: [...events],
    duration,
    halfOneEnd,
    finalScore: { ...score },
    result: result(),
    pk: pkState
      ? {
          round: pkState.round,
          kicks: [...pkState.kicks],
          score: { ...pkState.score },
          decided: pkState.decided,
          winner: pkState.winner,
        }
      : null,
    commandLog: cmdLog.map((c) => ({ ...c })),
    staminaRates: [...staminaRates],
    subs: subsTl.map((s) => ({ ...s })),
  })

  return {
    state,
    step,
    command,
    done: () => phase === 'fulltime',
    timeline,
    commandLog: () => cmdLog.map((c) => ({ ...c })),
    /* internal fast accessor for createMatch2 (not part of the public type) */
    _clock: () => clock,
  } as Stepper & { _clock: () => number }
}

/* ------------------------------------------------------------------ */
/* createMatch2 — run a stepper to completion (Theatre replay / tests)  */
/* ------------------------------------------------------------------ */

/**
 * Simulate a full interactive match. Deterministic: identical
 * (seed, home, away, commandLog) always yields the identical timeline.
 * Log entries are applied when the match clock reaches their `at` time.
 */
export function createMatch2(
  seedInput: number | string,
  home: TeamInput2,
  away: TeamInput2,
  log: CommandLogEntry[] = [],
  opts: StepperOptions = {},
): MatchTimeline2 {
  const st = createStepper(seedInput, home, away, opts) as Stepper & {
    _clock: () => number
  }
  let i = 0
  let guard = 0
  while (!st.done() && guard++ < 50000) {
    const c = st._clock()
    while (i < log.length && (log[i].at ?? 0) <= c) {
      const { at: _at, ...cmd } = log[i]
      void _at
      st.command(cmd as Command)
      i++
    }
    st.step(0.1)
  }
  return st.timeline()
}

/** Convert a WCCF card into an engine2 player (keeps id + trait). */
export function cardToEnginePlayer2(c: {
  id?: string
  name: string
  number: number
  positions: string[]
  stats: EnginePlayer['stats']
  trait?: string
}): EnginePlayer2 {
  return {
    id: c.id,
    name: c.name,
    number: c.number,
    position: c.positions[0] as EnginePlayer2['position'],
    stats: c.stats,
    trait: c.trait,
  }
}
