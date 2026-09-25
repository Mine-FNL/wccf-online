/**
 * Seat match flow — pure helpers.
 *
 * Builds the user's XI from club.me (lineupJson + formation, with best-total
 * auto-fill for empty slots), builds a deterministic AI opponent from the
 * cabinet's card pool, derives the opponent's ELO-ish rating from the
 * strength delta, and maps an engine timeline onto the match.report payload.
 */
import type { PlayerCardData } from '@/lib/data/types'
import type { Cabinet, CabinetEra } from '@/lib/data/cabinets'
import { allCards, byId, cardTotal, filterCards } from '@/lib/data/cards'
import { aiClubAt, type AiClub } from '@/lib/data/aiClubs'
import {
  cardToEnginePlayer,
  hashSeed,
  mulberry32,
  squadStrength,
  teamFromCards,
  type MatchEvent,
  type MatchEventKind,
  type MatchTimeline,
  type SquadStrength,
  type TeamInput,
} from '@/lib/engine'
import type { MatchTimeline2, TeamInput2 } from '@/lib/engine2'
import { parseArrangement } from '@/lib/arrangement'

/* ------------------------------------------------------------------ */
/* Positions                                                           */
/* ------------------------------------------------------------------ */

export type PosGroup = 'GK' | 'DEF' | 'MID' | 'FWD'

/** Card position vocabulary → line groups (covers both the sample DB
 *  positions and the wider final-database vocabulary). */
const GROUP_OF: Record<string, PosGroup> = {
  GK: 'GK',
  DF: 'DEF', CB: 'DEF', SB: 'DEF', WB: 'DEF', LSB: 'DEF', RSB: 'DEF',
  DMF: 'MID', CMF: 'MID', SMF: 'MID', OMF: 'MID', MF: 'MID',
  WF: 'FWD', CF: 'FWD', ST: 'FWD', FW: 'FWD',
}

export function posGroup(pos: string): PosGroup {
  return GROUP_OF[pos] ?? 'MID'
}

/** A card can cover a lineup slot when it shares the slot's position or,
 *  for outfield slots, plays anywhere in the same line group. */
export function isCompatible(cardPositions: string[], slotPos: string): boolean {
  if (cardPositions.includes(slotPos)) return true
  if (slotPos === 'GK') return cardPositions.includes('GK')
  const g = posGroup(slotPos)
  return cardPositions.some((p) => posGroup(p) === g)
}

/* ------------------------------------------------------------------ */
/* Formation → 11 slot positions (slot 0 = GK, then each line)         */
/* ------------------------------------------------------------------ */

const DEF_LINE: Record<number, string[]> = {
  2: ['CB', 'CB'],
  3: ['CB', 'CB', 'CB'],
  4: ['LSB', 'CB', 'CB', 'RSB'],
  5: ['LSB', 'CB', 'CB', 'CB', 'RSB'],
}
const MID_LINE: Record<number, string[]> = {
  1: ['CMF'],
  2: ['DMF', 'OMF'],
  3: ['DMF', 'CMF', 'OMF'],
  4: ['SMF', 'CMF', 'CMF', 'SMF'],
  5: ['SMF', 'DMF', 'CMF', 'OMF', 'SMF'],
}
const FWD_LINE: Record<number, string[]> = {
  1: ['CF'],
  2: ['FW', 'CF'],
  3: ['FW', 'CF', 'FW'],
  4: ['WF', 'FW', 'CF', 'WF'],
  5: ['WF', 'FW', 'CF', 'FW', 'WF'],
}

function line(table: Record<number, string[]>, n: number, fill: string): string[] {
  if (table[n]) return table[n]
  return Array.from({ length: n }, (_, i) => table[Math.min(5, Math.max(1, n))]?.[i] ?? fill)
}

/** "4-4-2" → ['GK', 'LSB','CB','CB','RSB', 'SMF','CMF','CMF','SMF', 'FW','CF'] */
export function formationPositions(formation: string): string[] {
  const lines = formation
    .split('-')
    .map((n) => Math.max(0, Math.min(5, Number(n) || 0)))
    .filter((n) => n > 0)
  const out = ['GK']
  lines.forEach((n, i) => {
    const isLast = i === lines.length - 1
    const isFirst = i === 0
    if (lines.length === 1) out.push(...line(MID_LINE, n, 'CMF'))
    else if (isFirst) out.push(...line(DEF_LINE, n, 'CB'))
    else if (isLast) out.push(...line(FWD_LINE, n, 'CF'))
    else out.push(...line(MID_LINE, n, 'CMF'))
  })
  while (out.length < 11) out.push('CMF')
  return out.slice(0, 11)
}

