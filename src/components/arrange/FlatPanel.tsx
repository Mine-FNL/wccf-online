import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Eraser, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import PlayerCard from '@/components/PlayerCard'
import { byId, cardTotal } from '@/lib/data/cards'
import type { PlayerCardData } from '@/lib/data/types'
import {
  FORMATION_NAMES,
  autoArrange,
  canFill,
  emptyArrangement,
  formationSlots,
  remapFormation,
  validateRegistration,
  type Arrangement,
  type Band,
  type Nudges,
  type SlotDef,
} from '@/lib/arrangement'
import type { OwnedEntry } from '@/components/club/clubUtils'

/* ------------------------------------------------------------------ */
/* Band colors (original radar: FW red / MF orange / DF green / GK blue) */
/* ------------------------------------------------------------------ */

const BAND_COLOR: Record<Band, string> = {
  GK: '#4DD0E1',
  DF: '#3DD68C',
  MF: '#FFC531',
  FW: '#FF4D4F',
}

/** Visual depth shift applied per nudge step (pitch coordinates). */
const NUDGE_SHIFT = 0.04

type Selection = {
  cardId: string
  from: { kind: 'tray' } | { kind: 'bench'; index: number }
} | null

interface Flash {
  key: string
  reason: string
}

/* ------------------------------------------------------------------ */
/* Pitch markings — restrained dark felt, not a cartoon pitch          */
/* ------------------------------------------------------------------ */

