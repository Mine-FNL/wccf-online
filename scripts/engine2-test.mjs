/**
 * engine2 validation — run: npx tsx scripts/engine2-test.mjs
 * Asserts determinism, windows, tactics, subs, hexagon and PK termination.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  createStepper,
  createMatch2,
  computeHexagon,
} from '../src/lib/engine2/index.ts'

const here = dirname(fileURLToPath(import.meta.url))
const cards = JSON.parse(
  readFileSync(join(here, '../public/data/cards.json'), 'utf8'),
)

/* ---------------------------------------------------------------- */
/* helpers                                                          */
/* ---------------------------------------------------------------- */

let failures = 0
const report = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

/** cards.json positions are band-level (GK/DF/MF/FW); map onto engine slots */
const SLOT_POS = ['GK', 'LSB', 'CB', 'CB', 'RSB', 'SMF', 'CMF', 'CMF', 'SMF', 'FW', 'CF']

const toPlayer = (c, pos) => ({
  id: c.id,
  name: c.name,
  number: c.number,
  position: pos,
  stats: { ...c.stats },
  trait: c.trait,
})

function pickCards(band, n, skip) {
  const out = []
  for (const c of cards) {
    if (out.length >= n) break
    if (skip.has(c.id)) continue
    if (c.positions.includes(band)) {
      skip.add(c.id)
      out.push(c)
    }
  }
  if (out.length < n) throw new Error(`not enough ${band} cards`)
  return out
}

/** build a TeamInput2 from the card DB: 1 GK / 4 DF / 4 MF / 2 FW + 5 bench */
function makeTeam(name, short, color, seedOffset = 0, extra = {}) {
  const skip = new Set()
  const gk = pickCards('GK', 2, skip)
  const df = pickCards('DF', 6, skip)
  const mf = pickCards('MF', 6, skip)
  const fw = pickCards('FW', 3, skip)
  const pool = [
    [gk[0], 'GK'],
    [df[0], 'LSB'], [df[1], 'CB'], [df[2], 'CB'], [df[3], 'RSB'],
    [mf[0], 'SMF'], [mf[1], 'CMF'], [mf[2], 'CMF'], [mf[3], 'SMF'],
    [fw[0], 'FW'], [fw[1], 'CF'],
  ]
  const xi = pool.map(([c, pos]) => toPlayer(c, pos))
  const bench = [
    toPlayer(gk[1], 'GK'),
    toPlayer(df[4], 'CB'),
    toPlayer(df[5], 'LSB'),
    toPlayer(mf[4], 'CMF'),
    toPlayer(mf[5], 'OMF'),
    toPlayer(fw[2], 'FW'),
  ].slice(0, 5)
  void seedOffset
  return { name, short, color, xi, bench, ...extra }
}

/** defensively hopeless clone — forces low-scoring matches (PK test) */
function weaken(team) {
  const weak = (p) => ({
    ...p,
    stats: { off: 2, def: 16, tec: 8, pow: 10, spd: 8, sta: 12 },
  })
  return { ...team, xi: team.xi.map(weak), bench: team.bench.map(weak) }
}

const goalsFor = (tl, side) => tl.finalScore[side]
const windowsFor = (tl, side) =>
  tl.events.filter((e) => e.kind === 'window-open' && e.data?.side === side)
    .length

/* ---------------------------------------------------------------- */
/* shared teams                                                     */
/* ---------------------------------------------------------------- */

const home = makeTeam('AS Roma', 'ROM', '#8E1F2F', 0)
const away = makeTeam('Juventus', 'JUV', '#111111', 1)
// different squads: rebuild away from later cards
{
  const skip = new Set(home.xi.concat(home.bench).map((p) => p.id))
  const gk = pickCards('GK', 2, skip)
  const df = pickCards('DF', 6, skip)
  const mf = pickCards('MF', 6, skip)
  const fw = pickCards('FW', 3, skip)
  away.xi = [
    toPlayer(gk[0], 'GK'),
    toPlayer(df[0], 'LSB'), toPlayer(df[1], 'CB'), toPlayer(df[2], 'CB'), toPlayer(df[3], 'RSB'),
    toPlayer(mf[0], 'SMF'), toPlayer(mf[1], 'DMF'), toPlayer(mf[2], 'CMF'), toPlayer(mf[3], 'SMF'),
    toPlayer(fw[0], 'FW'), toPlayer(fw[1], 'CF'),
  ]
  away.bench = [toPlayer(gk[1], 'GK'), toPlayer(df[4], 'CB'), toPlayer(df[5], 'RSB'), toPlayer(mf[4], 'CMF'), toPlayer(fw[2], 'CF')]
}
void SLOT_POS

