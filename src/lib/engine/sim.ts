/**
 * WCCF match engine — deterministic seeded simulator.
 *
 * Usage (lobby cabinet — everyone sees the same match):
 *   const { seed, clock } = cabinetNow(cabinetId)
 *   const tl = createMatch(seed, home, away)          // memoize per seed
 *   const state = stateAt(tl, clock)                  // call at 1 Hz
 *
 * Usage (Theatre replay / seat match):
 *   const tl = createMatch(mySeed, myTeam, oppTeam)
 *   // scrub freely: stateAt(tl, anyClock)
 */
import type {
  EnginePlayer,
  MatchEvent,
  MatchState,
  MatchTimeline,
  PitchDot,
  PlayerCardDataLike,
  PlayerLive,
  SquadStrength,
  TeamInput,
  TeamSide,
} from './types'
import {
  chanceLine,
  formatClock,
  fulltimeLine,
  goalLine,
  halfAt,
  halftimeLine,
  kickoffLine,
  missLine,
  phaseAt,
  redLine,
  subLine,
  yellowLine,
} from './commentary'

/* ------------------------------------------------------------------ */
/* Seeded RNG                                                          */
/* ------------------------------------------------------------------ */

/** xfnv1a string hash → uint32. */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h += h << 13
  h ^= h >>> 7
  h += h << 3
  h ^= h >>> 17
  h += h << 5
  return h >>> 0
}

/** mulberry32 PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ */
/* Squad strength                                                      */
/* ------------------------------------------------------------------ */

const AVG = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0

const isDef = (p: EnginePlayer) =>
  ['CB', 'LSB', 'RSB'].includes(p.position)
const isMid = (p: EnginePlayer) =>
  ['DMF', 'CMF', 'OMF', 'SMF'].includes(p.position)
const isAtt = (p: EnginePlayer) => ['FW', 'CF', 'OMF'].includes(p.position)

/**
 * Derive squad strength (0..100 bands) from an XI's WCCF stats.
 * Cards are 0–20 per parameter, so ×5 maps onto the 0–100 scale.
 */
export function squadStrength(xi: EnginePlayer[]): SquadStrength {
  const att = xi.filter((p) => isAtt(p))
  const mid = xi.filter((p) => isMid(p))
  const def = xi.filter((p) => isDef(p))
  const gk = xi.find((p) => p.position === 'GK')
  const attack = AVG(att.map((p) => p.stats.off * 4 + p.stats.spd)) * 1 // 0..100
  const midfield = AVG(mid.map((p) => p.stats.tec * 3 + p.stats.sta * 2))
  const defense = AVG(def.map((p) => p.stats.def * 4 + p.stats.pow))
  const keeper = gk ? gk.stats.def * 4.4 + gk.stats.tec * 0.6 : 40
  const stamina = AVG(xi.map((p) => p.stats.sta)) * 5
  const overall =
    AVG(
      xi.map(
        (p) =>
          p.stats.off +
          p.stats.def +
          p.stats.tec +
          p.stats.pow +
          p.stats.spd +
          p.stats.sta,
      ),
    ) / 6
  return {
    attack: clamp(attack, 0, 100),
    midfield: clamp(midfield, 0, 100),
    defense: clamp(defense, 0, 100),
    keeper: clamp(keeper, 0, 100),
    stamina: clamp(stamina, 0, 100),
    overall: clamp(overall * 5, 0, 100),
  }
}

/** Convert a WCCF card into an engine player. */
export function cardToEnginePlayer(c: PlayerCardDataLike): EnginePlayer {
  return {
    name: c.name,
    number: c.number,
    position: c.positions[0],
    stats: c.stats,
  }
}

/** Build a TeamInput from cards (first 11 = XI). */
export function teamFromCards(
  name: string,
  short: string,
  color: string,
  cards: PlayerCardDataLike[],
): TeamInput {
  return { name, short, color, xi: cards.slice(0, 11).map(cardToEnginePlayer) }
}

/* ------------------------------------------------------------------ */
/* Lobby cabinet scheduling — shared wall-clock                        */
/* ------------------------------------------------------------------ */

/** One cabinet loop: match (~96 min) + pre/post buffer. Fixed so the whole
 *  lobby agrees on which epoch is live. */
export const MATCH_PERIOD_SECONDS = 100 * 60
/** Seconds of "next match starting" build-up before kickoff each period. */
export const PRE_MATCH_SECONDS = 25

