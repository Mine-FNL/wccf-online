/**
 * Scout tier odds — mirrors the server tables in api/queries/scout.ts EXACTLY.
 * If the server tables change, update these to match.
 */
import type { Rarity } from '@/lib/data/types'

export type ScoutTier = 'pro' | 'elite'

export const SCOUT_COST: Record<ScoutTier, number> = { pro: 300, elite: 900 }
export const SCOUT_PACK_SIZE = 5

export interface OddsRow {
  rarity: Rarity
  /** probability 0..1 */
  p: number
}

export interface SlotTable {
  /** e.g. "Base slots (4×)" */
  label: string
  note: string
  rows: OddsRow[]
}

/** Rarity display colors (design.md §2). */
export const RARITY_COLOR: Record<Rarity, string> = {
  REG: '#F2EFE7',
  SPE: '#C8CDD6',
  RAR: '#7A5CFF',
  WBE: '#E8B84B',
  WGK: '#4DD0E1',
  MVP: '#FF3D71',
  ATLE: '#C9A86A',
  YS: '#3DD68C',
}

export const RARITY_SHORT: Record<Rarity, string> = {
  REG: 'Regular',
  SPE: 'Special',
  RAR: 'Rare (kira)',
  WBE: 'World Best XI',
  WGK: 'World GK',
  MVP: 'MVP',
  ATLE: 'All-Time Legend',
  YS: 'Young Star',
}

/* Server tables (api/queries/scout.ts):
 *  - pro:    4× (REG .70 / SPE .30),
 *            1× (SPE .55 / RAR .30 / YS .08 / WBE+WGK+MVP .05 / ATLE .02)
 *  - elite:  4× (SPE .50 / RAR .35 / YS .10 / WBE+MVP+WGK .04 / ATLE .01),
 *            1× guaranteed ≥RAR (RAR .55 / YS .15 / WBE .08 / WGK .07 / MVP .08 / ATLE .07)
 */
export const TIER_ODDS: Record<ScoutTier, SlotTable[]> = {
  pro: [
    {
      label: 'Base slots ×4',
      note: 'The backbone of the pack — mostly regulars.',
      rows: [
        { rarity: 'REG', p: 0.7 },
        { rarity: 'SPE', p: 0.3 },
      ],
    },
    {
      label: 'Feature slot ×1',
      note: 'One card per pack drawn from the feature pool.',
      rows: [
        { rarity: 'SPE', p: 0.55 },
        { rarity: 'RAR', p: 0.3 },
        { rarity: 'YS', p: 0.08 },
        { rarity: 'WBE', p: 0.05 / 3 },
        { rarity: 'WGK', p: 0.05 / 3 },
        { rarity: 'MVP', p: 0.05 / 3 },
        { rarity: 'ATLE', p: 0.02 },
      ],
    },
  ],
  elite: [
    {
      label: 'Base slots ×4',
      note: 'No regulars — Special floor with heavy kira weighting.',
      rows: [
        { rarity: 'SPE', p: 0.5 },
        { rarity: 'RAR', p: 0.35 },
        { rarity: 'YS', p: 0.1 },
        { rarity: 'WBE', p: 0.04 / 3 },
        { rarity: 'MVP', p: 0.04 / 3 },
        { rarity: 'WGK', p: 0.04 / 3 },
        { rarity: 'ATLE', p: 0.01 },
      ],
    },
    {
      label: 'Guaranteed slot ×1',
      note: 'Guaranteed Rare (kira) or better.',
      rows: [
        { rarity: 'RAR', p: 0.55 },
        { rarity: 'YS', p: 0.15 },
        { rarity: 'WBE', p: 0.08 },
        { rarity: 'WGK', p: 0.07 },
        { rarity: 'MVP', p: 0.08 },
        { rarity: 'ATLE', p: 0.07 },
      ],
    },
  ],
}

/** Rarities that trigger the gold-flash / badge-slam treatment in the reveal. */
export const HIGH_RARITIES: Rarity[] = ['WBE', 'WGK', 'MVP', 'ATLE', 'YS']

/** Foil (kira-shine) rarities — RAR and above except ATLE paper. */
export const FOIL_RARITIES: Rarity[] = ['RAR', 'WBE', 'WGK', 'MVP', 'YS']

export function formatPct(p: number): string {
  const pct = p * 100
  if (pct >= 10) return `${Math.round(pct)}%`
  if (pct >= 1) return `${pct.toFixed(1).replace(/\.0$/, '')}%`
  return `${pct.toFixed(2).replace(/0$/, '').replace(/\.$/, '.0')}%`
}
