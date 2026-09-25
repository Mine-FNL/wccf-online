/**
 * Card database access layer.
 * Fetches /data/cards.json once, caches at module level, exposes helpers.
 */
import type { PlayerCardData, Rarity } from './types'

let cache: PlayerCardData[] | null = null
let inflight: Promise<PlayerCardData[]> | null = null

/** Load the full card list (module-level cached). */
export async function loadCards(): Promise<PlayerCardData[]> {
  if (cache) return cache
  if (inflight) return inflight
  inflight = fetch('/data/cards.json')
    .then((res) => {
      if (!res.ok) throw new Error(`cards.json ${res.status}`)
      return res.json() as Promise<PlayerCardData[]>
    })
    .then((cards) => {
      cache = cards
      return cards
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Synchronous accessors — call after loadCards() resolved. */
export function allCards(): PlayerCardData[] {
  return cache ?? []
}

export function byId(id: string): PlayerCardData | undefined {
  return cache?.find((c) => c.id === id)
}

export interface CardFilter {
  version?: string
  rarity?: Rarity | Rarity[]
  position?: string
  query?: string
}

export function filterCards(f: CardFilter): PlayerCardData[] {
  const list = cache ?? []
  return list.filter((c) => {
    if (f.version && c.version !== f.version) return false
    if (f.rarity) {
      const rs = Array.isArray(f.rarity) ? f.rarity : [f.rarity]
      if (!rs.includes(c.rarity)) return false
    }
    if (f.position && !c.positions.includes(f.position as never)) return false
    if (f.query) {
      const q = f.query.toLowerCase()
      if (
        !c.name.toLowerCase().includes(q) &&
        !c.club.toLowerCase().includes(q)
      )
        return false
    }
    return true
  })
}

/**
 * Deterministic-ish random pick by rarity. Pass a `rand` function (e.g. from
 * the engine's seeded RNG) for reproducible draws; defaults to Math.random.
 */
export function randomByRarity(
  rarity: Rarity,
  rand: () => number = Math.random,
): PlayerCardData | undefined {
  const pool = filterCards({ rarity })
  if (pool.length === 0) return undefined
  return pool[Math.floor(rand() * pool.length)]
}

/** Sum of the six parameters — the card's printed TOTAL. */
export function cardTotal(c: PlayerCardData): number {
  const s = c.stats
  return s.off + s.def + s.tec + s.pow + s.spd + s.sta
}

/** Rarity display metadata shared by PlayerCard, Scouting, etc. */
export const RARITY_META: Record<
  Rarity,
  { label: string; frame: string; foil: boolean }
> = {
  REG: { label: 'Regular', frame: '#F2EFE7', foil: false },
  SPE: { label: 'Special', frame: '#101114', foil: false },
  RAR: { label: 'Rare — Kira', frame: '#7A5CFF', foil: true },
  WBE: { label: 'World Best Eleven', frame: '#E8B84B', foil: true },
  WGK: { label: 'World-Class GK', frame: '#4DD0E1', foil: true },
  MVP: { label: 'MVP', frame: '#FF3D71', foil: true },
  ATLE: { label: 'All-Time Legend', frame: '#C9A86A', foil: false },
  YS: { label: 'Young Star', frame: '#3DD68C', foil: true },
}
