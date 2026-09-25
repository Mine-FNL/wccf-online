/**
 * WCCF flat-panel arrangement logic (v2) — pure, no React.
 *
 * The physical card panel of the original arcade: card position IS the
 * formation. Eleven pitch slots per formation preset + a 5-card bench,
 * per-line forward/back nudges, and the team-grid hexagon recipe
 * (gameplay-fidelity-spec §1, §3.1, §5).
 */
import type { PlayerCardData, Position } from './data/types'
import { cardTotal } from './data/cards'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Position band of a panel slot. */
export type Band = 'GK' | 'DF' | 'MF' | 'FW'

/** Slot ids follow the pattern: gk, df1..df5, mf1..mf5, fw1..fw3. */
export type SlotId = string

export interface SlotDef {
  id: SlotId
  band: Band
  /** Depth on the pitch: 0 = own goal, 1 = opponent goal. */
  x: number
  /** Width on the pitch: 0 = left touchline, 1 = right touchline. */
  y: number
}

export type Nudge = -1 | 0 | 1

export interface Nudges {
  df: Nudge
  mf: Nudge
  fw: Nudge
}

export interface Arrangement {
  formation: string
  slots: Record<SlotId, string /* cardId */ | null>
  bench: (string | null)[] // 5
  nudges: Nudges
}

export type CardsById = (id: string) => PlayerCardData | undefined

/* ------------------------------------------------------------------ */
/* Position bands (data Position → band, with original-game leniency)  */
/* ------------------------------------------------------------------ */

export const POSITION_BAND: Record<Position, Band> = {
  GK: 'GK',
  CB: 'DF',
  LSB: 'DF',
  RSB: 'DF',
  DMF: 'MF',
  CMF: 'MF',
  OMF: 'MF',
  SMF: 'MF',
  CF: 'FW',
  FW: 'FW',
}

/**
 * Original-game registration leniency (spec §3.1): wingers (SMF) may
 * also fill FW-band slots; OMF may fill MF/FW; DMF may fill DF/MF.
 */
export function canFill(cardPositions: Position[], band: Band): boolean {
  for (const p of cardPositions) {
    if (POSITION_BAND[p] === band) return true
    if (band === 'FW' && (p === 'SMF' || p === 'OMF')) return true
    if (band === 'DF' && p === 'DMF') return true
  }
  return false
}

/** Strict band match (no leniency) — used to prefer natural fits. */
export function exactBand(cardPositions: Position[], band: Band): boolean {
  return cardPositions.some((p) => POSITION_BAND[p] === band)
}

/* ------------------------------------------------------------------ */
/* Formation presets                                                   */
/* ------------------------------------------------------------------ */

/** Evenly spread width coordinates around the centre. */
function spreadY(n: number, step: number): number[] {
  const start = 0.5 - ((n - 1) / 2) * step
  return Array.from({ length: n }, (_, i) => Math.round((start + i * step) * 100) / 100)
}

function lineSlots(prefix: string, band: Band, x: number, ys: number[]): SlotDef[] {
  return ys.map((y, i) => ({ id: `${prefix}${i + 1}`, band, x, y }))
}

const GK_SLOT: SlotDef = { id: 'gk', band: 'GK', x: 0.07, y: 0.5 }

const FORMATION_SLOTS: Record<string, SlotDef[]> = {
  '4-4-2': [
    GK_SLOT,
    ...lineSlots('df', 'DF', 0.26, spreadY(4, 0.2)),
    ...lineSlots('mf', 'MF', 0.5, spreadY(4, 0.2)),
    ...lineSlots('fw', 'FW', 0.78, spreadY(2, 0.26)),
  ],
  '4-3-3': [
    GK_SLOT,
    ...lineSlots('df', 'DF', 0.26, spreadY(4, 0.2)),
    ...lineSlots('mf', 'MF', 0.5, spreadY(3, 0.26)),
    ...lineSlots('fw', 'FW', 0.78, spreadY(3, 0.26)),
  ],
  '4-2-3-1': [
    GK_SLOT,
    ...lineSlots('df', 'DF', 0.24, spreadY(4, 0.2)),
    ...lineSlots('mf', 'MF', 0.42, spreadY(2, 0.18)),
    ...lineSlots('mf', 'MF', 0.6, spreadY(3, 0.26)).map((s) => ({ ...s, id: `mf${Number(s.id.slice(2)) + 2}` })),
    { id: 'fw1', band: 'FW', x: 0.82, y: 0.5 },
  ],
  '3-5-2': [
    GK_SLOT,
    ...lineSlots('df', 'DF', 0.26, spreadY(3, 0.26)),
    ...lineSlots('mf', 'MF', 0.5, spreadY(5, 0.16)),
    ...lineSlots('fw', 'FW', 0.78, spreadY(2, 0.26)),
  ],
  '3-4-3': [
    GK_SLOT,
    ...lineSlots('df', 'DF', 0.26, spreadY(3, 0.26)),
    ...lineSlots('mf', 'MF', 0.5, spreadY(4, 0.2)),
    ...lineSlots('fw', 'FW', 0.78, spreadY(3, 0.26)),
  ],
  '4-5-1': [
    GK_SLOT,
    ...lineSlots('df', 'DF', 0.26, spreadY(4, 0.2)),
    ...lineSlots('mf', 'MF', 0.5, spreadY(5, 0.16)),
    { id: 'fw1', band: 'FW', x: 0.8, y: 0.5 },
  ],
}