/* ------------------------------------------------------------------ */
/* User XI from club.me                                                */
/* ------------------------------------------------------------------ */

/** Minimal shape of the club row the flow needs (club.me → club). */
export interface ClubSnapshot {
  /** present on the real club row; used for localStorage keys (styles,
   *  arrangement) — may be absent in tests */
  id?: number | string
  name: string
  shortName: string
  kitPrimary: string
  kitSecondary: string
  formation: string
  rating: number
  credits: number
  lineupJson: unknown
  /** hexagon practice levels live here ({off,def,pas,pos,spe,pow} 0–5) */
  trainingJson?: unknown
}

export interface LineupSlotInput {
  slot: number
  cardId: string | null
  kp: boolean
}

/** Coerce club.lineupJson (drizzle json) into 11 normalized slots. */
export function parseLineup(json: unknown): LineupSlotInput[] {
  const raw = Array.isArray(json) ? json : []
  const slots: LineupSlotInput[] = []
  for (let i = 0; i < 11; i++) {
    const r = raw.find(
      (s): s is { slot?: unknown; cardId?: unknown; kp?: unknown } =>
        !!s && typeof s === 'object' && (s as { slot?: unknown }).slot === i,
    )
    slots.push({
      slot: i,
      cardId: typeof r?.cardId === 'string' ? r.cardId : null,
      kp: r?.kp === true,
    })
  }
  return slots
}

export interface UserSlot {
  position: string
  card: PlayerCardData
  kp: boolean
  /** slot was empty (or its card was missing) and got auto-filled */
  autoFilled: boolean
}

export interface UserXI {
  slots: UserSlot[]
  /** 11 cards in slot order — feeds teamFromCards */
  cards: PlayerCardData[]
  autoFilled: number
  strength: SquadStrength
}

/**
 * Build the match XI from the club's saved lineup. Empty/invalid slots are
 * auto-filled with the best-total position-compatible owned card.
 */
export function buildUserXI(
  club: ClubSnapshot,
  ownedCardIds: string[],
): UserXI {
  const positions = formationPositions(club.formation)
  const lineup = parseLineup(club.lineupJson)

  const owned: PlayerCardData[] = []
  const seen = new Set<string>()
  for (const id of ownedCardIds) {
    if (seen.has(id)) continue
    seen.add(id)
    const c = byId(id)
    if (c) owned.push(c)
  }

  const used = new Set<string>()
  const slots: UserSlot[] = positions.map((position, i) => {
    const slot = lineup[i]
    const saved = slot.cardId ? byId(slot.cardId) : undefined
    if (saved && !used.has(saved.id)) {
      used.add(saved.id)
      return { position, card: saved, kp: slot.kp, autoFilled: false }
    }
    /* auto-fill: best-total compatible, then best-total anything owned */
    const compatible = owned
      .filter((c) => !used.has(c.id) && isCompatible(c.positions, position))
      .sort((a, b) => cardTotal(b) - cardTotal(a))
    const fallback = owned
      .filter((c) => !used.has(c.id))
      .sort((a, b) => cardTotal(b) - cardTotal(a))
    const pick = compatible[0] ?? fallback[0] ??
      /* pathological: fewer than 11 unique owned cards — borrow from the db */
      allCards().filter((c) => !used.has(c.id)).sort((a, b) => cardTotal(b) - cardTotal(a))[0]
    used.add(pick.id)
    return { position, card: pick, kp: slot.kp, autoFilled: true }
  })

  const cards = slots.map((s) => s.card)
  return {
    slots,
    cards,
    autoFilled: slots.filter((s) => s.autoFilled).length,
    strength: squadStrength(cards.map(cardToEnginePlayer)),
  }
}

/* ------------------------------------------------------------------ */
/* AI opponent (deterministic per cabinet + 15-min time window)        */
/* ------------------------------------------------------------------ */

/** Rarities the Legends cabinet draws from (mirrors data/cabinets.ts). */
const LEGENDS_RARITIES = ['ATLE', 'RAR', 'WBE', 'MVP', 'WGK'] as const

const AI_COLORS = ['#3DD68C', '#4DD0E1', '#FF3D71', '#E8B84B', '#7A5CFF', '#FFC531']

/** Primary line group of a card (engine uses positions[0] too). */
const primaryGroup = (c: PlayerCardData): PosGroup =>
  c.positions.includes('GK') ? 'GK' : posGroup(c.positions[0])

