import Modal from '@/components/Modal'
import PlayerCard from '@/components/PlayerCard'
import { cardTotal, RARITY_META } from '@/lib/data/cards'
import type { PlayerCardData } from '@/lib/data/types'
import { formatDate } from './clubUtils'

const SOURCE_LABELS: Record<string, string> = {
  starter: 'Starter squad',
  reward: 'Cabinet reward',
  'scout-pro': 'Pro scout pack',
  'scout-elite': 'Elite scout pack',
}

/**
 * Card detail modal — PlayerCard md (flip enabled) + ownership meta.
 * `meta` is optional so it can also present un-owned cards.
 */
export default function CardDetailModal({
  card,
  meta,
  onClose,
}: {
  card: PlayerCardData | null
  meta?: { source?: string; acquiredAt?: Date | string; count?: number }
  onClose: () => void
}) {
  return (
    <Modal open={card !== null} onClose={onClose} widthClass="max-w-lg">
      {card && (
        <div className="flex flex-col gap-4 min-[560px]:flex-row">
          <div className="mx-auto shrink-0">
            <PlayerCard card={card} size="md" flippable />
            <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-wccf-mute">
              Click card to flip
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-2xl font-bold uppercase tracking-[0.04em] text-wccf-ink">
              {card.name}
            </h3>
            <p className="mt-0.5 text-[13px] text-wccf-dim">
              {card.club} · <span className="italic">{card.trait}</span>
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-wccf-mute">Rarity</dt>
                <dd className="mt-0.5 text-[13px] font-semibold text-wccf-ink">
                  {RARITY_META[card.rarity].label}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-wccf-mute">Total</dt>
                <dd className="mt-0.5 font-mono text-[13px] font-bold text-accent tnum">
                  Σ {cardTotal(card)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-wccf-mute">Positions</dt>
                <dd className="mt-0.5 font-mono text-[13px] text-wccf-ink">{card.positions.join(' / ')}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-wccf-mute">Card No.</dt>
                <dd className="mt-0.5 font-mono text-[13px] text-wccf-ink">No. {card.cardNo}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-wccf-mute">Version</dt>
                <dd className="mt-0.5 text-[13px] text-wccf-ink">{card.version}</dd>
              </div>
              {meta?.count !== undefined && meta.count > 1 && (
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-wccf-mute">Copies</dt>
                  <dd className="mt-0.5 font-mono text-[13px] text-wccf-ink tnum">×{meta.count}</dd>
                </div>
              )}
              {meta?.source && (
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-wccf-mute">Source</dt>
                  <dd className="mt-0.5 text-[13px] text-wccf-ink">
                    {SOURCE_LABELS[meta.source] ?? meta.source}
                  </dd>
                </div>
              )}
              {meta?.acquiredAt && (
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-wccf-mute">Acquired</dt>
                  <dd className="mt-0.5 font-mono text-[13px] text-wccf-ink">{formatDate(meta.acquiredAt)}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}
    </Modal>
  )
}