/* ---------------------------------------------------------------- */
/* 1. determinism                                                   */
/* ---------------------------------------------------------------- */

{
  const a = createMatch2(42, home, away)
  const b = createMatch2(42, home, away)
  const same =
    JSON.stringify(a.events) === JSON.stringify(b.events) &&
    JSON.stringify(a.finalScore) === JSON.stringify(b.finalScore)
  report('1a determinism: identical runs, no commands', same,
    `score ${a.finalScore.home}-${a.finalScore.away}, ${a.events.length} events`)

  const log = [
    { at: 600, type: 'tactic', tactic: { lane: 'left', stance: 'normal' } },
    { at: 1500, type: 'tactic', tactic: { lane: 'balanced', stance: 'press' } },
    { at: 3300, type: 'tactic', tactic: { lane: 'centre', stance: 'counter' } },
  ]
  const c = createMatch2(42, home, away, log)
  const d = createMatch2(42, home, away, log)
  const sameLog =
    JSON.stringify(c.events) === JSON.stringify(d.events) &&
    JSON.stringify(c.finalScore) === JSON.stringify(d.finalScore) &&
    c.commandLog.length === 3
  report('1b determinism: identical runs with fixed command log', sameLog,
    `score ${c.finalScore.home}-${c.finalScore.away}, log ${c.commandLog.length}`)
}

/* ---------------------------------------------------------------- */
/* 2. different seeds → different outcomes                          */
/* ---------------------------------------------------------------- */

{
  const sigs = new Set()
  for (const s of [1, 2, 3, 4, 5]) {
    const tl = createMatch2(s, home, away)
    sigs.add(`${tl.finalScore.home}-${tl.finalScore.away}:${tl.events.length}`)
  }
  report('2 different seeds give different outcomes', sigs.size > 1,
    `${sigs.size} distinct signatures over 5 seeds`)
}

/* ---------------------------------------------------------------- */
/* 3. perfect shoot vs fizzle over 40 matches                       */
/* ---------------------------------------------------------------- */

{
  const runBatch = (quality) => {
    let goals = 0
    let windows = 0
    for (let m = 0; m < 40; m++) {
      const st = createStepper(1000 + m, home, away, {
        aiHome: false,
        aiAway: true,
      })
      while (!st.done()) {
        const evs = st.step(0.1)
        for (const e of evs) {
          if (e.kind === 'window-open' && e.data?.side === 'home') {
            windows++
            if (quality != null) st.command({ type: 'shoot', quality })
          }
        }
      }
      goals += goalsFor(st.timeline(), 'home')
    }
    return { goals, windows }
  }
  const perfect = runBatch(1.0)
  const fizzle = runBatch(null)
  const pr = perfect.goals / perfect.windows
  const fr = fizzle.goals / fizzle.windows
  report(
    '3 perfect SHOOT converts materially above fizzle (40 matches)',
    perfect.windows >= 80 && pr > fr + 0.1,
    `perfect ${perfect.goals}/${perfect.windows} (${(pr * 100).toFixed(1)}%) vs fizzle ${fizzle.goals}/${fizzle.windows} (${(fr * 100).toFixed(1)}%)`,
  )
}

/* ---------------------------------------------------------------- */
/* 4. counter stance raises conversion vs lane-attack opponent      */
/* ---------------------------------------------------------------- */

{
  const runBatch = (stance, n) => {
    let goals = 0
    let windows = 0
    for (let m = 0; m < n; m++) {
      const st = createStepper(5000 + m, home, away, {
        aiHome: false,
        aiAway: true,
      })
      st.command({ type: 'tactic', tactic: { lane: 'balanced', stance } })
      while (!st.done()) {
        const evs = st.step(0.1)
        for (const e of evs) {
          if (e.kind === 'window-open' && e.data?.side === 'home') {
            windows++
            st.command({ type: 'shoot', quality: 0.9 })
          }
        }
      }
      goals += goalsFor(st.timeline(), 'home')
    }
    return { goals, windows }
  }
  const N = 150
  const counter = runBatch('counter', N)
  const normal = runBatch('normal', N)
  const cr = counter.goals / counter.windows
  const nr = normal.goals / normal.windows
  report(
    `4 counter stance raises conversion (${N} matches, loose)`,
    counter.windows >= 200 && cr > nr,
    `counter ${counter.goals}/${counter.windows} (${(cr * 100).toFixed(1)}%) vs normal ${normal.goals}/${normal.windows} (${(nr * 100).toFixed(1)}%)`,
  )
}

