/**
 * match2 catalogs — KP-era Team Styles, Footista manager abilities,
 * half-time team talks and seeded condition arrows
 * (gameplay-fidelity-spec §3, §4, §6).
 *
 * Pure data + tiny helpers; no React.
 */
import { hashSeed, mulberry32 } from '@/lib/engine'
import type { Arrow, Style } from '@/lib/engine2'

/* ------------------------------------------------------------------ */
/* Condition arrows (spec §3.2 — ↑↗→↘↓, seeded)                        */
/* ------------------------------------------------------------------ */

export const ARROW_GLYPH: Record<Arrow, string> = {
  up: '↑',
  'up-right': '↗',
  flat: '→',
  'down-right': '↘',
  down: '↓',
}

export const ARROW_TONE: Record<Arrow, 'good' | 'ok' | 'flat' | 'meh' | 'bad'> = {
  up: 'good',
  'up-right': 'ok',
  flat: 'flat',
  'down-right': 'meh',
  down: 'bad',
}

/**
 * engine2 does not expose its pre-match arrows before createStepper, so the
 * pre-match screen derives them from the engine's own hashSeed/mulberry32 on
 * (seed, salt) and hands them back to the stepper via TeamInput2.condition —
 * display and engine always agree. Distribution mirrors engine2/sim.genArrow.
 */
export function seededArrows(seed: number, salt: string, n: number): Arrow[] {
  const rand = mulberry32(hashSeed(`${seed}:cond:${salt}`))
  return Array.from({ length: n }, () => {
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
  })
}

/* ------------------------------------------------------------------ */
/* Half-time team talks (spec §4 — exact names + effects)              */
/* ------------------------------------------------------------------ */

export interface TalkDef {
  name: string
  /** hexagon delta hint, e.g. "+OFF −DEF" */
  hint: string
  detail: string
}

export const TALKS: TalkDef[] = [
  {
    name: 'Push higher',
    hint: '+OFF −DEF +SPIRIT',
    detail: 'Offence +8 · Defence −5 · Spirit +6',
  },
  {
    name: 'Stay calm, keep the ball',
    hint: '+POS +SPIRIT',
    detail: 'Possession +8 · Spirit +4',
  },
  {
    name: 'Win every duel',
    hint: '+WIN +SPIRIT −STA',
    detail: 'Winning +8 · Spirit +8 · Stamina −5 all',
  },
]

/* ------------------------------------------------------------------ */
/* KP-era Team Styles (spec §4, §6 — E→S ranks, rank up with use)      */
/* ------------------------------------------------------------------ */

export type StyleSlot = 'off' | 'def' | 'sup'

export interface StyleDef {
  name: string
  slot: StyleSlot
  blurb: string
}

/** Fixed catalog — 3 styles per Off/Def/Sup slot. */
export const STYLE_CATALOG: StyleDef[] = [
  { name: 'Poacher', slot: 'off', blurb: 'CF scorer weight up' },
  { name: 'Wing Play', slot: 'off', blurb: 'Wide finishers sharpen' },
  { name: 'Direct Attack', slot: 'off', blurb: 'Fast vertical breaks' },
  { name: 'Iron Curtain', slot: 'def', blurb: 'Conversion against drops' },
  { name: 'Offside Trap', slot: 'def', blurb: 'Line steps up together' },
  { name: 'Hard Tackle', slot: 'def', blurb: 'Duels get physical' },
  { name: 'Possession', slot: 'sup', blurb: 'Chance frequency up' },
  { name: 'One-Two', slot: 'sup', blurb: 'Quick combinations' },
  { name: 'Long Ball', slot: 'sup', blurb: 'Early service forward' },
]

export const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'] as const
export type StyleRank = (typeof RANKS)[number]

/** Uses needed to advance one rank. */
const USES_PER_RANK = 3

interface StoredStyle {
  rank: StyleRank
  progress: number
}

type StyleStore = Record<string, StoredStyle>