/** Minimum pool depth per line so a sensible XI is always pickable. */
const POOL_NEED: [PosGroup, number][] = [
  ['GK', 1],
  ['DEF', 4],
  ['MID', 4],
  ['FWD', 2],
]

/** Pool of cards an AI club can field on this cabinet. */
function opponentPool(cabinet: Cabinet): PlayerCardData[] {
  const pool =
    cabinet.version === 'all'
      ? filterCards({ rarity: [...LEGENDS_RARITIES] })
      : filterCards({ version: cabinet.version })
  /* thin sample pools — top up per line group with the best available cards */
  for (const [g, need] of POOL_NEED) {
    const have = () => pool.filter((c) => primaryGroup(c) === g).length
    if (have() >= need) continue
    const extras = [
      ...filterCards({ rarity: [...LEGENDS_RARITIES] }),
      ...allCards(),
    ]
      .filter((c) => !pool.includes(c) && primaryGroup(c) === g)
      .sort((a, b) => cardTotal(b) - cardTotal(a))
    for (const c of extras) {
      if (have() >= need) break
      if (pool.includes(c)) continue
      pool.push(c)
    }
  }
  return pool
}

/**
 * Sensible AI XI from the pool: 1 GK, ≥3 defenders, ≥3 midfielders,
 * ≥1 forward, then the best remaining outfielders — highest totals first,
 * ties broken deterministically by seed.
 */
function pickOpponentXI(pool: PlayerCardData[], rand: () => number): PlayerCardData[] {
  const shuffled = [...pool].sort(() => rand() - 0.5)
  const ranked = shuffled.sort((a, b) => cardTotal(b) - cardTotal(a))
  const used = new Set<string>()
  const xi: PlayerCardData[] = []

  const take = (pred: (c: PlayerCardData) => boolean, count: number) => {
    for (const c of ranked) {
      if (count <= 0) break
      if (used.has(c.id) || !pred(c)) continue
      used.add(c.id)
      xi.push(c)
      count--
    }
    return count
  }

  /* 1 GK, ≥3 DEF, ≥3 MID, ≥1 FWD — then the strongest remaining outfielders */
  take((c) => primaryGroup(c) === 'GK', 1)
  take((c) => primaryGroup(c) === 'DEF', 3)
  take((c) => primaryGroup(c) === 'MID', 3)
  take((c) => primaryGroup(c) === 'FWD', 1)
  take((c) => primaryGroup(c) !== 'GK', 11 - xi.length)
  /* pathological thin pool — anything left */
  take(() => true, 11 - xi.length)
  return xi.slice(0, 11)
}

/** Five bench cards for the AI club (engine2 bench — the panel's 5 subs). */
function pickOpponentBench(
  pool: PlayerCardData[],
  xi: PlayerCardData[],
  rand: () => number,
): PlayerCardData[] {
  const used = new Set(xi.map((c) => c.id))
  const rest = pool
    .filter((c) => !used.has(c.id))
    .sort(() => rand() - 0.5)
    .sort((a, b) => cardTotal(b) - cardTotal(a))
  const bench: PlayerCardData[] = []
  const gk = rest.find((c) => c.positions.includes('GK'))
  if (gk) bench.push(gk)
  for (const c of rest) {
    if (bench.length >= 5) break
    if (!bench.includes(c)) bench.push(c)
  }
  return bench.slice(0, 5)
}

export interface OpponentPlan {
  club: AiClub
  cards: PlayerCardData[]
  /** the 5 sub cards on the AI panel (engine2) */
  benchCards: PlayerCardData[]
  team: TeamInput
  strength: SquadStrength
  /** 100..4000 — base 1400 adjusted by the strength delta */
  rating: number
  /** seed for createMatch */
  seed: number
}

export interface UserPlan {
  xi: UserXI
  team: TeamInput
}

export interface KickoffPlan {
  home: TeamInput
  away: TeamInput
  seed: number
  opponent: AiClub
  opponentRating: number
  /** engine2 teams (bench/era/styles/abilities/condition/management) —
   *  assembled by match2 PreMatch at kickoff; required by MatchScreen */
  home2?: TeamInput2
  away2?: TeamInput2
  /** cabinet era driving the button console (match2) */
  era?: CabinetEra
}

/* ------------------------------------------------------------------ */
/* engine2 → engine v1 timeline adapter (Theatre / report pipeline)    */
/* ------------------------------------------------------------------ */

