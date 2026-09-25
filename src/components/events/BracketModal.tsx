import { useMemo, useState } from 'react'
import Modal from '@/components/Modal'
import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BRACKET_ROUND_NAMES, demoBracket } from './data'
import { AI_CLUBS } from '@/lib/data/aiClubs'

function crestFor(club: string): string {
  return AI_CLUBS.find((c) => c.club === club)?.avatar ?? '/avatar-1.png'
}

function Chip({
  club,
  hovered,
  onHover,
  champion,
}: {
  club: string
  hovered: boolean
  onHover: (club: string | null) => void
  champion?: boolean
}) {
  return (
    <button
      onMouseEnter={() => onHover(club)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-card border px-2 py-1 text-left transition-colors',
        champion
          ? 'border-wccf-gold bg-[rgba(232,184,75,0.1)]'
          : hovered
            ? 'border-accent bg-accent-dim'
            : 'border-line bg-raised hover:border-line-strong',
      )}
    >
      <img src={crestFor(club)} alt="" className="h-4 w-4 rounded-full object-cover" />
      <span
        className={cn(
          'truncate font-mono text-[11px]',
          champion ? 'font-bold text-wccf-gold' : hovered ? 'font-bold text-accent' : 'text-wccf-ink',
        )}
      >
        {club}
      </span>
      {champion && <Trophy size={11} className="ml-auto shrink-0 text-wccf-gold" />}
    </button>
  )
}

/** 1px bracket connector between two rounds (vertical join + stubs). */
function ConnectorCell() {
  return (
    <div className="relative flex-1">
      {/* stubs from the two source chips (at 25% / 75% of the cell) */}
      <div className="absolute left-0 top-1/4 h-px w-1/2 bg-line" />
      <div className="absolute left-0 top-3/4 h-px w-1/2 bg-line" />
      {/* vertical join */}
      <div className="absolute left-1/2 top-1/4 h-1/2 w-px bg-line" />
      {/* stub to the target chip */}
      <div className="absolute left-1/2 top-1/2 h-px w-1/2 bg-line" />
    </div>
  )
}

/**
 * Demo 16-seat knockout bracket modal — hover a club to highlight its path
 * in accent (events.md §1 + interactions).
 */
export default function BracketModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rounds = useMemo(() => demoBracket(), [])
  const [hoverClub, setHoverClub] = useState<string | null>(null)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Intercontinental Cup — Bracket"
      widthClass="max-w-5xl"
    >
      <div className="max-h-[70vh] overflow-auto">
        <div className="relative flex h-[560px] min-w-[860px] gap-0">
          {/* emblem watermark behind the final */}
          <img
            src="/circle-emblem.svg"
            alt=""
            className="pointer-events-none absolute right-2 top-1/2 h-40 w-40 -translate-y-1/2 opacity-[0.06]"
          />
          {rounds.map((clubs, ri) => (
            <div key={ri} className="flex flex-1">
              {ri > 0 && (
                <div className="flex w-5 flex-col justify-around">
                  {clubs.map((_, ci) => (
                    <ConnectorCell key={ci} />
                  ))}
                </div>
              )}
              <div className="flex flex-1 flex-col">
                <div className="pb-2 text-center font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-wccf-mute">
                  {BRACKET_ROUND_NAMES[ri]}
                </div>
                <div className="flex flex-1 flex-col justify-around gap-1">
                  {clubs.map((club) => (
                    <Chip
                      key={club}
                      club={club}
                      champion={ri === rounds.length - 1}
                      hovered={hoverClub === club}
                      onHover={setHoverClub}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 font-mono text-[11px] text-wccf-mute">
        Demo bracket — the live draw is made when registration closes.
      </p>
    </Modal>
  )
}
