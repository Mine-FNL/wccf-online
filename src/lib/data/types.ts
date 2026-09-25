/**
 * WCCF data contracts (design.md §8).
 * Served from GET /data/cards.json — replaced by the full real database later.
 */

/** The six WCCF player parameters (0–20 scale on printed cards). */
export interface PlayerStats {
  off: number
  def: number
  tec: number
  pow: number
  spd: number
  sta: number
}

export type Rarity =
  | 'REG' // Regular — white paper card
  | 'SPE' // Special — black card
  | 'RAR' // Rare — kira (foil) card
  | 'WBE' // World Best Eleven — gold frame
  | 'WGK' // World-class goalkeeper — steel-cyan frame
  | 'MVP' // MVP — crimson/magenta frame
  | 'ATLE' // All-Time Legend — vintage sepia
  | 'YS' // Young Star — teal/green frame

export type Position =
  | 'GK'
  | 'CB'
  | 'LSB'
  | 'RSB'
  | 'DMF'
  | 'CMF'
  | 'OMF'
  | 'SMF'
  | 'FW'
  | 'CF'

/** One printed WCCF card. Matches /data/cards.json entries exactly. */
export interface PlayerCardData {
  id: string
  name: string
  club: string
  /** Cabinet version string, e.g. "2002-03 Serie A" */
  version: string
  /** Printed card number, e.g. "02-03 / 147" (render as `No. {cardNo}`) */
  cardNo: string
  positions: Position[]
  stats: PlayerStats
  /** Player trait, printed in English on the card front */
  trait: string
  rarity: Rarity
  /** Shirt number */
  number: number
}

/** Cabinet version identifiers used across the app ('all' = Legends cabinet). */
export const CABINET_VERSIONS = ['2001-02', '2011-12', '2012-13', '2013-14', '2015-16', '2017-18', 'footista-2019', 'footista-2020', 'footista-2021', 'all'] as const

export type CabinetVersion = (typeof CABINET_VERSIONS)[number]