function PitchMarkings() {
  const s = '#1E7A4C'
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 125" preserveAspectRatio="none">
      <g fill="none" stroke={s} strokeOpacity={0.35} strokeWidth={0.35}>
        <rect x={3} y={3} width={94} height={119} rx={1.5} />
        <line x1={3} y1={62.5} x2={97} y2={62.5} />
        <circle cx={50} cy={62.5} r={10} />
        {/* opponent box (top) */}
        <rect x={28} y={3} width={44} height={14} />
        <rect x={40} y={3} width={20} height={6} />
        {/* own box (bottom) */}
        <rect x={28} y={108} width={44} height={14} />
        <rect x={40} y={116} width={20} height={6} />
      </g>
      <circle cx={50} cy={62.5} r={0.8} fill={s} fillOpacity={0.4} />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* FlatPanel — the pitch-shaped card reader                            */
/* ------------------------------------------------------------------ */

export default function FlatPanel({
  arrangement,
  onChange,
  owned,
}: {
  arrangement: Arrangement
  onChange: (a: Arrangement) => void
  owned: OwnedEntry[]
}) {
  const [selection, setSelection] = useState<Selection>(null)
  const [flash, setFlash] = useState<Flash | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const defs = useMemo(() => formationSlots(arrangement.formation), [arrangement.formation])
  const registration = useMemo(
    () => validateRegistration(arrangement, byId),
    [arrangement],
  )

  const placedIds = useMemo(() => {
    const set = new Set<string>()
    for (const d of defs) {
      const id = arrangement.slots[d.id]
      if (id) set.add(id)
    }
    for (const id of arrangement.bench) if (id) set.add(id)
    return set
  }, [arrangement, defs])

  const tray = useMemo(
    () =>
      owned
        .map((e) => ({ entry: e, card: byId(e.cardId) }))
        .filter((r): r is { entry: OwnedEntry; card: PlayerCardData } => !!r.card)
        .sort((a, b) => cardTotal(b.card) - cardTotal(a.card)),
    [owned],
  )

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
    },
    [],
  )

  const reject = (key: string, reason: string) => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlash({ key, reason })
    flashTimer.current = setTimeout(() => setFlash(null), 2200)
  }

  /* ---------------- interactions ---------------- */

  const clickTrayCard = (cardId: string) => {
    if (placedIds.has(cardId)) return
    setSelection((sel) =>
      sel?.cardId === cardId ? null : { cardId, from: { kind: 'tray' } },
    )
  }

  const clickPitchSlot = (d: SlotDef) => {
    const occupant = arrangement.slots[d.id]
    if (!selection) {
      /* pick a placed card back up → returns to the tray */
      if (occupant) {
        onChange({ ...arrangement, slots: { ...arrangement.slots, [d.id]: null } })
      }
      return
    }
    const card = byId(selection.cardId)
    if (!card) {
      setSelection(null)
      return
    }
    if (!canFill(card.positions, d.band)) {
      reject(
        `slot:${d.id}`,
        d.band === 'GK'
          ? `${card.name} is not a goalkeeper`
          : `${card.name} cannot play ${d.band} (${card.positions.join('/')})`,
      )
      return
    }
    const slots = { ...arrangement.slots, [d.id]: card.id }
    const bench = [...arrangement.bench]
    if (selection.from.kind === 'bench') {
      /* the substitution gesture: bench card swaps with the pitch card */
      bench[selection.from.index] = occupant ?? null
    }
    onChange({ ...arrangement, slots, bench })
    setSelection(null)
  }

  const clickBenchSlot = (index: number) => {
    const occupant = arrangement.bench[index]
    if (!selection) {
      if (occupant) setSelection({ cardId: occupant, from: { kind: 'bench', index } })
      return
    }
    const bench = [...arrangement.bench]
    if (selection.from.kind === 'bench') {
      if (selection.from.index === index) {
        setSelection(null)
        return
      }
      /* swap two bench cards */
      bench[selection.from.index] = occupant ?? null
      bench[index] = selection.cardId
    } else {
      /* tray card onto the bench (displaced card returns to tray) */
      bench[index] = selection.cardId
    }
    onChange({ ...arrangement, bench })
    setSelection(null)
  }

  const switchFormation = (f: string) => {
    setSelection(null)
    onChange(remapFormation(arrangement, f, byId))
  }

  const stepNudge = (line: keyof Nudges, delta: number) => {
    const cur = arrangement.nudges[line]
    const next = Math.max(-1, Math.min(1, cur + delta)) as -1 | 0 | 1
    onChange({ ...arrangement, nudges: { ...arrangement.nudges, [line]: next } })
  }

  const handleAutoFill = () => {
    setSelection(null)
    onChange(
      autoArrange(
        owned.map((e) => e.cardId),
        byId,
        arrangement.formation,
      ),
    )
  }

  const handleClear = () => {
    setSelection(null)
    onChange(emptyArrangement(arrangement.formation))
  }

  /* ---------------- render ---------------- */

  const nudgeFor = (band: Band): number =>
    band === 'DF' ? arrangement.nudges.df : band === 'MF' ? arrangement.nudges.mf : band === 'FW' ? arrangement.nudges.fw : 0

  return (
    <div>
      {/* control bar */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {FORMATION_NAMES.map((f) => (
          <button
            key={f}
            onClick={() => switchFormation(f)}
            className={cn(
              'rounded-full border px-2.5 py-1 font-mono text-[11px] font-bold transition-colors active:scale-[0.97]',
              f === arrangement.formation
                ? 'border-accent bg-accent-dim text-accent'
                : 'border-line bg-raised text-wccf-dim hover:border-line-strong hover:text-wccf-ink',
            )}
          >
            {f}
          </button>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-line sm:block" />
        <button
          onClick={handleAutoFill}
          className="flex items-center gap-1.5 rounded-full border border-line bg-raised px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-wccf-dim transition-colors hover:border-line-strong hover:text-wccf-ink"
        >
          <Wand2 size={12} /> Auto-fill
        </button>
        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 rounded-full border border-line bg-raised px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-wccf-dim transition-colors hover:border-line-strong hover:text-wccf-ink"
        >
          <Eraser size={12} /> Clear
        </button>
      </div>

      {/* validation strip — the original card-check screen */}
      <div
        className={cn(
          'mb-3 rounded-card border px-3 py-2 font-mono text-[11px] leading-relaxed',
          registration.ok
            ? 'border-wccf-live/40 bg-[rgba(61,214,140,0.08)] text-wccf-live'
            : 'border-wccf-danger/40 bg-[rgba(255,77,79,0.07)] text-wccf-danger',
        )}
      >
        {registration.ok ? (
          <span className="font-bold uppercase tracking-[0.12em]">▣ Card check OK — 11 + subs registered</span>
        ) : (
          <>
            <span className="font-bold uppercase tracking-[0.12em]">Card check — {registration.errors.length} error{registration.errors.length === 1 ? '' : 's'}</span>
            <ul className="mt-1 list-none">
              {registration.errors.map((e) => (
                <li key={e}>· {e}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* pitch panel */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-panel border border-line bg-inset">
        <div className="absolute inset-0 bg-[#0A0F0D]" />
        <PitchMarkings />
        {/* opponent / own goal captions */}
        <span className="absolute left-1/2 top-1.5 -translate-x-1/2 font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-wccf-mute/70">
          Opponent
        </span>
        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-wccf-mute/70">
          Own goal
        </span>

        {defs.map((d, i) => {
          const occupantId = arrangement.slots[d.id]
          const card = occupantId ? byId(occupantId) : undefined
          const nudged = Math.max(0.03, Math.min(0.97, d.x + nudgeFor(d.band) * NUDGE_SHIFT))
          const top = (1 - nudged) * 100
          const left = d.y * 100
          const validTarget = selection ? canFill(byId(selection.cardId)?.positions ?? [], d.band) : false
          const flashing = flash?.key === `slot:${d.id}`
          return (
            <motion.div
              key={d.id}
              className="absolute z-10"
              style={{ translateX: '-50%', translateY: '-50%' }}
              initial={{ opacity: 0, y: -18, left: `${left}%`, top: `${top}%` }}
              animate={{ opacity: 1, y: 0, left: `${left}%`, top: `${top}%` }}
              transition={{ type: 'spring', stiffness: 140, damping: 19, delay: 0.03 * i }}
            >
              <div className="relative flex flex-col items-center gap-0.5">
                <button
                  onClick={() => clickPitchSlot(d)}
                  aria-label={
                    card
                      ? `${card.name} at ${d.id} — click to return to tray`
                      : `Empty ${d.band} slot ${d.id}`
                  }
                  className={cn(
                    'relative rounded-card transition-transform active:scale-[0.96]',
                    selection && validTarget && 'ring-2 ring-wccf-live shadow-[0_0_14px_rgba(61,214,140,0.35)]',
                    selection && !validTarget && !card && 'opacity-60',
                    flashing && 'ring-2 ring-wccf-danger shadow-[0_0_14px_rgba(255,77,79,0.5)]',
                  )}
                >
                  {card ? (
                    <PlayerCard card={card} size="xs" flippable={false} className="pointer-events-none" />
                  ) : (
                    <span
                      className={cn(
                        'flex h-[90px] w-16 flex-col items-center justify-center gap-1 rounded-card border border-dashed bg-[#0B0E14]/55 transition-colors',
                        selection && validTarget ? 'border-wccf-live/70' : 'border-line-strong',
                      )}
                    >
                      <span className="text-lg leading-none text-wccf-mute">+</span>
                      <span
                        className="rounded border px-1 font-mono text-[9px] font-bold"
                        style={{ borderColor: `${BAND_COLOR[d.band]}66`, color: BAND_COLOR[d.band] }}
                      >
                        {d.id.toUpperCase()}
                      </span>
                    </span>
                  )}
                </button>

                {/* invalid-placement tooltip */}
                {flashing && (
                  <div className="absolute -top-9 left-1/2 z-30 w-max max-w-[180px] -translate-x-1/2 rounded-btn border border-wccf-danger/50 bg-[#170A10] px-2 py-1 text-center font-mono text-[9px] font-bold text-wccf-danger shadow-modal">
                    {flash?.reason}
                  </div>
                )}

                {card && (
                  <p className="w-16 truncate text-center font-mono text-[9px] font-bold uppercase leading-tight text-wccf-ink [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">
                    {card.name.split(' ').slice(-1)[0]}
                  </p>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* line nudge controls — the card forward/back gesture */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        {(
          [
            { key: 'fw', label: 'FW line' },
            { key: 'mf', label: 'MF line' },
            { key: 'df', label: 'DF line' },
          ] as const
        ).map(({ key, label }) => {
          const v = arrangement.nudges[key]
          return (
            <div key={key} className="flex items-center justify-between rounded-card border border-line bg-panel px-2 py-1.5">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-wccf-dim">
                {label}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => stepNudge(key, 1)}
                  disabled={v === 1}
                  title="Push line forward"
                  aria-label={`Push ${label} forward`}
                  className="flex h-6 w-6 items-center justify-center rounded-btn border border-line text-wccf-dim transition-colors enabled:hover:border-accent enabled:hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronUp size={12} />
                </button>
                <span
                  className={cn(
                    'w-7 text-center font-mono text-[11px] font-bold tnum',
                    v > 0 ? 'text-wccf-live' : v < 0 ? 'text-wccf-caution' : 'text-wccf-mute',
                  )}
                >
                  {v > 0 ? '+1' : v < 0 ? '−1' : '0'}
                </span>
                <button
                  onClick={() => stepNudge(key, -1)}
                  disabled={v === -1}
                  title="Pull line back"
                  aria-label={`Pull ${label} back`}
                  className="flex h-6 w-6 items-center justify-center rounded-btn border border-line text-wccf-dim transition-colors enabled:hover:border-accent enabled:hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronDown size={12} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-1 font-mono text-[10px] text-wccf-mute">
        ▲ push a line forward = more offensive · ▼ pull back = more defensive (OFF/DEF ±4 per step)
      </p>

      {/* bench — SUBS */}
      <div className="mt-3 rounded-panel border border-line bg-panel p-2.5">
        <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-wccf-mute">
          Subs
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {arrangement.bench.map((id, i) => {
            const card = id ? byId(id) : undefined
            const selected = selection?.from.kind === 'bench' && selection.from.index === i
            return (
              <button
                key={i}
                onClick={() => clickBenchSlot(i)}
                aria-label={card ? `Sub ${card.name}` : 'Empty sub slot'}
                className={cn(
                  'relative shrink-0 rounded-card transition-transform active:scale-[0.96]',
                  selected && 'ring-2 ring-accent shadow-accent-glow',
                  selection && !selected && 'ring-1 ring-wccf-live/50',
                )}
              >
                {card ? (
                  <PlayerCard card={card} size="xs" flippable={false} className="pointer-events-none" />
                ) : (
                  <span className="flex h-[90px] w-16 items-center justify-center rounded-card border border-dashed border-line bg-[#0B0E14]/40 font-mono text-[9px] font-bold uppercase text-wccf-mute">
                    Sub {i + 1}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 font-mono text-[10px] text-wccf-mute">
          Click a sub, then a pitch card — the swap is the substitution gesture.
        </p>
      </div>

      {/* collection tray */}
      <div className="mt-3 rounded-panel border border-line bg-panel p-2.5">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-wccf-mute">
            Card tray — {tray.length} owned
          </p>
          {selection && (
            <button
              onClick={() => setSelection(null)}
              className="font-mono text-[10px] font-bold uppercase text-accent hover:text-accent-hover"
            >
              Cancel selection
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tray.length === 0 && (
            <p className="py-6 pl-1 font-mono text-[11px] text-wccf-mute">
              No cards yet — take a seat in the lobby, the cabinet ejects one after every session.
            </p>
          )}
          {tray.map(({ entry, card }) => {
            const placed = placedIds.has(card.id)
            const selected = selection?.cardId === card.id
            return (
              <button
                key={card.id}
                onClick={() => clickTrayCard(card.id)}
                disabled={placed}
                aria-label={`${card.name} — ${placed ? 'already on the panel' : 'select card'}`}
                className={cn(
                  'relative shrink-0 rounded-card transition-all active:scale-[0.96]',
                  placed && 'cursor-not-allowed opacity-30 saturate-50',
                  selected && 'ring-2 ring-accent shadow-accent-glow',
                  !placed && !selected && 'hover:-translate-y-0.5',
                )}
              >
                <PlayerCard card={card} size="sm" flippable={false} className="pointer-events-none" />
                {entry.count > 1 && (
                  <span className="absolute right-1 top-1 rounded bg-[#0B0E14]/85 px-1 font-mono text-[9px] font-bold text-wccf-ink tnum">
                    ×{entry.count}
                  </span>
                )}
                {placed && (
                  <span className="absolute left-1 top-1 rounded bg-accent-dim px-1 font-mono text-[8px] font-bold uppercase text-accent">
                    On panel
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
