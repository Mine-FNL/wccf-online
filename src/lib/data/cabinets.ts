/**
 * Cabinet registry (design.md §8, home.md §3).
 * Each lobby cabinet runs one live simulated match on a shared wall-clock
 * epoch (see engine `cabinetNow`), filled with AI clubs until seats are taken.
 */
import type { TeamInput } from '../engine/types'
import { mulberry32, teamFromCards, type EnginePlayer } from '../engine'
import type { PlayerCardData, Position } from './types'
import { filterCards } from './cards'
import { aiClubAt } from './aiClubs'

export interface Cabinet {
  id: string
  /** display name, e.g. "WCCF 2002-03 — SERIE A" */
  name: string
  /** version badge, e.g. `'02-'03` */
  badge: string
  /** tooltip flavor line on the version badge */
  flavor: string
  /** card pool version string in cards.json */
  version: string
  /** marquee thumbnail */
  image: string
}

/**
 * The eight live cabinets, in timeline order. The card database covers
 * versions 2001-02, 2011-12, 2012-13, 2013-14, 2015-16, 2017-18 and
 * footista-2021; the Legends cabinet draws from ATLE/RAR/WBE/MVP/
 * WGK cards across ALL versions (version: 'all').
 */
export const CABINETS: Cabinet[] = [
  {
    id: 'sa-0102',
    name: 'SERIE A 2001-2002',
    badge: `'01-'02`,
    flavor: 'The NAOMI2 debut: 18 Italian clubs, 309 cards.',
    version: '2001-02',
    image: '/cab-seriea.png',
  },
  {
    id: 'ic-1112',
    name: 'WCCF 2011-12',
    badge: 'INTERCONTINENTAL CLUBS',
    flavor: 'Clubs from every continent.',
    version: '2011-12',
    image: '/cab-intercontinental.png',
  },
  {
    id: 'wccf-1213',
    name: 'WCCF 2012-13',
    badge: 'WORLD CLUBS',
    flavor: "The world's elite enter the cabinet.",
    version: '2012-13',
    image: '/cab-worldclubs.png',
  },
  {
    id: 'wc-1314',
    name: 'WCCF 2013-14',
    badge: 'WORLD CLUBS Ver.3.0',
    flavor: '17 clubs + 6 national teams.',
    version: '2013-14',
    image: '/cab-euro.png',
  },
  {
    id: 'wccf-1516',
    name: 'WCCF 2015-16',
    badge: 'WORLD CLUBS',
    flavor: 'A new cycle of world clubs begins.',
    version: '2015-16',
    image: '/cab-worldclubs.png',
  },
  {
    id: 'wccf-1718',
    name: 'WCCF 2017-18',
    badge: 'WORLD CLUBS',
    flavor: 'The late-era squads take the stage.',
    version: '2017-18',
    image: '/cab-euro.png',
  },
  {
    id: 'footista-2021',
    name: 'FOOTISTA 2021',
    badge: 'FT21',
    flavor: 'The final evolution: manager abilities, MMP ranking.',
    version: 'footista-2021',
    image: '/cab-intercontinental.png',
  },
  {
    id: 'legends-atle',
    name: 'WCCF LEGENDS',
    badge: 'ATLE',
    flavor: 'All-Time Legends only. Kira heaven.',
    version: 'all',
    image: '/cab-legends.png',
  },
]

export function cabinetById(id: string): Cabinet {
  return CABINETS.find((c) => c.id === id) ?? CABINETS[0]
}

/* ------------------------------------------------------------------ */
/* Cabinet era (gameplay-fidelity-spec §1 — the console changes by era) */
/* ------------------------------------------------------------------ */

export type CabinetEra = 'classic' | 'kp' | 'footista'

/**
 * Map a cabinet's card-pool version string onto the arcade era:
 * - 2019+ / "footista"                  → footista (stadium cabinet, A–E buttons)
 * - 2006-07 … 2013-14                   → kp (KEY PLAYER button + Team Styles)
 * - older (2001-02 … 2005-06)           → classic (5 tactics + SHOOT + GK)
 * - unknown / 'all' (Legends)           → kp (default)
 */
export function cabinetEra(cabinet: Cabinet): CabinetEra {
  const v = (cabinet.version ?? '').toLowerCase()
  if (!v || v === 'all') return 'kp'
  if (v.includes('footista')) return 'footista'
  const year = Number(v.match(/\d{4}/)?.[0])
  if (Number.isFinite(year)) {
    if (year >= 2019) return 'footista'
    if (year >= 2006) return 'kp'
    return 'classic'
  }
  return 'kp'
}

/* ------------------------------------------------------------------ */
/* Demo match teams built from the card database                       */
/* ------------------------------------------------------------------ */