export const FORMATION_NAMES = Object.keys(FORMATION_SLOTS)

/** Slot layout for a formation (falls back to 4-4-2 for unknown strings). */
export function formationSlots(formation: string): SlotDef[] {
  return FORMATION_SLOTS[formation] ?? FORMATION_SLOTS['4-4-2']
}

/** Slot ids in stable order (gk first) — index = legacy lineup slot number. */
export function slotOrder(formation: string): SlotId[] {
  return formationSlots(formation).map((s) => s.id)
}

export function emptyArrangement(formation = '4-4-2'): Arrangement {
  const slots: Record<SlotId, string | null> = {}
  for (const s of formationSlots(formation)) slots[s.id] = null
  return { formation, slots, bench: [null, null, null, null, null], nudges: { df: 0, mf: 0, fw: 0 } }
}

/* ------------------------------------------------------------------ */
/* Registration (card check — spec §3.1)                               */
/* ------------------------------------------------------------------ */

export interface RegistrationResult {
  ok: boolean
  errors: string[]
}

export function validateRegistration(a: Arrangement, cardsById: CardsById): RegistrationResult {
  const errors: string[] = []
  const defs = formationSlots(a.formation)

  /* all 11 slots filled */
  const filled = defs.filter((d) => a.slots[d.id]).length
  if (filled < defs.length) {
    errors.push(`XI INCOMPLETE — ${filled}/11 CARDS ON PANEL`)
  }

  /* duplicate detection across slots + bench */
  const seen = new Map<string, number>()
  for (const id of [...defs.map((d) => a.slots[d.id]), ...a.bench]) {
    if (id) seen.set(id, (seen.get(id) ?? 0) + 1)
  }
  for (const [id, n] of seen) {
    if (n > 1) {
      const name = cardsById(id)?.name ?? id
      errors.push(`DUPLICATE CARD — ${name.toUpperCase()} ×${n}`)
    }
  }

  /* GK rule: exactly 1 GK in the XI, in the GK slot, with GK in positions */
  const gkSlotCard = a.slots.gk ? cardsById(a.slots.gk as string) : undefined
  if (a.slots.gk && gkSlotCard && !gkSlotCard.positions.includes('GK')) {
    errors.push(`GK SLOT — ${gkSlotCard.name.toUpperCase()} IS NOT A GOALKEEPER`)
  }
  const gkInXi = defs.filter((d) => {
    const id = a.slots[d.id]
    const c = id ? cardsById(id) : undefined
    return c?.positions.includes('GK')
  })
  if (filled === defs.length) {
    if (gkInXi.length === 0) errors.push('GK MISSING — PLACE A GOALKEEPER CARD')
    if (gkInXi.length > 1) errors.push(`TOO MANY GOALKEEPERS — ${gkInXi.length} GK CARDS IN XI`)
  }

  /* every slot's card must cover its band */
  for (const d of defs) {
    const id = a.slots[d.id]
    if (!id) continue
    const c = cardsById(id)
    if (!c) {
      errors.push(`${d.id.toUpperCase()} — UNKNOWN CARD ${id}`)
      continue
    }
    if (!canFill(c.positions, d.band)) {
      errors.push(`${d.id.toUpperCase()} — ${c.name.toUpperCase()} CANNOT PLAY ${d.band}`)
    }
  }

  /* bench ≤ 5 (any position allowed) */
  if (a.bench.length > 5) errors.push(`BENCH OVER LIMIT — ${a.bench.length}/5`)
  for (const id of a.bench) {
    if (id && !cardsById(id)) errors.push(`SUBS — UNKNOWN CARD ${id}`)
  }

  return { ok: errors.length === 0, errors }
}

