import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ChevronDown, Eraser, Save, Star, Wand2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import Modal from '@/components/Modal'
import PlayerCard from '@/components/PlayerCard'
import { useToast } from '@/components/Toast'
import { byId, cardTotal } from '@/lib/data/cards'
import type { PlayerCardData } from '@/lib/data/types'
import { trpc } from '@/providers/trpc'
import {
  FORMATION_PRESETS,
  cardFitsGroup,
  formationLayout,
  parseLineup,
  type Club,
  type LineupSlot,
  type OwnedEntry,
  type PositionGroup,
} from './clubUtils'

const GROUP_BADGE: Record<PositionGroup, string> = {
  GK: 'border-[#4DD0E1]/50 text-[#4DD0E1]',
  DF: 'border-wccf-live/50 text-wccf-live',
  MF: 'border-wccf-caution/50 text-wccf-caution',
  FW: 'border-wccf-danger/50 text-wccf-danger',
}

/** Is the current lineup dirty vs the club row? */
function sameLineup(a: LineupSlot[], b: LineupSlot[]): boolean {
  return a.every((s, i) => s.cardId === b[i].cardId && s.kp === b[i].kp)
}

/* ------------------------------------------------------------------ */
/* Slot picker modal                                                   */
/* ------------------------------------------------------------------ */

