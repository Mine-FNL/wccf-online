/**
 * match2 smoke — run: npx tsx scripts/match2-smoke.mjs
 *
 * Drives the engine2 stepper exactly like MatchScreen does (100 ms steps,
 * aiHome: false) with the scripted command set the mission requires:
 *   1. a tactic at 10 s real time
 *   2. a SHOOT quality 0.9 in the first attack window (polled state.window)
 *   3. a teamtalk 0 at half-time
 *   4. one sub at half-time
 * then asserts: done() true, commandLog ≥ 4, final score consistent with the
 * event stream, and toV1Timeline() projecting onto the v1 MatchTimeline
 * shape the report/Theatre pipeline consumes.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createStepper } from '../src/lib/engine2/index.ts'
import {
  toV1Timeline,
  buildReportTimeline,
} from '../src/components/match/helpers.ts'

const here = dirname(fileURLToPath(import.meta.url))
const cards = JSON.parse(
  readFileSync(join(here, '../public/data/cards.json'), 'utf8'),
)

/* ---------------------------------------------------------------- */
let failures = 0
const report = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

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

function makeTeam(name, short, color, extra = {}) {
  const skip = new Set()
  const gk = pickCards('GK', 2, skip)
  const df = pickCards('DF', 6, skip)
  const mf = pickCards('MF', 6, skip)
  const fw = pickCards('FW', 3, skip)
  const xi = [
    [gk[0], 'GK'],
    [df[0], 'LSB'], [df[1], 'CB'], [df[2], 'CB'], [df[3], 'RSB'],
    [mf[0], 'SMF'], [mf[1], 'CMF'], [mf[2], 'CMF'], [mf[3], 'SMF'],
    [fw[0], 'FW'], [fw[1], 'CF'],
  ].map(([c, pos]) => toPlayer(c, pos))
  const bench = [
    toPlayer(gk[1], 'GK'),
    toPlayer(df[4], 'CB'),
    toPlayer(df[5], 'LSB'),
    toPlayer(mf[4], 'CMF'),
    toPlayer(mf[5], 'OMF'),
  ]
  void SLOT_POS
  return { name, short, color, xi, bench, ...extra }
}

/* ---------------------------------------------------------------- */
/* drive a full interactive match                                    */
/* ---------------------------------------------------------------- */

const seed = 20211
const home = makeTeam('Smoke United', 'SMK', '#FF8A1E', {
  era: 'kp',
  styles: { off: { name: 'Poacher', rank: 'B' } },
})
const away = makeTeam('Rovers CPU', 'ROV', '#3DD68C', { era: 'kp' })

const st = createStepper(seed, home, away, { aiHome: false })

let elapsed = 0
let tacticFired = false
let shootFired = false
let talkFired = false
let subFired = false
let sawAttackWindow = false
let guard = 0

const subCard = home.bench[1] // CB onto CB slot 2

while (!st.done() && guard++ < 30000) {
  st.step(0.1)
  elapsed += 0.1
  const s = st.state()

  /* 1 — tactic at 10 s real */
  if (!tacticFired && elapsed >= 10) {
    st.command({ type: 'tactic', tactic: { lane: 'left', stance: 'press' } })
    tacticFired = true
  }

  /* 2 — SHOOT 0.9 in the first attack window */
  if (!shootFired && s.window && s.window.side === 'home' && s.window.attackQuality == null) {
    sawAttackWindow = true
    st.command({ type: 'shoot', quality: 0.9 })
    shootFired = true
  }

  /* 3 + 4 — teamtalk 0 and one sub at half-time */
  if (s.phase === 'halftime') {
    if (!talkFired) {
      st.command({ type: 'teamtalk', choice: 0 })
      talkFired = true
    }
    if (!subFired) {
      st.command({ type: 'sub', outSlot: 2, inCardId: subCard.id })
      subFired = true
    }
  }
}

/* ---------------------------------------------------------------- */
/* assertions                                                        */
/* ---------------------------------------------------------------- */

report('match completes (done() true)', st.done(), `${guard} steps`)
report('scripted tactic fired', tacticFired)
report('attack window seen + SHOOT 0.9 fired', sawAttackWindow && shootFired)
report('teamtalk + sub fired at HT', talkFired && subFired)

const log = st.commandLog()
report('commandLog length ≥ 4', log.length >= 4, `${log.length} entries`)
report(
  'log covers tactic/shoot/teamtalk/sub',
  ['tactic', 'shoot', 'teamtalk', 'sub'].every((t) => log.some((c) => c.type === t)),
)

const tl = st.timeline()
const goalsHome = tl.events.filter((e) => e.kind === 'goal' && e.team === 'home').length
const goalsAway = tl.events.filter((e) => e.kind === 'goal' && e.team === 'away').length
report(
  'final score consistent with events',
  goalsHome === tl.finalScore.home && goalsAway === tl.finalScore.away,
  `${tl.finalScore.home}-${tl.finalScore.away} (${goalsHome}-${goalsAway} in events)`,
)
report('sub recorded on the v2 timeline', tl.subs.some((s) => s.onName === subCard.name))

/* ---- v1 adapter ---- */
const v1 = toV1Timeline(tl)
const V2_ONLY = ['window-open', 'window-resolve', 'tactic', 'steal', 'talk', 'style', 'skill', 'hotline', 'break', 'pk']
report('v1 duration / halfOneEnd / finalScore carried over',
  v1.duration === tl.duration && v1.halfOneEnd === tl.halfOneEnd &&
  v1.finalScore.home === tl.finalScore.home && v1.finalScore.away === tl.finalScore.away)
report('v1 staminaRates 22 entries', Array.isArray(v1.staminaRates) && v1.staminaRates.length === 22)
report('v1 bookingAt Int32Array(22)', v1.bookingAt instanceof Int32Array && v1.bookingAt.length === 22)
report('v1 ballTrack Float32Array covers duration',
  v1.ballTrack instanceof Float32Array && v1.ballTrack.length >= (tl.duration + 1) * 2)
report('v1 possessionTrack Float32Array', v1.possessionTrack instanceof Float32Array && v1.possessionTrack.length > 0)
report('v1 subs carried over', v1.subs.length === tl.subs.length)
report('v1 events contain no v2-only kinds', !v1.events.some((e) => V2_ONLY.includes(e.kind)))
const v1Goals = v1.events.filter((e) => e.kind === 'goal').length
report('v1 goal events == final score total',
  v1Goals === tl.finalScore.home + tl.finalScore.away,
  `${v1Goals} goal events`)

/* ---- report pipeline (Theatre / match.report contract) ---- */
const reportTl = buildReportTimeline(v1)
report('buildReportTimeline emits contract entries',
  Array.isArray(reportTl) &&
  reportTl.every((e) => Number.isFinite(e.min) && typeof e.type === 'string') &&
  reportTl.some((e) => e.type === 'halftime') && reportTl.some((e) => e.type === 'fulltime'),
  `${reportTl.length} entries`)
report('report timeline goals match score',
  reportTl.filter((e) => e.type === 'goal').length === tl.finalScore.home + tl.finalScore.away)

console.log(failures === 0 ? '\nSMOKE PASS' : `\nSMOKE FAIL — ${failures} failure(s)`)
process.exit(failures === 0 ? 0 : 1)