export interface CabinetSync {
  /** monotonically increasing match counter for this cabinet */
  epoch: number
  /** seed for createMatch() */
  seed: number
  /** match clock in seconds; negative = pre-match build-up */
  clock: number
  /** seconds until the NEXT match kicks off (useful for seat countdowns) */
  nextKickoffIn: number
}

/**
 * Deterministic lobby sync: seed from floor(now / matchPeriod) so every
 * visitor sees the SAME cabinet match at the SAME minute.
 */
export function cabinetNow(cabinetId: string, nowMs = Date.now()): CabinetSync {
  const nowSec = nowMs / 1000
  const epoch = Math.floor(nowSec / MATCH_PERIOD_SECONDS)
  const into = nowSec - epoch * MATCH_PERIOD_SECONDS
  const clock = into - PRE_MATCH_SECONDS
  return {
    epoch,
    seed: cabinetSeed(cabinetId, epoch),
    clock,
    nextKickoffIn: MATCH_PERIOD_SECONDS - into,
  }
}

/** Seed for (cabinet, epoch). */
export function cabinetSeed(cabinetId: string, epoch: number): number {
  return hashSeed(`${cabinetId}#${epoch}`)
}

/* ------------------------------------------------------------------ */
/* Simulation                                                          */
/* ------------------------------------------------------------------ */

/** position weights for goal involvement */
const scorerWeight = (p: EnginePlayer): number => {
  const pos =
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
  return pos * (0.5 + p.stats.off / 20)
}

