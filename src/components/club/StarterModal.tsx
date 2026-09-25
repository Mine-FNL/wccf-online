import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import Modal from '@/components/Modal'
import PlayerCard from '@/components/PlayerCard'
import { byId } from '@/lib/data/cards'
import type { OwnedEntry } from './clubUtils'

/**
 * One-time "Starter squad issued" modal — shown right after the backend
 * creates the club and deals the 18-card starter squad.
 */
export default function StarterModal({
  open,
  owned,
  onClose,
}: {
  open: boolean
  owned: OwnedEntry[]
  onClose: () => void
}) {
  const cards = useMemo(
    () =>
      owned
        .map((e) => ({ entry: e, card: byId(e.cardId) }))
        .filter((r): r is { entry: OwnedEntry; card: NonNullable<ReturnType<typeof byId>> } => !!r.card),
    [owned],
  )

  const rarityCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of cards) m.set(r.card.rarity, (m.get(r.card.rarity) ?? 0) + r.entry.count)
    return [...m.entries()]
  }, [cards])

  return (
    <Modal open={open} onClose={onClose} widthClass="max-w-2xl">
      <div className="text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-accent-dim text-accent">
          <Sparkles size={20} />
        </div>
        <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-[0.04em] text-wccf-ink">
          Starter squad issued
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-wccf-dim">
          The cabinet printed your first {cards.reduce((a, r) => a + r.entry.count, 0)} cards —{' '}
          {rarityCount.map(([r, n]) => `${n} ${r}`).join(' · ')}. Set your XI, pick a Key Player,
          and take a seat in the lobby.
        </p>
      </div>
      <div className="mt-5 grid max-h-[46vh] grid-cols-3 gap-2 overflow-y-auto pr-1 min-[560px]:grid-cols-6">
        {cards.map((r) => (
          <div key={r.card.id} className="justify-self-center">
            <PlayerCard card={r.card} size="xs" flippable={false} className="pointer-events-none" />
            <p className="mt-1 w-16 truncate text-center font-mono text-[8px] font-bold uppercase text-wccf-dim">
              {r.card.name}
            </p>
          </div>
        ))}
      </div>
      <button
        onClick={onClose}
        className="mt-5 w-full rounded-full bg-accent px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.06em] text-[#0B0E14] transition-colors hover:bg-accent-hover active:scale-[0.98]"
      >
        Open my club
      </button>
    </Modal>
  )
}