const XI_SHAPE: Position[] = ['GK', 'CB', 'CB', 'LSB', 'RSB', 'DMF', 'CMF', 'CMF', 'OMF', 'FW', 'CF']

const score = (c: PlayerCardData) =>
  c.stats.off + c.stats.def + c.stats.tec + c.stats.pow + c.stats.spd + c.stats.sta

/** Pick an XI from a pool following XI_SHAPE, preferring high totals. */
function pickXI(pool: PlayerCardData[], rand: () => number): PlayerCardData[] {
  const used = new Set<string>()
  const xi: PlayerCardData[] = []
  for (const pos of XI_SHAPE) {
    const cands = pool
      .filter((c) => !used.has(c.id) && c.positions.includes(pos))
      .sort((a, b) => score(b) - score(a))
    const pickFrom = cands.length > 1 && rand() < 0.4 ? cands.slice(0, 2) : cands.slice(0, 1)
    const chosen = pickFrom[Math.floor(rand() * pickFrom.length)] ??
      pool.filter((c) => !used.has(c.id)).sort((a, b) => score(b) - score(a))[0]
    if (chosen) {
      used.add(chosen.id)
      xi.push(chosen)
    }
  }
  return xi
}

/**
 * Deterministic demo teams for a cabinet match: team names come from two
 * seated AI clubs, XIs are drawn from the cabinet version's card pool.
 * Memoize per (cabinet.id, seed) at the call site.
 */
/** Rarities the Legends cabinet draws from (across ALL versions). */
const LEGENDS_RARITIES = ['ATLE', 'RAR', 'WBE', 'MVP', 'WGK'] as const

export function buildCabinetTeams(
  cabinet: Cabinet,
  seed: number,
  seatA: string,
  seatB: string,
): { home: TeamInput; away: TeamInput } {
  const rand = mulberry32(seed ^ 0x9e3779b9)
  let pool =
    cabinet.version === 'all'
      ? filterCards({ rarity: [...LEGENDS_RARITIES] })
      : filterCards({ version: cabinet.version })
  if (pool.length < 22) {
    /* top up thin pools (sample card db) — kira rarities first, then anything */
    const topUp = [
      ...filterCards({ rarity: [...LEGENDS_RARITIES] }),
      ...filterCards({}),
    ]
    for (const c of topUp) {
      if (pool.length >= 22) break
      if (!pool.includes(c)) pool.push(c)
    }
  }
  const shuffled = [...pool].sort(() => rand() - 0.5)
  const half = Math.ceil(shuffled.length / 2)
  const homeCards = pickXI(shuffled.slice(0, half), rand)
  const awayCards = pickXI(shuffled.slice(half), rand)
  return {
    home: teamFromCards(seatA, seatA.replace(/[^A-Z]/gi, '').slice(0, 3).toUpperCase() || 'HME', '#3DD68C', homeCards),
    away: teamFromCards(seatB, seatB.replace(/[^A-Z]/gi, '').slice(0, 3).toUpperCase() || 'AWY', '#FF8A1E', awayCards),
  }
}

/** A bench-ready helper: quick XI of engine players from a version pool. */
export function poolXI(version: string, seed: number): EnginePlayer[] {
  const rand = mulberry32(seed)
  return pickXI(filterCards({ version }), rand).map((c) => ({
    name: c.name,
    number: c.number,
    position: c.positions[0],
    stats: c.stats,
  }))
}

/* ------------------------------------------------------------------ */
/* Seat occupancy (deterministic per cabinet + epoch)                  */
/* ------------------------------------------------------------------ */

export interface SeatInfo {
  seat: number
  occupant: string | null
  playing: boolean
  avatar: string
}

/**
 * 8 seats per cabinet. Occupancy is seeded so the lobby looks consistently
 * occupied for everyone; seats 1–2 hold the clubs contesting the live match.
 */
export function cabinetSeats(cabinetId: string, epoch: number): SeatInfo[] {
  const rand = mulberry32((epoch * 2654435761) ^ cabinetId.length * 97)
  const base = cabinetId.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0)
  const a = aiClubAt(base + epoch)
  const b = aiClubAt(base + epoch + 7)
  const seats: SeatInfo[] = [
    { seat: 1, occupant: a.club, playing: true, avatar: a.avatar },
    { seat: 2, occupant: b.club, playing: true, avatar: b.avatar },
  ]
  for (let s = 3; s <= 8; s++) {
    if (rand() < 0.45) {
      const c = aiClubAt(base + epoch + s * 3)
      seats.push({ seat: s, occupant: c.club, playing: false, avatar: c.avatar })
    } else {
      seats.push({ seat: s, occupant: null, playing: false, avatar: '/avatar-1.png' })
    }
  }
  return seats
}
