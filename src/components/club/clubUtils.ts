/**
 * Shared club-domain helpers for My Club (/club) and the Clubs directory.
 * Lineup/training JSON shapes mirror api/clubRouter.ts zod schemas.
 */
import type { Club, CardOwned } from '@db/schema'
import type { PlayerCardData } from '@/lib/data/types'

export type { Club, CardOwned }

/* ------------------------------------------------------------------ */
/* Lineup                                                              */
/* ------------------------------------------------------------------ */

export interface LineupSlot {
  slot: number
  cardId: string | null
  kp: boolean
}

export const emptyLineup = (): LineupSlot[] =>
  Array.from({ length: 11 }, (_, slot) => ({ slot, cardId: null, kp: false }))

/** Defensive parse of club.lineupJson (drizzle json column → unknown). */
export function parseLineup(json: Club['lineupJson']): LineupSlot[] {
  const base = emptyLineup()
  if (!Array.isArray(json)) return base
  for (const raw of json) {
    if (
      raw &&
      typeof raw === 'object' &&
      typeof (raw as { slot?: unknown }).slot === 'number'
    ) {
      const r = raw as { slot: number; cardId?: unknown; kp?: unknown }
      if (r.slot >= 0 && r.slot <= 10) {
        base[r.slot] = {
          slot: r.slot,
          cardId: typeof r.cardId === 'string' ? r.cardId : null,
          kp: r.kp === true,
        }
      }
    }
  }
  return base
}

/* ------------------------------------------------------------------ */
/* Training                                                            */
/* ------------------------------------------------------------------ */

export interface TrainingLevels {
  off: number
  def: number
  pas: number
  pos: number
  spe: number
  pow: number
}

export const TRAINING_KEYS = ['off', 'def', 'pas', 'pos', 'spe', 'pow'] as const
export type TrainingKey = (typeof TRAINING_KEYS)[number]

export const TRAINING_AREAS: { key: TrainingKey; label: string }[] = [
  { key: 'off', label: 'Offence' },
  { key: 'def', label: 'Defence' },
  { key: 'pas', label: 'Passing' },
  { key: 'pos', label: 'Possession' },
  { key: 'spe', label: 'Speed' },
  { key: 'pow', label: 'Power' },
]

export const zeroTraining = (): TrainingLevels => ({
  off: 0,
  def: 0,
  pas: 0,
  pos: 0,
  spe: 0,
  pow: 0,
})

/** Defensive parse of club.trainingJson, clamped to 0..5 integers. */
export function parseTraining(json: Club['trainingJson']): TrainingLevels {
  const out = zeroTraining()
  if (json && typeof json === 'object') {
    const r = json as Record<string, unknown>
    for (const k of TRAINING_KEYS) {
      const v = r[k]
      if (typeof v === 'number' && Number.isFinite(v)) {
        out[k] = Math.max(0, Math.min(5, Math.round(v)))
      }
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Positions                                                           */
/* ------------------------------------------------------------------ */

export type PositionGroup = 'GK' | 'DF' | 'MF' | 'FW'
export const POSITION_GROUPS: PositionGroup[] = ['GK', 'DF', 'MF', 'FW']

/**
 * Broad position vocabulary → group. The live cards.json sample uses
 * GK/CB/LSB/RSB/DMF/CMF/OMF/SMF/FW/CF; the full 1,856-card drop adds
 * DF/SB/WB/MF/WF/ST etc. Unknown positions fall back to MF.
 */
const GROUP_VOCAB: Record<PositionGroup, string[]> = {
  GK: ['GK'],
  DF: ['DF', 'CB', 'SB', 'LSB', 'RSB', 'WB', 'LWB', 'RWB', 'SW', 'LIB'],
  MF: ['MF', 'DMF', 'CMF', 'SMF', 'OMF', 'AMF', 'LMF', 'RMF', 'WB', 'LWB', 'RWB', 'WM'],
  FW: ['FW', 'CF', 'ST', 'WF', 'LWF', 'RWF', 'SS'],
}

export function positionGroup(pos: string): PositionGroup {
  for (const g of POSITION_GROUPS) {
    if (GROUP_VOCAB[g].includes(pos)) return g
  }
  return 'MF'
}

/** Card is eligible for a slot group if any of its positions maps into it. */
export function cardFitsGroup(card: PlayerCardData, group: PositionGroup): boolean {
  return card.positions.some((p) => positionGroup(p) === group)
}

export function cardPrimaryGroup(card: PlayerCardData): PositionGroup {
  return card.positions.length > 0 ? positionGroup(card.positions[0]) : 'MF'
}

/* ------------------------------------------------------------------ */
/* Formations                                                          */
/* ------------------------------------------------------------------ */

export const FORMATION_PRESETS = ['4-4-2', '4-3-3', '4-5-1', '3-5-2', '5-3-2', '3-4-3'] as const

export interface PitchSlot {
  slot: number
  group: PositionGroup
  /** percent coords on the vertical pitch (0 top = opponent goal) */
  x: number
  y: number
}

/** Line y-coords (defense → attack) by number of outfield lines. */
const LINE_Y: Record<number, number[]> = {
  3: [66, 44, 22],
  4: [70, 54, 37, 19],
}

/**
 * Layout of the 11 slots for a formation string ("4-4-2").
 * Slot 0 = GK; slots 1..n fill lines defense-first, left → right.
 */
export function formationLayout(formation: string): PitchSlot[] {
  const lines = formation
    .split('-')
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5)
  const valid = lines.length >= 3 && lines.length <= 4 && lines.reduce((a, n) => a + n, 0) === 10
  const use = valid ? lines : [4, 4, 2]
  const ys = LINE_Y[use.length] ?? LINE_Y[3]

  const slots: PitchSlot[] = [{ slot: 0, group: 'GK', x: 50, y: 90 }]
  let slot = 1
  use.forEach((count, lineIdx) => {
    const group: PositionGroup =
      lineIdx === 0 ? 'DF' : lineIdx === use.length - 1 ? 'FW' : 'MF'
    for (let i = 0; i < count; i++) {
      /* spread across 14%..86%, centered */
      const x = count === 1 ? 50 : 14 + (72 * i) / (count - 1)
      slots.push({ slot: slot++, group, x, y: ys[lineIdx] })
    }
  })
  return slots
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

/** Crest asset for a numeric id (club id / user id). */
export function crestFor(id: number | string): string {
  const n = typeof id === 'string' ? hashString(id) : Number(id)
  return `/avatar-${(Math.abs(n) % 8) + 1}.png`
}

/** Small deterministic string hash (synthetic ambience data). */
export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/** Seeded PRNG (mulberry32) for deterministic synthetic stats. */
export function seededRand(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------------------------------------------ */
/* Collection grouping                                                 */
/* ------------------------------------------------------------------ */

export interface OwnedEntry {
  cardId: string
  count: number
  /** source of the earliest copy */
  source: string
  /** earliest copy acquisition time */
  acquiredAt: Date
}

/** Collapse cardsOwned rows (one per copy) into per-card entries. */
export function groupCollection(collection: CardOwned[]): OwnedEntry[] {
  const map = new Map<string, OwnedEntry>()
  for (const row of collection) {
    const at = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)
    const cur = map.get(row.cardId)
    if (!cur) {
      map.set(row.cardId, { cardId: row.cardId, count: 1, source: row.source, acquiredAt: at })
    } else {
      cur.count += 1
      if (at < cur.acquiredAt) {
        cur.acquiredAt = at
        cur.source = row.source
      }
    }
  }
  return [...map.values()]
}

export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