const V1_KINDS = new Set<string>([
  'kickoff', 'goal', 'chance', 'miss', 'yellow', 'red',
  'sub', 'halftime', 'fulltime', 'info',
])

const clamp01 = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

/**
 * Project a MatchTimeline2 onto the v1 MatchTimeline shape so
 * `buildReportTimeline`, the Theatre tape and RewardReveal keep working
 * unchanged (gameplay-fidelity-spec §7 — engine2 drives the seat flow).
 *
 * - `window-resolve` events are mapped back to v1 goal/chance/miss kinds
 *   (merged with the engine's follow-up event so assist + commentary text
 *   survive; the duplicate follow-up is dropped).
 * - v2-only kinds (window-open, tactic, steal, talk, style, skill, hotline,
 *   break, pk) degrade to 'info'.
 * - bookingAt is rebuilt per XI slot from yellow/red events (v1 convention:
 *   red = minute + 500).
 * - ballTrack / possessionTrack are synthesized deterministically from the
 *   seed (engine2 streams ball position live instead of recording it).
 */
export function toV1Timeline(tl2: MatchTimeline2): MatchTimeline {
  /* ---- events ---- */
  const skip = new Set<number>()
  const events: MatchEvent[] = []
  tl2.events.forEach((e, i) => {
    if (skip.has(i)) return
    if (e.kind === 'window-resolve') {
      const outcome = e.data?.outcome
      const kind: MatchEventKind =
        outcome === 'goal' ? 'goal' : outcome === 'saved' ? 'chance' : 'miss'
      const j = tl2.events.findIndex(
        (f, k) => k > i && f.t === e.t && f.kind === kind && f.player === e.player,
      )
      if (j >= 0) {
        skip.add(j)
        const f = tl2.events[j]
        events.push({
          t: f.t, minute: f.minute, stoppage: f.stoppage, kind,
          team: f.team, player: f.player, assist: f.assist, text: f.text,
        })
      } else {
        events.push({
          t: e.t, minute: e.minute, stoppage: e.stoppage, kind,
          team: e.team, player: e.player, text: e.text,
        })
      }
      return
    }
    const kind = (
      V1_KINDS.has(e.kind) ? e.kind : 'info'
    ) as MatchEventKind
    events.push({
      t: e.t, minute: e.minute, stoppage: e.stoppage, kind,
      team: e.team, player: e.player, assist: e.assist, text: e.text,
    })
  })

  /* ---- bookings per XI slot (home 0–10, away 11–21) ---- */
  const bookingAt = new Int32Array(22).fill(-1)
  const slotOf = (team: 'home' | 'away', name?: string): number => {
    if (!name) return -1
    const xi = team === 'home' ? tl2.home.xi : tl2.away.xi
    const i = xi.findIndex((p) => p.name === name)
    return i < 0 ? -1 : i + (team === 'away' ? 11 : 0)
  }
  for (const e of tl2.events) {
    if (e.kind !== 'yellow' && e.kind !== 'red') continue
    if (!e.team) continue
    const slot = slotOf(e.team, e.player)
    if (slot < 0) continue
    bookingAt[slot] = e.kind === 'red' ? e.minute + 500 : e.minute
  }

  /* ---- deterministic ball / possession tracks (v1 viewer contract) ---- */
  const rand = mulberry32(hashSeed(`${tl2.seed}:v1tracks`))
  const ballTrack = new Float32Array((tl2.duration + 2) * 2)
  let bx = 0.5
  let by = 0.5
  for (let t = 0; t < tl2.duration + 2; t++) {
    bx = clamp01(bx + (0.5 - bx) * 0.02 + (rand() - 0.5) * 0.09, 0.04, 0.96)
    by = clamp01(by + (0.5 - by) * 0.02 + (rand() - 0.5) * 0.09, 0.06, 0.94)
    ballTrack[t * 2] = bx
    ballTrack[t * 2 + 1] = by
  }
  const possessionTrack = new Float32Array(Math.floor(tl2.duration / 5) + 2)
  let poss = 0.5
  for (let i = 0; i < possessionTrack.length; i++) {
    poss = clamp01(poss + (rand() - 0.5) * 0.06, 0.3, 0.7)
    possessionTrack[i] = poss
  }

  const strip = (t: TeamInput2): TeamInput => ({
    name: t.name,
    short: t.short,
    color: t.color,
    xi: t.xi,
  })

  return {
    seed: tl2.seed,
    home: strip(tl2.home),
    away: strip(tl2.away),
    strengthHome: tl2.strengthHome,
    strengthAway: tl2.strengthAway,
    events,
    duration: tl2.duration,
    halfOneEnd: tl2.halfOneEnd,
    finalScore: { ...tl2.finalScore },
    staminaRates: [...tl2.staminaRates],
    bookingAt,
    subs: tl2.subs.map((s) => ({ ...s })),
    ballTrack,
    possessionTrack,
  }
}