const readStore = (key: string): StyleStore => {
  try {
    if (typeof window === 'undefined') return {}
    const raw = window.localStorage.getItem(key)
    if (!raw) return {}
    const j = JSON.parse(raw) as Record<string, unknown>
    const out: StyleStore = {}
    for (const [k, v] of Object.entries(j)) {
      const r = v as Partial<StoredStyle>
      if (r && typeof r.progress === 'number' && RANKS.includes(r.rank as StyleRank)) {
        out[k] = { rank: r.rank as StyleRank, progress: r.progress }
      }
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Load the club's style ranks from localStorage (`wccf-styles:<clubId>`),
 * defaulting every catalog style to rank E with 0 progress.
 */
export function loadStyleRanks(clubKey: string): Record<string, Style> {
  const store = readStore(`wccf-styles:${clubKey}`)
  const out: Record<string, Style> = {}
  for (const def of STYLE_CATALOG) {
    out[def.name] = { name: def.name, rank: store[def.name]?.rank ?? 'E' }
  }
  return out
}

/**
 * +1 rank progress per use (a match kicked off with the style selected);
 * every USES_PER_RANK uses the letter rank climbs E→S. Returns the new ranks.
 */
export function bumpStyleProgress(clubKey: string, used: string[]): Record<string, Style> {
  const storageKey = `wccf-styles:${clubKey}`
  const store = readStore(storageKey)
  for (const name of used) {
    const cur = store[name] ?? { rank: 'E' as StyleRank, progress: 0 }
    let { progress } = cur
    let { rank } = cur
    progress += 1
    if (progress >= USES_PER_RANK && rank !== 'S') {
      rank = RANKS[RANKS.indexOf(rank) + 1]
      progress = 0
    }
    store[name] = { rank, progress }
  }
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, JSON.stringify(store))
    }
  } catch {
    /* storage unavailable — ranks just don't persist */
  }
  return loadStyleRanks(clubKey)
}

/** Style-slot a rubbed panel card activates (FW/OMF→off, DF/GK→def, else sup). */
export function styleSlotForPosition(position: string): StyleSlot {
  if (['FW', 'CF', 'WF', 'ST', 'OMF'].includes(position)) return 'off'
  if (['GK', 'CB', 'LSB', 'RSB', 'DF', 'SB', 'WB'].includes(position)) return 'def'
  return 'sup'
}

/* ------------------------------------------------------------------ */
/* Footista manager abilities (spec §6 — the 14, pick 3 per match)     */
/* ------------------------------------------------------------------ */

export interface AbilityDef {
  name: string
  effect: string
  /** true when engine2/sim.ts consumes it live (rest are stored on the
   *  timeline + club profile and act as flavor/prestige picks) */
  live: boolean
}

export const ABILITY_CATALOG: AbilityDef[] = [
  { name: 'Counter Boost', effect: '+conversion on counter attacks', live: true },
  { name: 'High Press+', effect: 'Team press is harder to play through', live: false },
  { name: 'Keeper Reflex', effect: 'GK window +0.15 quality floor', live: true },
  { name: 'Wing Play+', effect: 'Wide attacks create more', live: false },
  { name: 'Through Ball+', effect: 'Central lanes slice deeper', live: false },
  { name: 'Set Piece+', effect: 'Dead-ball threat rises', live: false },
  { name: 'Second Wind', effect: 'Second-half stamina drain −20%', live: true },
  { name: 'Talk Master', effect: 'Team talk effect ×1.5', live: true },
  { name: 'Super Sub', effect: 'Subs enter at full stamina', live: true },
  { name: 'Late Bloomer', effect: "75'+ chance frequency +10%", live: true },
  { name: 'Iron Wall', effect: 'DEF +6 when leading', live: true },
  { name: 'Leadership', effect: 'Spirit floor 40', live: true },
  { name: 'Original Eleven', effect: 'Originality bonus ×2', live: false },
  { name: 'Youth Policy', effect: 'YS cards +8%', live: false },
]

/* ------------------------------------------------------------------ */
/* Footista instruction costs (spec §4 — pool 100, regen 6/s)          */
/* ------------------------------------------------------------------ */

export const INSTRUCTION_COST = {
  shoot: 25,
  press: 20,
  skill: 30,
  hotline: 35,
  manmark: 20,
} as const

/* ------------------------------------------------------------------ */
/* Training → hexagon practice levels (spec §5 yellow zone)            */
/* ------------------------------------------------------------------ */

/**
 * Map the club's 6 training attributes (0–5: off/def/pas/pos/spe/pow) onto
 * the hexagon's 6 practice axes 0–100 (OFF/DEF/POS/WIN/SPD/POW).
 */
export function practiceLevelsFromTraining(t: {
  off: number
  def: number
  pas: number
  pos: number
  spe: number
  pow: number
}): number[] {
  return [
    t.off * 20,
    t.def * 20,
    Math.round(((t.pas + t.pos) / 2) * 20),
    t.pos * 20,
    t.spe * 20,
    t.pow * 20,
  ]
}
