/**
 * MatchScreen — the original WCCF arcade match screen (spec §2), running on
 * the engine2 interactive stepper. The seated human is always `home`
 * (`aiHome: false`); a 100 ms interval advances `step()` and local React
 * state mirrors `stepper.state()`.
 *
 * Layout (spec §2, exact): top-center score/clock/half · LEFT data panel
 * (hexagon ↔ formation radar ↔ team styles/abilities via the DATA toggle)
 * · CENTER pitch view · bottom-left sub IN/OUT feed · bottom-right SPIRIT
 * gauge (classic/KP) or instruction-cost bar (Footista) · commentary ticker
 * above the era-correct BUTTON CONSOLE (§1) · card panel strip (§8).
 *
 * Chance windows freeze the match clock (2.5 s real): the TimingMeter
 * captures SHOOT/GK quality; halftime opens the TeamTalkModal (6 s
 * auto-pick); full time shows a brief banner then hands stepper.timeline()
 * + stepper.commandLog() to the flow root. Speed controls are spectator
 * only — the seated player gets pause (windows need real time).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CabinetEra } from '@/lib/data/cabinets'
import {
  createStepper,
  type Command,
  type CommandLogEntry,
  type Lane,
  type MatchEvent2,
  type MatchState2,
  type MatchTimeline2,
  type Stepper,
} from '@/lib/engine2'
import HexagonRadar from '@/components/HexagonRadar'
import PitchView from './PitchView'
import TimingMeter, { type PressSignal } from './TimingMeter'
import ConsoleClassic from './ConsoleClassic'
import ConsoleKP from './ConsoleKP'
import ConsoleFootista from './ConsoleFootista'
import CardPanelStrip, { type PendingSub } from './CardPanelStrip'
import TeamTalkModal from './TeamTalkModal'
import FormationRadar from './FormationRadar'
import { styleSlotForPosition } from './catalog'

const TICK_MS = 100
const PULSE_KINDS = new Set([
  'goal', 'chance', 'miss', 'yellow', 'red', 'sub',
  'window-open', 'window-resolve', 'steal', 'skill',
])
const STOPPAGE_KINDS = new Set([
  'goal', 'chance', 'miss', 'yellow', 'red', 'sub', 'window-resolve',
])

/** mirrors engine2's subAllowedNow: halftime, a window, or ≤12 s after a stoppage */
function stoppageNow(s: MatchState2): boolean {
  if (s.phase === 'halftime' || s.window) return true
  const ev = s.events.find((e) => STOPPAGE_KINDS.has(e.kind))
  return !!ev && s.clock - ev.t <= 12
}

const spiritMood = (v: number) =>
  v >= 95 ? 'MAX' : v >= 80 ? 'FIRED UP' : v >= 55 ? 'STEADY' : v >= 35 ? 'SHAKEN' : 'RATTLED'

/* ------------------------------------------------------------------ */