/* ------------------------------------------------------------------ */
/* Auto-arrange (greedy best-fit)                                      */
/* ------------------------------------------------------------------ */

export function autoArrange(cardIds: string[], cardsById: CardsById, formation: string): Arrangement {
  const defs = formationSlots(formation)
  const pool = cardIds
    .map(cardsById)
    .filter((c): c is PlayerCardData => !!c)
    .sort((a, b) => cardTotal(b) - cardTotal(a))
  const used = new Set<string>()
  const take = (pred: (c: PlayerCardData) => boolean): PlayerCardData | undefined => {
    const c = pool.find((p) => !used.has(p.id) && pred(p))
    if (c) used.add(c.id)
    return c
  }

  const out = emptyArrangement(formation)
  /* GK first */
  const gk = take((c) => c.positions.includes('GK'))
  if (gk) out.slots.gk = gk.id
  /* then bands by total rating, preferring exact-band matches */
  for (const d of defs) {
    if (d.id === 'gk') continue
    const card = take((c) => exactBand(c.positions, d.band)) ?? take((c) => canFill(c.positions, d.band))
    if (card) out.slots[d.id] = card.id
  }
  /* bench: best remaining five */
  const rest = pool.filter((c) => !used.has(c.id)).slice(0, 5)
  out.bench = [...rest.map((c) => c.id), null, null, null, null, null].slice(0, 5)
  return out
}

/* ------------------------------------------------------------------ */
/* Formation switching — re-map existing placements where possible     */
/* ------------------------------------------------------------------ */

export function remapFormation(a: Arrangement, formation: string, cardsById: CardsById): Arrangement {
  const defs = formationSlots(formation)
  const pool = formationSlots(a.formation)
    .map((d) => a.slots[d.id])
    .filter((id): id is string => !!id)
  const used = new Set<string>()
  const next = emptyArrangement(formation)
  next.bench = [...a.bench]
  next.nudges = { ...a.nudges }
  /* pass 1: exact-band matches; pass 2: lenient fits */
  for (const pred of [
    (c: PlayerCardData, b: Band) => exactBand(c.positions, b),
    (c: PlayerCardData, b: Band) => canFill(c.positions, b),
  ]) {
    for (const d of defs) {
      if (next.slots[d.id]) continue
      const id = pool.find((pid) => {
        if (used.has(pid)) return false
        const c = cardsById(pid)
        return !!c && pred(c, d.band)
      })
      if (id) {
        used.add(id)
        next.slots[d.id] = id
      }
    }
  }
  return next
}

/* ------------------------------------------------------------------ */
/* Line nudges (card forward/back gesture — spec §5)                   */
/* ------------------------------------------------------------------ */

/** ±4 per nudge step: pushing a line forward raises OFF, lowers DEF. */
export function lineNudgeEffect(nudges: Nudges): { off: number; def: number } {
  const total = nudges.df + nudges.mf + nudges.fw
  return { off: 4 * total, def: -4 * total }
}

/* ------------------------------------------------------------------ */
/* Team-grid hexagon (spec §5) — axes OFF/DEF/POS/WIN/SPD/POW          */
/* ------------------------------------------------------------------ */

export interface XIEntry {
  card: PlayerCardData
  band: Band
}

const clamp100 = (v: number) => Math.max(0, Math.min(100, Math.round(v)))

function weightedAvg(entries: { v: number; w: number }[]): number {
  const wSum = entries.reduce((a, e) => a + e.w, 0)
  if (wSum === 0) return 0
  return entries.reduce((a, e) => a + e.v * e.w, 0) / wSum
}

/**
 * Formation zone of the hexagon from the XI as arranged.
 * Stats are 0–20 on printed cards; ×5 → 0–100 team axes.
 */