/* ---------------------------------------------------------------- */
/* 5. windows open and close; none leak past done()                 */
/* ---------------------------------------------------------------- */

{
  const st = createStepper(777, home, away)
  while (!st.done()) st.step(0.1)
  const tl = st.timeline()
  let open = 0
  let balanced = true
  let opens = 0
  for (const e of tl.events) {
    if (e.kind === 'window-open') {
      open++
      opens++
      if (open > 1) balanced = false
    }
    if (e.kind === 'window-resolve') {
      open--
      if (open < 0) balanced = false
    }
  }
  report(
    '5 windows pair open/resolve; none leak past done()',
    balanced && open === 0 && opens > 0 && st.state().window === null,
    `${opens} windows, residual open=${open}`,
  )
}

/* ---------------------------------------------------------------- */
/* 6. cup PK: terminates ≤20 kicks and produces a winner            */
/* ---------------------------------------------------------------- */

{
  const weakHome = weaken(home)
  const weakAway = weaken(away)
  let pkCount = 0
  let ok = true
  let maxKicks = 0
  for (let s = 0; s < 30; s++) {
    const tl = createMatch2(9000 + s, weakHome, weakAway, [], { cup: true })
    if (!tl.pk) continue
    pkCount++
    maxKicks = Math.max(maxKicks, tl.pk.kicks.length)
    if (
      !tl.pk.decided ||
      !tl.pk.winner ||
      tl.pk.kicks.length > 20 ||
      tl.result === 'draw'
    )
      ok = false
  }
  report(
    '6 cup PK terminates ≤20 kicks with a winner (30 forced draws)',
    ok && pkCount >= 10,
    `${pkCount}/30 matches went to PK, max kicks ${maxKicks}`,
  )
}

/* ---------------------------------------------------------------- */
/* 7. user subs: real bench card in; >3 rejected                    */
/* ---------------------------------------------------------------- */

{
  const st = createStepper(31337, home, away, { aiHome: false, aiAway: true })
  while (!st.done() && st.state().phase !== 'halftime') st.step(0.1)
  const atHT = st.state().phase === 'halftime'
  const bench0 = home.bench[1] // outfield card
  st.command({ type: 'sub', outSlot: 5, inCardId: bench0.id })
  const replaced = st.state().homeXI[5].name === bench0.name
  // two more subs OK, fourth rejected
  st.command({ type: 'sub', outSlot: 6, inCardId: home.bench[2].id })
  st.command({ type: 'sub', outSlot: 7, inCardId: home.bench[3].id })
  st.command({ type: 'sub', outSlot: 8, inCardId: home.bench[4].id })
  const used = st.state().subsUsed.home
  report(
    '7 user sub uses real bench card; 4th sub rejected',
    atHT && replaced && used === 3,
    `slot5=${st.state().homeXI[5].name}, subsUsed=${used}`,
  )
}

/* ---------------------------------------------------------------- */
/* 8. hexagon                                                       */
/* ---------------------------------------------------------------- */

{
  const h0 = computeHexagon(home.xi)
  const inRange =
    h0.formation.length === 6 &&
    h0.practice.length === 6 &&
    h0.performance.length === 6 &&
    [...h0.formation, ...h0.practice, ...h0.performance].every(
      (v) => v >= 0 && v <= 100,
    )
  const fwd = computeHexagon(home.xi, { df: 0, mf: 0, fw: 1 })
  const back = computeHexagon(home.xi, { df: 0, mf: 0, fw: 0 })
  const perfIsMin = h0.performance.every(
    (v, i) => v === Math.min(h0.formation[i], h0.practice[i]),
  )
  report(
    '8 hexagon: 6 axes 0–100; FW line forward raises OFF, lowers DEF',
    inRange && perfIsMin && fwd.formation[0] > back.formation[0] &&
      fwd.formation[1] < back.formation[1],
    `OFF ${back.formation[0]}→${fwd.formation[0]}, DEF ${back.formation[1]}→${fwd.formation[1]}`,
  )
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)