function SlotPicker({
  slot,
  group,
  owned,
  lineup,
  onPick,
  onClose,
}: {
  slot: number | null
  group: PositionGroup
  owned: OwnedEntry[]
  lineup: LineupSlot[]
  onPick: (cardId: string | null) => void
  onClose: () => void
}) {
  const eligible = useMemo(() => {
    const rows = owned
      .map((e) => ({ entry: e, card: byId(e.cardId) }))
      .filter((r): r is { entry: OwnedEntry; card: PlayerCardData } => !!r.card)
      .filter((r) => cardFitsGroup(r.card, group))
      .sort((a, b) => cardTotal(b.card) - cardTotal(a.card))
    return rows
  }, [owned, group])

  const assignedElsewhere = new Map(
    lineup.filter((s) => s.cardId && s.slot !== slot).map((s) => [s.cardId as string, s.slot]),
  )

  return (
    <Modal
      open={slot !== null}
      onClose={onClose}
      title={slot !== null ? `Slot ${slot === 0 ? 'GK' : slot} — pick a ${group} card` : undefined}
      widthClass="max-w-md"
    >
      <div className="max-h-[55vh] overflow-y-auto pr-1">
        <button
          onClick={() => onPick(null)}
          className="mb-2 flex w-full items-center gap-3 rounded-card border border-dashed border-line-strong px-3 py-2.5 text-left text-[13px] text-wccf-dim transition-colors hover:border-accent hover:text-wccf-ink"
        >
          <X size={14} /> Leave slot empty
        </button>
        {eligible.length === 0 && (
          <p className="py-6 text-center font-mono text-xs text-wccf-mute">
            No owned cards fit a {group} slot yet — win or scout more cards.
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          {eligible.map(({ entry, card }) => (
            <button
              key={card.id}
              onClick={() => onPick(card.id)}
              className="flex items-center gap-3 rounded-card border border-line bg-raised px-2 py-1.5 text-left transition-colors hover:border-line-strong"
            >
              <PlayerCard card={card} size="xs" flippable={false} className="pointer-events-none shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[16px] font-semibold uppercase leading-tight text-wccf-ink">
                  {card.name}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-wccf-dim">
                  <span className="rounded border border-line px-1 font-mono text-[9px] font-bold">
                    {card.positions.join('/')}
                  </span>
                  <span className="italic">{card.trait}</span>
                  {entry.count > 1 && <span className="font-mono tnum">×{entry.count}</span>}
                  {assignedElsewhere.has(card.id) && (
                    <span className="rounded bg-accent-dim px-1 font-mono text-[9px] font-bold uppercase text-accent">
                      in XI — swaps
                    </span>
                  )}
                </span>
              </span>
              <span className="font-mono text-sm font-bold text-accent tnum">Σ {cardTotal(card)}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Formation pitch + controls                                          */
/* ------------------------------------------------------------------ */

export default function FormationPitch({
  club,
  owned,
}: {
  club: Club
  owned: OwnedEntry[]
}) {
  const { toast } = useToast()
  const utils = trpc.useUtils()

  const [formation, setFormation] = useState(club.formation)
  const [slots, setSlots] = useState<LineupSlot[]>(() => parseLineup(club.lineupJson))
  const [pickerSlot, setPickerSlot] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [saved, setSaved] = useState(() => ({
    formation: club.formation,
    lineup: parseLineup(club.lineupJson),
  }))

  const layout = useMemo(() => formationLayout(formation), [formation])
  const dirty = formation !== saved.formation || !sameLineup(slots, saved.lineup)

  const update = trpc.club.update.useMutation({
    onSuccess: (data) => {
      setSaved({ formation: data.club.formation, lineup: parseLineup(data.club.lineupJson) })
      toast('Starting XI saved to your club.', 'success')
    },
    onError: (e) => toast(e.message || 'Could not save lineup', 'danger'),
    onSettled: () => utils.club.me.invalidate(),
  })

  const assign = (slot: number, cardId: string | null) => {
    setSlots((prev) => {
      const next = prev.map((s) => ({ ...s }))
      const target = next[slot]
      /* swap when the picked card already occupies another slot */
      if (cardId) {
        const other = next.find((s) => s.slot !== slot && s.cardId === cardId)
        if (other) {
          other.cardId = target.cardId
          if (!other.cardId) other.kp = false
        }
      }
      target.cardId = cardId
      if (!cardId) target.kp = false
      /* guarantee exactly one KP once any card is placed */
      if (cardId && !next.some((s) => s.kp && s.cardId)) target.kp = true
      return next
    })
    setPickerSlot(null)
  }

  const toggleKp = (slot: number) => {
    setSlots((prev) => {
      if (!prev[slot].cardId || prev[slot].kp) return prev
      return prev.map((s) => ({ ...s, kp: s.slot === slot }))
    })
  }

  const autoFill = () => {
    const used = new Set<string>()
    const poolFor = (group: PositionGroup) =>
      owned
        .map((e) => byId(e.cardId))
        .filter((c): c is PlayerCardData => !!c && !used.has(c.id) && cardFitsGroup(c, group))
        .sort((a, b) => cardTotal(b) - cardTotal(a))
    const next = slots.map((s) => ({ ...s, cardId: null as string | null, kp: false }))
    let best: { slot: number; total: number } | null = null
    for (const lay of layout) {
      const card = poolFor(lay.group)[0]
      if (card) {
        used.add(card.id)
        next[lay.slot].cardId = card.id
        const t = cardTotal(card)
        if (!best || t > best.total) best = { slot: lay.slot, total: t }
      }
    }
    if (best) next[(best as { slot: number }).slot].kp = true
    setSlots(next)
    toast(best ? 'Auto-filled the best XI from your cards.' : 'No owned cards to place yet.', best ? 'info' : 'danger')
  }

  const clearAll = () => {
    setSlots((prev) => prev.map((s) => ({ ...s, cardId: null, kp: false })))
  }

  const save = () => {
    update.mutate({ formation, lineup: slots })
  }

  const pickerLayout = pickerSlot !== null ? layout.find((l) => l.slot === pickerSlot) : undefined

  return (
    <div>
      {/* control bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* formation pill dropdown */}
        <div className="relative">
          <button
            onClick={() => setFormOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full border border-line bg-raised px-3.5 py-1.5 font-mono text-[13px] font-bold text-wccf-ink transition-colors hover:border-line-strong"
          >
            {formation}
            <ChevronDown size={13} className={cn('transition-transform', formOpen && 'rotate-180')} />
          </button>
          {formOpen && (
            <>
              <button aria-label="Close formations" className="fixed inset-0 z-30 cursor-default" onClick={() => setFormOpen(false)} />
              <div className="absolute left-0 top-full z-40 mt-1.5 w-36 overflow-hidden rounded-card border border-line bg-panel shadow-modal">
                {FORMATION_PRESETS.map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setFormation(f)
                      setFormOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 font-mono text-[13px] transition-colors hover:bg-raised',
                      f === formation ? 'text-accent' : 'text-wccf-dim hover:text-wccf-ink',
                    )}
                  >
                    {f}
                    {f === formation && <Check size={12} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          onClick={autoFill}
          className="flex items-center gap-1.5 rounded-full border border-line bg-raised px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-wccf-dim transition-colors hover:border-line-strong hover:text-wccf-ink"
        >
          <Wand2 size={13} /> Auto-fill
        </button>
        <button
          onClick={clearAll}
          className="flex items-center gap-1.5 rounded-full border border-line bg-raised px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-wccf-dim transition-colors hover:border-line-strong hover:text-wccf-ink"
        >
          <Eraser size={13} /> Clear
        </button>

        <button
          onClick={save}
          disabled={!dirty || update.isPending}
          className={cn(
            'ml-auto flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.06em] transition-all',
            dirty
              ? 'bg-accent text-[#0B0E14] hover:bg-accent-hover active:scale-[0.97]'
              : 'cursor-not-allowed border border-line bg-raised text-wccf-mute',
          )}
        >
          <Save size={13} />
          {update.isPending ? 'Saving…' : dirty ? 'Save XI' : 'Saved'}
        </button>
      </div>

      {/* pitch */}
      <div
        className="relative aspect-[4/5] w-full overflow-hidden rounded-panel border border-line bg-inset bg-cover bg-center"
        style={{ backgroundImage: 'url(/pitch-texture.svg)' }}
      >
        <div className="absolute inset-0 bg-[#080A0F]/40" />
        {layout.map((lay, i) => {
          const s = slots[lay.slot]
          const card = s.cardId ? byId(s.cardId) : undefined
          const isKp = s.kp && !!card
          return (
            <motion.div
              key={lay.slot}
              className="absolute z-10"
              style={{ translateX: '-50%', translateY: '-50%' }}
              initial={{ opacity: 0, y: -24, left: `${lay.x}%`, top: `${lay.y}%` }}
              animate={{ opacity: 1, y: 0, left: `${lay.x}%`, top: `${lay.y}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.04 * i }}
            >
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => setPickerSlot(lay.slot)}
                  aria-label={card ? `${card.name} — change` : `Empty ${lay.group} slot — pick a card`}
                  className={cn(
                    'relative rounded-card transition-transform hover:scale-[1.04] active:scale-[0.97]',
                    isKp && 'rounded-[10px] ring-2 ring-wccf-gold shadow-[0_0_14px_rgba(232,184,75,0.35)]',
                  )}
                >
                  {card ? (
                    <PlayerCard card={card} size="xs" flippable={false} className="pointer-events-none" />
                  ) : (
                    <span className="flex h-[90px] w-16 flex-col items-center justify-center gap-1 rounded-card border border-dashed border-line-strong bg-[#0B0E14]/60 text-wccf-mute transition-colors hover:border-accent hover:text-accent">
                      <span className="text-lg leading-none">+</span>
                      <span className={cn('rounded border px-1 font-mono text-[9px] font-bold', GROUP_BADGE[lay.group])}>
                        {lay.slot === 0 ? 'GK' : lay.group}
                      </span>
                    </span>
                  )}
                  {isKp && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-wccf-gold text-[#0B0E14]">
                      <Star size={11} fill="currentColor" />
                    </span>
                  )}
                </button>

                {/* name plate + strength gauge */}
                {card && (
                  <div className="w-16">
                    <p className="truncate text-center font-mono text-[9px] font-bold uppercase leading-tight text-wccf-ink [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">
                      {card.name.split(' ').slice(-1)[0]}
                    </p>
                    <div className="mt-0.5 h-[3px] overflow-hidden rounded-full bg-black/60">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.min(100, (cardTotal(card) / 110) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* KP toggle */}
                {card && (
                  <button
                    onClick={() => toggleKp(lay.slot)}
                    title={isKp ? 'Key Player' : 'Make Key Player'}
                    className={cn(
                      'flex items-center gap-1 rounded-full border px-1.5 py-[1px] font-mono text-[8px] font-bold uppercase tracking-[0.08em] transition-colors',
                      isKp
                        ? 'border-wccf-gold/60 bg-[rgba(232,184,75,0.14)] text-wccf-gold'
                        : 'border-line bg-[#0B0E14]/70 text-wccf-mute hover:border-wccf-gold/50 hover:text-wccf-gold',
                    )}
                  >
                    <Star size={8} fill={isKp ? 'currentColor' : 'none'} /> KP
                  </button>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      <p className="mt-2 font-mono text-[11px] text-wccf-mute">
        Click a slot to place an owned card · one Key Player per XI · Save keeps this XI on your club across devices.
      </p>

      <SlotPicker
        slot={pickerSlot}
        group={pickerLayout?.group ?? 'MF'}
        owned={owned}
        lineup={slots}
        onPick={(cardId) => pickerSlot !== null && assign(pickerSlot, cardId)}
        onClose={() => setPickerSlot(null)}
      />
    </div>
  )
}