export function computeFormationHex(xi: XIEntry[], nudges: Nudges): number[] {
  const byBand = (bands: Band[]) => xi.filter((e) => bands.includes(e.band))
  const nudge = lineNudgeEffect(nudges)

  const off = weightedAvg([
    ...byBand(['FW']).map((e) => ({ v: e.card.stats.off, w: 1.2 })),
    ...byBand(['MF']).map((e) => ({ v: e.card.stats.off, w: 0.9 })),
  ])
  const def = weightedAvg([
    ...byBand(['GK', 'DF']).map((e) => ({ v: e.card.stats.def, w: 1.2 })),
    ...byBand(['MF']).map((e) => ({ v: e.card.stats.def, w: 0.8 })),
  ])
  const pos = weightedAvg([
    ...byBand(['MF']).map((e) => ({ v: e.card.stats.tec, w: 1.2 })),
    ...byBand(['DF', 'FW']).map((e) => ({ v: e.card.stats.tec, w: 0.9 })),
  ])
  const winEntries = byBand(['DF', 'MF'])
  const win = winEntries.length
    ? winEntries.reduce((a, e) => a + (e.card.stats.pow + e.card.stats.sta) / 2, 0) / winEntries.length
    : 0
  const spd = xi.length ? xi.reduce((a, e) => a + e.card.stats.spd, 0) / xi.length : 0
  const pow = xi.length ? xi.reduce((a, e) => a + e.card.stats.pow, 0) / xi.length : 0

  return [
    clamp100(off * 5 + nudge.off),
    clamp100(def * 5 + nudge.def),
    clamp100(pos * 5),
    clamp100(win * 5),
    clamp100(spd * 5),
    clamp100(pow * 5),
  ]
}

/** Build the XI entries (card + band) for an arrangement, skipping gaps. */
export function xiEntries(a: Arrangement, cardsById: CardsById): XIEntry[] {
  const out: XIEntry[] = []
  for (const d of formationSlots(a.formation)) {
    const id = a.slots[d.id]
    const c = id ? cardsById(id) : undefined
    if (c) out.push({ card: c, band: d.band })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Serialization (localStorage + club.lineupJson interop)              */
/* ------------------------------------------------------------------ */

const isNudge = (v: unknown): v is Nudge => v === -1 || v === 0 || v === 1

/** Defensive parse of a serialized Arrangement. */
export function parseArrangement(json: unknown): Arrangement | null {
  if (!json || typeof json !== 'object') return null
  const r = json as Record<string, unknown>
  if (typeof r.formation !== 'string' || !FORMATION_NAMES.includes(r.formation)) return null
  if (!r.slots || typeof r.slots !== 'object') return null
  const base = emptyArrangement(r.formation)
  const rawSlots = r.slots as Record<string, unknown>
  for (const d of formationSlots(r.formation)) {
    const v = rawSlots[d.id]
    base.slots[d.id] = typeof v === 'string' ? v : null
  }
  if (Array.isArray(r.bench)) {
    base.bench = r.bench.slice(0, 5).map((v) => (typeof v === 'string' ? v : null))
    while (base.bench.length < 5) base.bench.push(null)
  }
  if (r.nudges && typeof r.nudges === 'object') {
    const n = r.nudges as Record<string, unknown>
    base.nudges = {
      df: isNudge(n.df) ? n.df : 0,
      mf: isNudge(n.mf) ? n.mf : 0,
      fw: isNudge(n.fw) ? n.fw : 0,
    }
  }
  return base
}

/** Legacy 11-slot lineup shape stored on the club row (club.update). */
export function toLineupSlots(a: Arrangement): { slot: number; cardId: string | null; kp: boolean }[] {
  return slotOrder(a.formation).map((id, i) => ({ slot: i, cardId: a.slots[id] ?? null, kp: false }))
}

/**
 * Derive an arrangement from the club row's formation + legacy lineup
 * (slot index → slot id of that formation). Extra state starts empty.
 */
export function fromLineupSlots(
  formation: string,
  lineup: { slot: number; cardId: string | null }[],
): Arrangement {
  const useFormation = FORMATION_NAMES.includes(formation) ? formation : '4-4-2'
  const out = emptyArrangement(useFormation)
  const order = slotOrder(useFormation)
  for (const l of lineup) {
    if (l.slot >= 0 && l.slot < order.length) out.slots[order[l.slot]] = l.cardId
  }
  return out
}

/** Drop card ids that are no longer owned/known. */
export function pruneUnknown(a: Arrangement, known: (id: string) => boolean): Arrangement {
  const slots: Record<SlotId, string | null> = {}
  for (const [k, v] of Object.entries(a.slots)) slots[k] = v && known(v) ? v : null
  return { ...a, slots, bench: a.bench.map((v) => (v && known(v) ? v : null)) }
}
