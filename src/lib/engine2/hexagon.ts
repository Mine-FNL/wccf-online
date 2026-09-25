/**
 * Team grid hexagon (gameplay-fidelity-spec §5).
 *
 * Axes (R1-confirmed): Offence / Defence / Possession / Winning / Speed /
 * Power — each derived 0–100 from the XI's cards via weighted position-band
 * averages ×5. Three zones: formation (green), practice (yellow), and the
 * bright-green overlap = elementwise min ("club performance").
 */
import type { EnginePlayer } from '../engine/types'
import type { Hexagon } from './types'

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

/** axis indices */
export const AXIS = { OFF: 0, DEF: 1, POS: 2, WIN: 3, SPD: 4, POW: 5 } as const
export const AXIS_NAMES = [
  'Offence',
  'Defence',
  'Possession',
  'Winning',
  'Speed',
  'Power',
] as const

const isDefBand = (p: EnginePlayer) =>
  ['CB', 'LSB', 'RSB', 'DF'].includes(p.position)
const isMidBand = (p: EnginePlayer) =>
  ['DMF', 'CMF', 'OMF', 'SMF', 'MF'].includes(p.position)
const isAttBand = (p: EnginePlayer) =>
  ['FW', 'CF', 'WF', 'ST'].includes(p.position)

/** weighted average of fn over the band; empty band → fallback over the XI */
function bandAvg(
  xi: EnginePlayer[],
  weight: (p: EnginePlayer) => number,
  fn: (p: EnginePlayer) => number,
): number {
  let wSum = 0
  let vSum = 0
  for (const p of xi) {
    const w = weight(p)
    if (w <= 0) continue
    wSum += w
    vSum += fn(p) * w
  }
  if (wSum > 0) return vSum / wSum
  return xi.length
    ? xi.reduce((a, p) => a + fn(p), 0) / xi.length
    : 0
}

const avg = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0

export interface LineNudges {
  df: number
  mf: number
  fw: number
}

/**
 * Compute the 3-zone hexagon for an XI as arranged.
 *
 * @param xi             live XI (effective, condition-adjusted stats)
 * @param lineNudges     forward/back gestures per line, each ∈ {-1,0,1};
 *                       every nudge shifts OFF/DEF ∓4 (a line pushed forward
 *                       raises OFF, lowers DEF), clamped
 * @param practiceLevels training levels 0–100 per axis (club profile);
 *                       defaults to the formation level (overlap = formation)
 */
export function computeHexagon(
  xi: EnginePlayer[],
  lineNudges: LineNudges = { df: 0, mf: 0, fw: 0 },
  practiceLevels?: number[],
): Hexagon {
  /* OFF = f(off, CF/FW weights) */
  let off = bandAvg(
    xi,
    (p) => (isAttBand(p) ? 1 : p.position === 'OMF' || p.position === 'SMF' ? 0.6 : p.position === 'CMF' ? 0.3 : 0),
    (p) => p.stats.off,
  )
  /* DEF = f(def, GK/DF weights) */
  let def = bandAvg(
    xi,
    (p) => (p.position === 'GK' ? 1.2 : isDefBand(p) ? 1 : p.position === 'DMF' ? 0.5 : 0),
    (p) => p.stats.def,
  )
  /* POS = f(tec, MF) */
  const pos = bandAvg(
    xi,
    (p) => (isMidBand(p) ? 1 : 0),
    (p) => p.stats.tec,
  )
  /* WIN = f(pow + sta) — winning the ball / fights */
  const win = avg(xi.map((p) => (p.stats.pow + p.stats.sta) / 2))
  const spd = avg(xi.map((p) => p.stats.spd))
  const pow = avg(xi.map((p) => p.stats.pow))

  /* cards are 0–20 per parameter → ×5 maps onto 0–100 */
  const nudge = clamp(lineNudges.df + lineNudges.mf + lineNudges.fw, -3, 3)
  const formation = [
    clamp(off * 5 + 4 * nudge, 0, 100),
    clamp(def * 5 - 4 * nudge, 0, 100),
    clamp(pos * 5, 0, 100),
    clamp(win * 5, 0, 100),
    clamp(spd * 5, 0, 100),
    clamp(pow * 5, 0, 100),
  ].map((v) => Math.round(v))

  const practice = practiceLevels
    ? practiceLevels.slice(0, 6).map((v) => clamp(Math.round(v), 0, 100))
    : [...formation]
  while (practice.length < 6) practice.push(formation[practice.length])

  const performance = formation.map((v, i) => Math.min(v, practice[i]))
  return { formation, practice, performance }
}