export default function MatchScreen({
  seed,
  home2,
  away2,
  era,
  formation,
  seat,
  spectator = false,
  onFullTime,
}: {
  seed: number
  home2: MatchTimeline2['home']
  away2: MatchTimeline2['away']
  era: CabinetEra
  /** human club formation — pitch anchors + radar */
  formation: string
  seat: number
  /** spectators get 1×/2×/4×; the seated player gets pause only */
  spectator?: boolean
  onFullTime: (timeline: MatchTimeline2, log: CommandLogEntry[]) => void
}) {
  const stepperRef = useRef<Stepper | null>(null)
  if (!stepperRef.current) {
    stepperRef.current = createStepper(seed, home2, away2, {
      aiHome: false,
      cup: false,
    })
  }

  const [snap, setSnap] = useState<MatchState2>(() => stepperRef.current!.state())
  const snapRef = useRef(snap)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
  const [speed, setSpeed] = useState<1 | 2 | 4>(1)
  const speedRef = useRef<1 | 2 | 4>(1)
  const [ftBanner, setFtBanner] = useState(false)
  const firedRef = useRef(false)

  const maxView = era === 'classic' ? 2 : 3
  const [dataView, setDataView] = useState(0)
  const [pressSignal, setPressSignal] = useState<PressSignal | null>(null)
  const [armedSlot, setArmedSlot] = useState<number | null>(null)
  const [targeting, setTargeting] = useState<'skill' | 'hotline' | null>(null)
  const [hotlineSel, setHotlineSel] = useState<number[]>([])
  const [subArm, setSubArm] = useState<string | null>(null)
  const [pendingSub, setPendingSub] = useState<PendingSub | null>(null)
  const [usedBench, setUsedBench] = useState<string[]>([])
  const [breakFlash, setBreakFlash] = useState(false)

  const pulsesRef = useRef(new Map<string, number>())
  const [, setPulseVersion] = useState(0)
  const prevSubsRef = useRef(0)
  const lastSubTryRef = useRef(0)
  const breakTimerRef = useRef<number | null>(null)
  const holdStartRef = useRef<Record<string, number>>({})

  snapRef.current = snap
  pausedRef.current = paused
  speedRef.current = speed

  /* ---------------- commands ---------------- */

  const issue = useCallback((cmd: Command) => {
    const st = stepperRef.current
    if (!st || st.done()) return
    st.command(cmd)
    const s = st.state()
    snapRef.current = s
    setSnap(s)
  }, [])

  const pressSignalBump = useCallback((heldMs: number) => {
    setPressSignal((s) => ({ seq: (s?.seq ?? 0) + 1, heldMs }))
  }, [])

  const fireWindow = useCallback(
    (quality: number, rush: boolean) => {
      const w = snapRef.current.window
      if (!w) return
      if (w.side === 'home' && w.attackQuality == null) {
        issue({ type: 'shoot', quality })
      } else if (w.side === 'away' && w.keeperQuality == null) {
        issue({ type: 'keeper', quality, rush })
      }
    },
    [issue],
  )

  const setLane = useCallback(
    (lane: Lane) => {
      const t = snapRef.current.tacticHome
      issue({
        type: 'tactic',
        tactic: { lane: t.lane === lane ? 'balanced' : lane, stance: t.stance },
      })
    },
    [issue],
  )

  const setStance = useCallback(
    (stance: 'counter' | 'press') => {
      const t = snapRef.current.tacticHome
      issue({
        type: 'tactic',
        tactic: { lane: t.lane, stance: t.stance === stance ? 'normal' : stance },
      })
    },
    [issue],
  )

  const keyPlayer = useCallback(
    (heldMs: number) => {
      const s = snapRef.current
      if (heldMs >= 800) {
        if (s.spiritHome >= 95) issue({ type: 'special' })
        return
      }
      if (armedSlot == null) return
      const pos = s.homeXI[armedSlot]?.position ?? 'CMF'
      issue({ type: 'style', slot: styleSlotForPosition(pos) })
      setArmedSlot(null)
    },
    [armedSlot, issue],
  )

  /* ---------------- event pulses / BREAK flash ---------------- */

  const handleFresh = useCallback((fresh: MatchEvent2[]) => {
    let changed = false
    for (const e of fresh) {
      if (e.kind === 'break' && e.team === 'away') {
        setBreakFlash(true)
        if (breakTimerRef.current) window.clearTimeout(breakTimerRef.current)
        breakTimerRef.current = window.setTimeout(() => setBreakFlash(false), 1800)
      }
      if (PULSE_KINDS.has(e.kind)) {
        const until = Date.now() + 2400
        if (e.player) {
          pulsesRef.current.set(e.player, until)
          changed = true
        }
        if (e.assist) {
          pulsesRef.current.set(e.assist, until)
          changed = true
        }
      }
    }
    if (changed) setPulseVersion((v) => v + 1)
  }, [])

  /* ---------------- step loop ---------------- */

  useEffect(() => {
    const id = window.setInterval(() => {
      const st = stepperRef.current
      if (!st) return
      if (st.done()) {
        if (!firedRef.current) {
          firedRef.current = true
          setFtBanner(true)
          window.setTimeout(() => onFullTime(st.timeline(), st.commandLog()), 2500)
        }
        return
      }
      if (pausedRef.current) return
      const fresh = st.step((TICK_MS / 1000) * speedRef.current)
      if (fresh.length) handleFresh(fresh)
      const s = st.state()
      snapRef.current = s
      setSnap(s)
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [onFullTime, handleFresh])

  /* ---------------- sub queue (engine accepts ≤3, at stoppages) ---------------- */

  useEffect(() => {
    const used = snap.subsUsed.home
    if (pendingSub) {
      if (used > prevSubsRef.current) {
        /* sub event confirmed — the card slides from bench to pitch slot */
        setUsedBench((u) => [...u, pendingSub.cardId])
        setPendingSub(null)
      } else if (snap.phase === 'fulltime' || used >= 3) {
        setPendingSub(null)
      } else if (Date.now() - lastSubTryRef.current > 2200 && stoppageNow(snap)) {
        lastSubTryRef.current = Date.now()
        issue({ type: 'sub', outSlot: pendingSub.slot, inCardId: pendingSub.cardId })
      }
    }
    prevSubsRef.current = used
  }, [snap, pendingSub, issue])

  /* ---------------- keyboard ---------------- */

  const keyHandlerRef = useRef<(e: KeyboardEvent, down: boolean) => void>(() => {})
  keyHandlerRef.current = (e, down) => {
    const el = e.target as HTMLElement | null
    if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
    const k = e.key
    if (down) {
      /* tactics cluster — classic/KP eras only */
      if (era !== 'footista') {
        if (k === 'ArrowLeft') { e.preventDefault(); setLane('left'); return }
        if (k === 'ArrowRight') { e.preventDefault(); setLane('right'); return }
        if (k === 'ArrowUp') { e.preventDefault(); setLane('centre'); return }
        if (k === 'ArrowDown') { e.preventDefault(); setStance('counter'); return }
        if (k === 'c' || k === 'C') { setStance('counter'); return }
        if (k === ' ' || k === 'v' || k === 'V') { e.preventDefault(); setStance('press'); return }
      }
      if (k === 'Tab') { e.preventDefault(); setDataView((v) => (v + 1) % maxView); return }
      if (k === 'p' || k === 'P') { setPaused((p) => !p); return }
      if (e.repeat) return
      if (era === 'footista') {
        if (k === 'a' || k === 'A') holdStartRef.current.a = performance.now()
        else if (k === 'b' || k === 'B') issue({ type: 'press' })
        else if (k === 'c' || k === 'C') setTargeting((t) => (t === 'skill' ? null : 'skill'))
        else if (k === 'd' || k === 'D') {
          setTargeting((t) => (t === 'hotline' ? null : 'hotline'))
          setHotlineSel([])
        } else if (k === 'e' || k === 'E') issue({ type: 'manmark' })
        return
      }
      if (k === 'j' || k === 'J') pressSignalBump(0)
      else if (k === 'k' || k === 'K') holdStartRef.current.k = performance.now()
      else if ((k === 'l' || k === 'L') && era === 'kp') holdStartRef.current.l = performance.now()
      return
    }
    /* key releases — hold ≥0.8 s meanings (GK rush / special) */
    const held = (id: string) => {
      const t0 = holdStartRef.current[id]
      delete holdStartRef.current[id]
      return t0 == null ? null : performance.now() - t0
    }
    if (era === 'footista') {
      if (k === 'a' || k === 'A') {
        const ms = held('a')
        if (ms != null) {
          const w = snapRef.current.window
          if (w) pressSignalBump(w.side === 'away' ? ms : 0)
        }
      }
      return
    }
    if (k === 'k' || k === 'K') {
      const ms = held('k')
      if (ms != null) pressSignalBump(ms)
    } else if ((k === 'l' || k === 'L') && era === 'kp') {
      const ms = held('l')
      if (ms != null) keyPlayer(ms)
    }
  }

  useEffect(() => {
    const kd = (e: KeyboardEvent) => keyHandlerRef.current(e, true)
    const ku = (e: KeyboardEvent) => keyHandlerRef.current(e, false)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    return () => {
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
    }
  }, [])

  /* ---------------- strip interactions ---------------- */

  const benchClick = (cardId: string) => {
    if (snapRef.current.subsUsed.home >= 3) return
    setSubArm((a) => (a === cardId ? null : cardId))
  }

  const slotClick = (slot: number) => {
    if (targeting === 'skill') {
      issue({ type: 'skill', slot })
      setTargeting(null)
      return
    }
    if (targeting === 'hotline') {
      setHotlineSel((sel) =>
        sel.includes(slot)
          ? sel.filter((x) => x !== slot)
          : sel.length < 3
            ? [...sel, slot]
            : sel,
      )
      return
    }
    if (subArm) {
      const benchCard = home2.bench.find((b) => (b.id ?? b.name) === subArm)
      if (benchCard) {
        issue({ type: 'sub', outSlot: slot, inCardId: subArm })
        setPendingSub({ cardId: subArm, slot, onName: benchCard.name })
        lastSubTryRef.current = Date.now()
      }
      setSubArm(null)
      return
    }
    if (era === 'kp') setArmedSlot((a) => (a === slot ? null : slot))
  }

  const eligibleSlots = useMemo(() => {
    if (!subArm) return null
    const benchCard = home2.bench.find((b) => (b.id ?? b.name) === subArm)
    if (!benchCard) return null
    const out: number[] = []
    snap.homeXI.forEach((p, i) => {
      if (p.subbedOff || p.sentOff) return
      if ((p.position === 'GK') !== (benchCard.position === 'GK')) return
      out.push(i)
    })
    return out
  }, [subArm, snap.homeXI, home2.bench])

  /* ---------------- derived view data ---------------- */

  const windowMode: 'attack' | 'defense' | null = snap.window
    ? snap.window.side === 'home'
      ? 'attack'
      : 'defense'
    : null

  const isPulsing = (name: string) => (pulsesRef.current.get(name) ?? 0) > Date.now()

  const benchLeft = home2.bench.filter((b) => !usedBench.includes(b.id ?? b.name))

  const subEvents = useMemo(
    () => snap.events.filter((e) => e.kind === 'sub').slice(0, 3),
    [snap.events],
  )

  const flavorLine =
    snap.phase === 'halftime'
      ? (snap.events.find(
          (e) => e.kind === 'info' && e.data && typeof e.data.flavor === 'string',
        )?.text ?? null)
      : null

  const DATA_LABELS =
    era === 'footista' ? ['Hexagon', 'Radar', 'Abilities'] : ['Hexagon', 'Radar', 'Styles']

  /* ---------------- render ---------------- */

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 p-3">
      {/* ---- top-center score / clock / half ---- */}
      <div className="flex items-center justify-center gap-2">
        <div className="flex items-center gap-3 rounded-panel border border-line bg-panel px-4 py-1.5">
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: home2.color }} />
            <span className="font-mono text-[11px] font-bold uppercase text-wccf-ink">{home2.short}</span>
          </span>
          <span className="font-display text-2xl font-bold text-wccf-ink tnum">
            {snap.score.home}<span className="mx-1 text-wccf-mute">–</span>{snap.score.away}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-bold uppercase text-wccf-ink">{away2.short}</span>
            <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: away2.color }} />
          </span>
          <span className="h-4 w-px bg-line-strong" />
          <span className="font-mono text-[13px] font-bold text-accent tnum">{snap.displayClock}</span>
          <span className="rounded-[3px] bg-inset px-1.5 py-[2px] font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-wccf-dim">
            {snap.phase === 'halftime' ? 'HT' : snap.phase === 'fulltime' ? 'FT' : snap.phase === 'pk' ? 'PK' : snap.half === 1 ? '1st' : '2nd'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? 'Resume' : 'Pause'}
          className="flex h-8 w-8 items-center justify-center rounded-btn border border-line bg-panel text-wccf-ink transition-colors hover:border-accent"
        >
          {paused ? <Play size={13} /> : <Pause size={13} />}
        </button>
        {spectator && (
          <div className="flex gap-1 rounded-panel border border-line bg-panel p-1">
            {([1, 2, 4] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={cn(
                  'rounded-btn px-2 py-1 font-mono text-[10px] font-bold transition-colors',
                  speed === s ? 'bg-accent-dim text-accent' : 'text-wccf-mute hover:text-wccf-ink',
                )}
              >
                {s}×
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---- left data panel + center pitch ---- */}
      <div className="flex items-start gap-2">
        <aside className="hidden w-[232px] shrink-0 flex-col gap-2 rounded-panel border border-line bg-panel p-2 min-[920px]:flex">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-wccf-mute">
              Data — {DATA_LABELS[dataView]}
            </span>
            <button
              type="button"
              onClick={() => setDataView((v) => (v + 1) % maxView)}
              className="rounded-[3px] border border-line px-1.5 py-[2px] font-mono text-[8px] font-bold uppercase text-wccf-dim transition-colors hover:border-accent hover:text-accent"
            >
              Toggle
            </button>
          </div>

          {dataView === 0 && (
            <div className="flex flex-col items-center gap-1">
              <HexagonRadar
                formation={snap.hexagon.formation}
                practice={snap.hexagon.practice}
                arrows={snap.tacticHome}
                size={206}
              />
              <div className="flex items-center justify-center gap-3 font-mono text-[8px] text-wccf-mute">
                <span className="flex items-center gap-1"><i className="h-[2px] w-3 bg-wccf-pitch" />formation</span>
                <span className="flex items-center gap-1"><i className="h-[2px] w-3 bg-wccf-caution" />practice</span>
                <span className="flex items-center gap-1"><i className="h-2 w-3 rounded-[2px] bg-[rgba(61,214,140,0.35)]" />performance</span>
              </div>
            </div>
          )}

          {dataView === 1 && (
            <FormationRadar
              formation={formation}
              homeXI={snap.homeXI}
              awayXI={snap.awayXI}
              bench={benchLeft}
              hotline={snap.hotline}
            />
          )}

          {dataView === 2 && era === 'kp' && (
            <div className="flex flex-col gap-1.5">
              {(['off', 'def', 'sup'] as const).map((slot) => {
                const st = home2.styles?.[slot]
                const active = snap.stylesActive.home[slot]
                return (
                  <div
                    key={slot}
                    className={cn(
                      'flex items-center gap-2 rounded-[5px] border px-2 py-1.5',
                      active ? 'border-wccf-gold bg-[rgba(232,184,75,0.1)]' : 'border-line bg-inset',
                    )}
                  >
                    <span className="w-8 font-mono text-[9px] font-bold uppercase text-wccf-mute">
                      {slot}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-wccf-ink">
                      {st?.name ?? '—'}
                    </span>
                    <span className="rounded-[3px] bg-raised px-1 font-mono text-[9px] font-bold text-wccf-gold">
                      {st?.rank ?? 'E'}
                    </span>
                    {active && (
                      <span className="font-mono text-[8px] font-bold uppercase text-wccf-gold">
                        Active
                      </span>
                    )}
                  </div>
                )
              })}
              <p className="px-1 font-mono text-[8px] leading-snug text-wccf-mute">
                Rub a card on the panel strip, then KEY PLAYER (L) to activate its style.
              </p>
            </div>
          )}

          {dataView === 2 && era === 'footista' && (
            <div className="flex flex-col gap-1.5">
              {snap.abilitiesActive.home.map((a) => (
                <div key={a} className="flex items-center gap-2 rounded-[5px] border border-line bg-inset px-2 py-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-wccf-caution" />
                  <span className="text-[11px] font-medium text-wccf-ink">{a}</span>
                </div>
              ))}
              <p className="px-1 font-mono text-[8px] leading-snug text-wccf-mute">
                Manager abilities picked pre-match — 3 of 14.
              </p>
            </div>
          )}
        </aside>

        {/* center pitch + overlays */}
        <div className="relative min-w-0 flex-1">
          <PitchView snap={snap} seed={seed} formation={formation} homeColor={home2.color} />

          <AnimatePresence>
            {snap.phase === 'halftime' && (
              <TeamTalkModal
                key="tt"
                homeShort={home2.short}
                awayShort={away2.short}
                score={snap.score}
                flavorLine={flavorLine}
                onPick={(choice) => issue({ type: 'teamtalk', choice })}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {snap.phase === 'pk' && snap.pk && (
              <motion.div
                key="pk"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-card bg-[rgba(4,6,10,0.85)]"
              >
                <span className="rounded-full bg-accent-dim px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
                  PK shootout — round {snap.pk.round}
                </span>
                <span className="font-mono text-xl font-bold text-wccf-ink tnum">
                  {snap.pk.score.home} — {snap.pk.score.away}
                </span>
                <div className="flex gap-1">
                  {snap.pk.kicks.map((k, i) => (
                    <span
                      key={i}
                      title={`${k.player} ${k.scored ? 'scored' : 'missed'}`}
                      className={cn(
                        'h-2.5 w-2.5 rounded-full border',
                        k.scored ? 'border-wccf-live bg-wccf-live' : 'border-wccf-danger bg-transparent',
                      )}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {ftBanner && (
              <motion.div
                key="ft"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-card bg-[rgba(4,6,10,0.75)] backdrop-blur-[2px]"
              >
                <motion.span
                  initial={{ scale: 1.25, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 20 }}
                  className="font-display text-4xl font-bold uppercase tracking-[0.08em] text-wccf-ink"
                >
                  Full time
                </motion.span>
                <span className="font-mono text-xl font-bold text-accent tnum">
                  {home2.short} {snap.score.home} — {snap.score.away} {away2.short}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-wccf-mute">
                  Reporting the result to the cabinet…
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ---- sub feed / commentary ticker / spirit ---- */}
      <div className="flex items-stretch gap-2">
        <div className="hidden w-[232px] shrink-0 flex-col gap-[3px] rounded-panel border border-line bg-panel px-2 py-1.5 min-[920px]:flex">
          <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-wccf-mute">
            Subs {snap.subsUsed.home}/3
          </span>
          {subEvents.length === 0 && (
            <span className="font-mono text-[9px] text-wccf-mute">no substitutions yet</span>
          )}
          {subEvents.map((e, i) => (
            <span key={`${e.t}-${i}`} className="truncate font-mono text-[9px] text-wccf-dim">
              <span className="text-wccf-live">IN ▶ {e.assist}</span>
              <span className="text-wccf-mute"> · </span>
              <span className="text-wccf-danger">◀ OUT {e.player}</span>
            </span>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 items-center rounded-panel border border-line bg-panel px-3 py-1.5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={`${snap.headline?.t ?? 'none'}-${snap.headline?.kind ?? ''}`}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -6, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className={cn(
                'truncate font-mono text-[11px] tnum',
                snap.headline?.kind === 'goal' ? 'text-accent' : 'text-wccf-dim',
              )}
            >
              ▸ {snap.headline?.text ?? 'Waiting for kick-off…'}
            </motion.span>
          </AnimatePresence>
        </div>

        <div className="hidden w-[220px] shrink-0 flex-col justify-center gap-1 rounded-panel border border-line bg-panel px-3 py-1.5 min-[920px]:flex">
          {era === 'footista' ? (
            <>
              <div className="flex items-center justify-between font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-wccf-mute">
                <span>Instruction cost</span>
                <span className="text-wccf-caution tnum">{snap.instructionCost.home}</span>
              </div>
              <div className="h-[6px] overflow-hidden rounded-full bg-inset">
                <div
                  className="h-full rounded-full bg-wccf-caution transition-[width] duration-150 ease-linear"
                  style={{ width: `${snap.instructionCost.home}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-wccf-mute">
                <span>Spirit — {spiritMood(snap.spiritHome)}</span>
                <span className={cn('tnum', snap.spiritHome >= 95 ? 'text-wccf-gold' : 'text-wccf-dim')}>
                  {snap.spiritHome}
                </span>
              </div>
              <div className="relative h-[6px] overflow-hidden rounded-full bg-inset">
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-300',
                    snap.spiritHome >= 95 ? 'bg-wccf-gold' : 'bg-accent',
                  )}
                  style={{ width: `${snap.spiritHome}%` }}
                />
                {era === 'kp' && (
                  <span className="absolute inset-y-0 left-[95%] w-px bg-wccf-gold" aria-hidden />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---- timing meter (above the console) ---- */}
      <TimingMeter
        win={snap.window}
        mode={windowMode}
        pressSignal={pressSignal}
        onFire={fireWindow}
      />

      {/* ---- button console (era-correct, spec §1) ---- */}
      <div className="relative">
        {era === 'footista' ? (
          <ConsoleFootista
            pool={snap.instructionCost.home}
            windowMode={windowMode}
            targeting={targeting}
            hotlineCount={hotlineSel.length}
            breakFlash={breakFlash}
            onA={(heldMs) => {
              const w = snapRef.current.window
              if (w) pressSignalBump(w.side === 'away' ? heldMs : 0)
            }}
            onB={() => issue({ type: 'press' })}
            onC={() => setTargeting((t) => (t === 'skill' ? null : 'skill'))}
            onD={() => {
              setTargeting((t) => (t === 'hotline' ? null : 'hotline'))
              setHotlineSel([])
            }}
            onConfirmHotline={() => {
              if (hotlineSel.length) issue({ type: 'hotline', slots: hotlineSel })
              setTargeting(null)
              setHotlineSel([])
            }}
            onE={() => issue({ type: 'manmark' })}
          />
        ) : era === 'kp' ? (
          <ConsoleKP
            tactic={snap.tacticHome}
            windowMode={windowMode}
            onLane={setLane}
            onStance={setStance}
            onShoot={() => pressSignalBump(0)}
            onGk={(heldMs) => pressSignalBump(heldMs)}
            armedName={armedSlot != null ? (snap.homeXI[armedSlot]?.name ?? null) : null}
            spirit={snap.spiritHome}
            onKeyPlayer={keyPlayer}
            onCycleData={() => setDataView((v) => (v + 1) % maxView)}
            dataViewLabel={DATA_LABELS[dataView]}
          />
        ) : (
          <ConsoleClassic
            tactic={snap.tacticHome}
            windowMode={windowMode}
            onLane={setLane}
            onStance={setStance}
            onShoot={() => pressSignalBump(0)}
            onGk={(heldMs) => pressSignalBump(heldMs)}
          />
        )}
        <span className="absolute right-2 top-1 rounded-[3px] border border-line px-1.5 py-[2px] font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-wccf-mute">
          {era === 'kp' ? 'KP era' : era === 'footista' ? 'Footista' : 'Classic'} · Seat {seat}
        </span>
      </div>

      {/* ---- card panel strip (spec §8) ---- */}
      <CardPanelStrip
        xi={snap.homeXI}
        bench={benchLeft}
        subArm={subArm}
        eligibleSlots={eligibleSlots}
        armedSlot={armedSlot}
        hotlineSel={hotlineSel}
        hotline={snap.hotline}
        pendingSub={pendingSub}
        isPulsing={isPulsing}
        onBenchClick={benchClick}
        onSlotClick={slotClick}
      />
    </div>
  )
}