const pickWeighted = (
  rand: () => number,
  items: EnginePlayer[],
  weight: (p: EnginePlayer) => number,
): EnginePlayer => {
  const ws = items.map(weight)
  const total = ws.reduce((a, b) => a + b, 0)
  let r = rand() * total
  for (let i = 0; i < items.length; i++) {
    r -= ws[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

const keeperOf = (xi: EnginePlayer[]) =>
  xi.find((p) => p.position === 'GK') ?? xi[0]

const minuteOf = (t: number) => Math.floor(t / 60)

/**
 * Simulate a full match. Deterministic: identical (seed, home, away) always
 * yields the identical timeline. Cost is trivial (~5.8k steps).
 */
export function createMatch(
  seedInput: number | string,
  home: TeamInput,
  away: TeamInput,
): MatchTimeline {
  const seed =
    typeof seedInput === 'string' ? hashSeed(seedInput) : seedInput >>> 0
  const rand = mulberry32(seed)

  const strengthHome = squadStrength(home.xi)
  const strengthAway = squadStrength(away.xi)

  const stoppage1 = 60 + Math.floor(rand() * 180)
  const stoppage2 = 120 + Math.floor(rand() * 240)
  const halfOneEnd = 45 * 60 + stoppage1
  const HT_BREAK = 60
  const duration = halfOneEnd + HT_BREAK + 45 * 60 + stoppage2

  /* expected goals per side from the strength matchup */
  const xg = (att: SquadStrength, def: SquadStrength) =>
    clamp(1.05 + (att.attack - def.defense) / 34 + (rand() - 0.5) * 0.6, 0.15, 4.2)
  const xgHome = xg(strengthHome, strengthAway)
  const xgAway = xg(strengthAway, strengthHome)
  const CONVERSION = 0.3 // share of chances that become goals (baseline)
  const pChanceHome = xgHome / (duration * CONVERSION)
  const pChanceAway = xgAway / (duration * CONVERSION)

  const possBase = clamp(
    0.5 + (strengthHome.midfield - strengthAway.midfield) / 160,
    0.34,
    0.66,
  )

  const events: MatchEvent[] = []
  const ballTrack = new Float32Array((duration + 2) * 2)
  const possessionTrack = new Float32Array(Math.floor(duration / 5) + 2)
  const staminaRates: number[] = []
  const bookingAt = new Int32Array(22).fill(-1)
  const subs: MatchTimeline['subs'] = []

  /* stamina drain rates (per played minute), home slots 0-10, away 11-21 */
  const drain = (p: EnginePlayer) =>
    p.position === 'GK'
      ? 0.16 + rand() * 0.06
      : clamp((21 - p.stats.sta) * 0.052 + 0.12 + rand() * 0.06, 0.2, 0.72)
  home.xi.forEach((p) => staminaRates.push(drain(p)))
  away.xi.forEach((p) => staminaRates.push(drain(p)))

  /* substitutions: 3 per side, 55'–82', highest-drain outfielders first */
  const benchNames = [
    'A. Conti', 'R. Serra', 'M. Almeida', 'T. Berger', 'K. Sato', 'L. Moreau',
    'D. Kovac', 'J. Park', 'E. Diallo', 'F. Russo', 'H. Lindgren', 'P. Novak',
  ]
  let benchIdx = Math.floor(rand() * benchNames.length)
  const planSubs = (side: TeamSide, xi: EnginePlayer[], offset: number) => {
    const order = xi
      .map((_, i) => ({ i, d: staminaRates[offset + i] }))
      .filter((s) => xi[s.i].position !== 'GK')
      .sort((a, b) => b.d - a.d)
      .slice(0, 3)
    order.forEach((s, k) => {
      const minute = 55 + Math.floor(rand() * 27) + k
      benchIdx = (benchIdx + 1 + Math.floor(rand() * 3)) % benchNames.length
      subs.push({
        slot: s.i,
        side,
        minute,
        onName: benchNames[benchIdx],
        onNumber: 12 + Math.floor(rand() * 20),
      })
    })
  }
  planSubs('home', home.xi, 0)
  planSubs('away', away.xi, 11)

  const push = (e: MatchEvent) => events.push(e)
  push({
    t: 0, minute: 0, stoppage: false, kind: 'kickoff', team: null,
    text: kickoffLine(home.name, away.name),
  })

  const score = { home: 0, away: 0 }
  const sentOff = new Set<number>()

  /* possession & ball random walks */
  let poss = possBase
  let bx = 0.5
  let by = 0.5
  let possIdx = 0

  const playing = (t: number) =>
    t <= halfOneEnd || t > halfOneEnd + HT_BREAK

  for (let t = 0; t <= duration; t++) {
    if (t % 5 === 0) possessionTrack[possIdx++] = poss
    ballTrack[t * 2] = bx
    ballTrack[t * 2 + 1] = by

    if (t === halfOneEnd) {
      push({
        t, minute: 45, stoppage: stoppage1 > 0, kind: 'halftime', team: null,
        text: halftimeLine(home.name, score.home, score.away),
      })
    }
    if (!playing(t)) continue

    /* mean-reverting walks (deterministic via rand) */
    poss += (possBase - poss) * 0.02 + (rand() - 0.5) * 0.012
    poss = clamp(poss, 0.25, 0.75)
    const homeHasBall = rand() < poss
    const targetX = homeHasBall ? 0.72 : 0.28
    bx += (targetX - bx) * 0.03 + (rand() - 0.5) * 0.05
    by += (0.5 - by) * 0.03 + (rand() - 0.5) * 0.06
    bx = clamp(bx, 0.04, 0.96)
    by = clamp(by, 0.06, 0.94)

    const minute = minuteOf(t)
    const stoppage =
      (t > 45 * 60 && t <= halfOneEnd) || t > halfOneEnd + HT_BREAK + 45 * 60

    /* chance events */
    for (const side of ['home', 'away'] as const) {
      const p = side === 'home' ? pChanceHome : pChanceAway
      if (rand() >= p) continue
      const xi = side === 'home' ? home.xi : away.xi
      const off = side === 'home' ? strengthHome : strengthAway
      const defXI = side === 'home' ? away.xi : home.xi
      const defStr = side === 'home' ? strengthAway : strengthHome
      const offset = side === 'home' ? 0 : 11
      const teamName = side === 'home' ? home.name : away.name

      const available = xi.filter((_, i) => !sentOff.has(offset + i))
      const shooter = pickWeighted(rand, available, scorerWeight)
      const shooterSlot = xi.indexOf(shooter)
      const keeper = keeperOf(defXI)

      const goalProb = clamp(
        0.2 + (off.attack - defStr.keeper) / 220 + (shooter.stats.off - 14) / 90,
        0.06,
        0.52,
      )
      if (rand() < goalProb) {
        score[side]++
        const useAssist = rand() < 0.68
        const assister = useAssist
          ? pickWeighted(
              rand,
              available.filter((p) => p !== shooter),
              (p) => 0.3 + p.stats.tec / 20,
            )
          : null
        push({
          t, minute, stoppage, kind: 'goal', team: side,
          player: shooter.name, assist: assister?.name ?? undefined,
          text: goalLine(rand, shooter.name, teamName, assister?.name ?? null),
        })
        /* celebrating at the attacking goal */
        bx = side === 'home' ? 0.95 : 0.05
        by = 0.5
      } else if (rand() < 0.58) {
        push({
          t, minute, stoppage, kind: 'chance', team: side,
          player: shooter.name,
          text: chanceLine(rand, shooter.name, keeper.name),
        })
        bx = side === 'home' ? 0.86 : 0.14
      } else {
        push({
          t, minute, stoppage, kind: 'miss', team: side,
          player: shooter.name,
          text: missLine(rand, shooter.name),
        })
        bx = side === 'home' ? 0.8 : 0.2
      }
      void shooterSlot
    }

    /* bookings */
    if (rand() < 0.00042) {
      const side: TeamSide = rand() < 0.5 ? 'home' : 'away'
      const xi = side === 'home' ? home.xi : away.xi
      const offset = side === 'home' ? 0 : 11
      const candidates = xi
        .map((p, i) => ({ p, i }))
        .filter((c) => c.p.position !== 'GK' && !sentOff.has(offset + c.i))
      if (candidates.length) {
        const { p, i } = candidates[Math.floor(rand() * candidates.length)]
        const prev = bookingAt[offset + i]
        if (prev >= 0 && rand() < 0.3) {
          bookingAt[offset + i] = minute + 500 // second yellow → red
          sentOff.add(offset + i)
          push({
            t, minute, stoppage, kind: 'red', team: side, player: p.name,
            text: redLine(rand, p.name),
          })
        } else if (prev < 0) {
          bookingAt[offset + i] = minute
          push({
            t, minute, stoppage, kind: 'yellow', team: side, player: p.name,
            text: yellowLine(rand, p.name),
          })
        }
      }
    }

    /* substitutions fire on their minute */
    for (const s of subs) {
      if (s.minute === minute && t % 60 === 12) {
        const xi = s.side === 'home' ? home.xi : away.xi
        const teamName = s.side === 'home' ? home.name : away.name
        push({
          t, minute, stoppage, kind: 'sub', team: s.side,
          player: xi[s.slot].name, assist: s.onName,
          text: subLine(xi[s.slot].name, s.onName, teamName),
        })
      }
    }
  }

  push({
    t: duration, minute: minuteOf(duration), stoppage: true, kind: 'fulltime',
    team: null,
    text: fulltimeLine(home.name, away.name, score.home, score.away),
  })

  return {
    seed, home, away, strengthHome, strengthAway, events, duration,
    halfOneEnd, finalScore: { ...score }, staminaRates, bookingAt, subs,
    ballTrack, possessionTrack,
  }
}

/* ------------------------------------------------------------------ */
/* 1 Hz state                                                          */
/* ------------------------------------------------------------------ */

/** Binary search: count of events with t <= clock. */
const eventsBefore = (tl: MatchTimeline, clock: number) => {
  let lo = 0
  let hi = tl.events.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (tl.events[mid].t <= clock) lo = mid + 1
    else hi = mid
  }
  return lo
}

const HEADLINE_KINDS = new Set(['goal', 'chance', 'miss', 'yellow', 'red', 'sub'])

function liveXI(
  tl: MatchTimeline,
  side: TeamSide,
  clock: number,
): PlayerLive[] {
  const xi = side === 'home' ? tl.home.xi : tl.away.xi
  const offset = side === 'home' ? 0 : 11
  return xi.map((p, slot) => {
    const idx = offset + slot
    const sub = tl.subs.find((s) => s.side === side && s.slot === slot)
    const subbedOff = !!sub && clock >= sub.minute * 60 + 12
    const playedMin = subbedOff
      ? sub.minute
      : Math.max(0, clock / 60 - 0)
    const staminaOff = clamp(100 - tl.staminaRates[idx] * playedMin, 5, 100)
    const subOnStamina = clamp(
      96 - tl.staminaRates[idx] * 0.4 * Math.max(0, clock / 60 - (sub?.minute ?? 0)),
      5,
      100,
    )
    const b = tl.bookingAt[idx]
    const booked = b >= 500 ? 'red' : b >= 0 && clock >= b * 60 ? 'yellow' : null
    const overall =
      (p.stats.off + p.stats.def + p.stats.tec + p.stats.pow + p.stats.spd + p.stats.sta) / 6
    if (subbedOff || (sub && clock >= sub.minute * 60 + 12)) {
      return {
        name: sub!.onName,
        number: sub!.onNumber,
        position: p.position,
        strength: clamp(overall * 4.2, 20, 88),
        stamina: subOnStamina,
        card: booked === 'red' ? 'red' : null,
        subbedOff: false,
        subbedOn: true,
        subMinute: sub!.minute,
      }
    }
    return {
      name: p.name,
      number: p.number,
      position: p.position,
      strength: clamp(overall * 5, 25, 100),
      stamina: staminaOff,
      card: booked,
      subbedOff: false,
      subbedOn: false,
      subMinute: null,
    }
  })
}

/** Snapshot the match at `clock` seconds. Cheap enough to call every frame. */
export function stateAt(tl: MatchTimeline, clock: number): MatchState {
  const c = clamp(clock, 0, tl.duration)
  const n = eventsBefore(tl, c)
  const visible = tl.events.slice(0, n).reverse()
  const headline =
    visible.find((e) => HEADLINE_KINDS.has(e.kind)) ?? visible[0] ?? null
  const score = { home: 0, away: 0 }
  for (let i = 0; i < n; i++) {
    const e = tl.events[i]
    if (e.kind === 'goal' && e.team) score[e.team]++
  }
  const bi = Math.min(Math.floor(c), tl.ballTrack.length / 2 - 1)
  const pi = Math.min(Math.floor(c / 5), tl.possessionTrack.length - 1)
  return {
    clock: c,
    displayClock: formatClock(tl, c),
    displayMinute: Math.floor(c / 60),
    half: halfAt(tl, c),
    phase: phaseAt(tl, clock),
    score,
    possession: tl.possessionTrack[pi],
    ball: { x: tl.ballTrack[bi * 2], y: tl.ballTrack[bi * 2 + 1] },
    events: visible,
    headline,
    homeXI: liveXI(tl, 'home', c),
    awayXI: liveXI(tl, 'away', c),
    strengthHome: tl.strengthHome,
    strengthAway: tl.strengthAway,
  }
}

/* ------------------------------------------------------------------ */
/* Pitch dots for the top-down viewer                                  */
/* ------------------------------------------------------------------ */

/** 4-4-2 anchors (x: own goal → opponent goal, y: left → right touchline). */
const FORMATION_442: [number, number][] = [
  [0.06, 0.5], // GK
  [0.22, 0.16], [0.2, 0.39], [0.2, 0.61], [0.22, 0.84], // back four
  [0.46, 0.14], [0.43, 0.4], [0.43, 0.6], [0.46, 0.86], // midfield
  [0.68, 0.36], [0.68, 0.64], // strikers
]

/**
 * Deterministic dot positions for the pitch view at a given clock.
 * Pure function of (seed, clock) — no stored state needed.
 */
export function pitchDots(tl: MatchTimeline, clock: number): PitchDot[] {
  const dots: PitchDot[] = []
  const t = clock
  const bi = Math.min(Math.floor(clamp(t, 0, tl.duration)), tl.ballTrack.length / 2 - 1)
  const bx = tl.ballTrack[bi * 2]
  const by = tl.ballTrack[bi * 2 + 1]
  for (const side of ['home', 'away'] as const) {
    const mirror = side === 'away'
    for (let i = 0; i < 11; i++) {
      const [ax0, ay] = FORMATION_442[i]
      const ax = mirror ? 1 - ax0 : ax0
      const ph = ((tl.seed >> (i % 24)) & 0xff) / 40 + i * 1.7
      const w1 = 0.11 + (i % 5) * 0.017
      const w2 = 0.09 + (i % 3) * 0.021
      /* drift toward the ball + small organic wiggle */
      const pull = i === 0 ? 0.04 : 0.22
      const tx = mirror ? 1 - bx : bx
      const x =
        ax +
        (tx - ax) * pull * 0.5 +
        Math.sin(t * w1 + ph) * (i === 0 ? 0.008 : 0.028)
      const y =
        ay +
        (by - ay) * pull * 0.35 +
        Math.cos(t * w2 + ph * 1.3) * (i === 0 ? 0.01 : 0.05)
      dots.push({ side, x: clamp(x, 0.03, 0.97), y: clamp(y, 0.04, 0.96) })
    }
  }
  dots.push({ side: 'ball', x: bx, y: by })
  return dots
}