/** Deterministic opponent for (cabinet, 15-minute window, seat, attempt). */
export function buildOpponent(
  cabinet: Cabinet,
  userStrength: SquadStrength,
  seat: number,
  nonce: number,
  nowMs = Date.now(),
): OpponentPlan {
  const windowIdx = Math.floor(nowMs / (15 * 60 * 1000))
  const h = hashSeed(`${cabinet.id}|${windowIdx}|${seat}|${nonce}`)
  const rand = mulberry32(h ^ 0x9e3779b9)
  const club = aiClubAt(h)
  const pool = opponentPool(cabinet)
  const cards = pickOpponentXI(pool, rand)
  const benchCards = pickOpponentBench(pool, cards, rand)

  const short =
    club.club.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'CPU'
  const color = AI_COLORS[h % AI_COLORS.length]
  const team = teamFromCards(club.club, short, color, cards)
  const strength = squadStrength(team.xi)
  const rating = Math.min(
    4000,
    Math.max(100, Math.round(1400 + (userStrength.overall - strength.overall) * 25)),
  )
  return { club, cards, benchCards, team, strength, rating, seed: h }
}

/* ------------------------------------------------------------------ */
/* match.report payload                                                */
/* ------------------------------------------------------------------ */

export interface ReportTimelineEvent {
  min: number
  type: string
  team?: string
  player?: string
  detail?: string
}

const REPORT_KINDS = new Set(['goal', 'yellow', 'red', 'sub', 'halftime', 'fulltime'])

/** Engine events → condensed report timeline (goals, bookings, subs,
 *  half-time, full-time; capped at 60 entries per the API contract). */
export function buildReportTimeline(tl: MatchTimeline): ReportTimelineEvent[] {
  return tl.events
    .filter((e) => REPORT_KINDS.has(e.kind))
    .slice(0, 60)
    .map((e) => ({
      min: Math.min(130, Math.max(0, e.minute)),
      type: e.kind,
      team: e.team ?? undefined,
      player: e.player?.slice(0, 60),
      detail:
        e.kind === 'goal' && e.assist
          ? `Assist: ${e.assist}`.slice(0, 120)
          : undefined,
    }))
}

/** API contract clamps scorelines to 0..12. */
export function clampScore(n: number): number {
  return Math.min(12, Math.max(0, Math.round(n)))
}

/* ------------------------------------------------------------------ */
/* Panel bench + line nudges (arrangement editor localStorage)         */
/* ------------------------------------------------------------------ */

const arrangementKey = (club: ClubSnapshot) =>
  `wccf-arrangement:v2:${String(club.id ?? club.shortName)}`

function readArrangement(club: ClubSnapshot) {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(arrangementKey(club))
    return raw ? parseArrangement(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

/** Line nudges from the arrangement editor (forward/back card gestures). */
export function arrangementNudges(club: ClubSnapshot): { df: number; mf: number; fw: number } {
  const n = readArrangement(club)?.nudges
  return n ? { df: n.df, mf: n.mf, fw: n.fw } : { df: 0, mf: 0, fw: 0 }
}

/**
 * The panel's 5 sub cards for the seat match: the arrangement editor's bench
 * first (owned, not in the XI), topped up with the best-total owned cards
 * not already selected.
 */
export function userBenchCards(
  club: ClubSnapshot,
  xi: UserXI,
  ownedCardIds: string[],
): PlayerCardData[] {
  const xiIds = new Set(xi.cards.map((c) => c.id))
  const out: PlayerCardData[] = []
  const arr = readArrangement(club)
  if (arr) {
    for (const id of arr.bench) {
      const c = id ? byId(id) : undefined
      if (c && !xiIds.has(c.id) && !out.includes(c) && ownedCardIds.includes(c.id)) out.push(c)
    }
  }
  const seen = new Set<string>()
  const rest = ownedCardIds
    .map(byId)
    .filter((c): c is PlayerCardData => !!c)
    .filter((c) => {
      if (xiIds.has(c.id) || out.includes(c) || seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
    .sort((a, b) => cardTotal(b) - cardTotal(a))
  for (const c of rest) {
    if (out.length >= 5) break
    out.push(c)
  }
  return out.slice(0, 5)
}
