/**
 * CardPanelStrip — the flat card panel under the button console (spec §8):
 * 11 mini cards in formation order, a divider, then the 5 bench cards.
 *
 * - Cards pulse (accent ring) when named in a fresh event.
 * - Sub gesture: click a bench card → eligible pitch slots glow → click a
 *   slot to queue the swap (the engine only accepts ≤3 subs at a stoppage —
 *   a "SUB QUEUED" chip rides the slot until the sub event confirms).
 * - KP era: clicking a pitch card "rubs" it (golden glow) arming KEY PLAYER.
 * - Footista: hotline targeting highlights linked cards.
 */
import { cn } from '@/lib/utils'
import type { EnginePlayer2, PlayerLive2 } from '@/lib/engine2'

export interface PendingSub {
  cardId: string
  slot: number
  onName: string
}

function MiniCard({
  number,
  name,
  position,
  stamina,
  card,
  ring,
  dim = false,
  chip,
  onClick,
  title,
}: {
  number: number
  name: string
  position: string
  stamina?: number
  card?: 'yellow' | 'red' | null
  /** ring style: none / accent pulse / gold rub / eligibility glow / hotline */
  ring: 'pulse' | 'gold' | 'glow' | 'hotline' | null
  dim?: boolean
  chip?: string | null
  onClick?: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      title={title ?? `${number} ${name}`}
      onClick={onClick}
      className={cn(
        'relative flex w-[64px] shrink-0 flex-col items-center gap-[1px] rounded-[5px] border bg-raised px-1 py-1 transition-all duration-150',
        ring === 'pulse' && 'animate-pulse border-accent shadow-[0_0_10px_rgba(255,138,30,0.5)]',
        ring === 'gold' && 'border-wccf-gold shadow-[0_0_10px_rgba(232,184,75,0.55)]',
        ring === 'glow' && 'border-wccf-live shadow-[0_0_8px_rgba(61,214,140,0.5)]',
        ring === 'hotline' && 'border-wccf-caution shadow-[0_0_8px_rgba(255,197,49,0.5)]',
        !ring && 'border-line hover:border-line-strong',
        dim && 'opacity-40',
      )}
    >
      <span className="flex w-full items-center justify-between">
        <span className="font-mono text-[8px] font-bold text-wccf-mute tnum">{number}</span>
        <span className="font-mono text-[7.5px] uppercase text-wccf-mute">{position}</span>
      </span>
      <span className="w-full truncate text-center text-[9px] font-medium leading-tight text-wccf-ink">
        {name}
      </span>
      {stamina != null && (
        <span className="h-[2.5px] w-full overflow-hidden rounded-full bg-inset">
          <span
            className="block h-full rounded-full"
            style={{
              width: `${stamina}%`,
              backgroundColor: stamina > 55 ? '#3DD68C' : stamina > 28 ? '#FFC531' : '#FF4D4F',
            }}
          />
        </span>
      )}
      {card && (
        <span
          className={cn(
            'absolute -right-1 -top-1 h-[9px] w-[6px] rounded-[1px] border border-base',
            card === 'red' ? 'bg-wccf-danger' : 'bg-wccf-caution',
          )}
        />
      )}
      {chip && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[3px] bg-wccf-caution px-1 font-mono text-[7px] font-bold text-[#0B0E14]">
          {chip}
        </span>
      )}
    </button>
  )
}

export default function CardPanelStrip({
  xi,
  bench,
  benchSlots = 5,
  subArm,
  eligibleSlots,
  armedSlot,
  hotlineSel,
  hotline,
  pendingSub,
  isPulsing,
  onBenchClick,
  onSlotClick,
}: {
  /** live pitch cards in slot order */
  xi: PlayerLive2[]
  /** remaining bench cards */
  bench: EnginePlayer2[]
  benchSlots?: number
  /** armed bench card id (sub gesture step 1) */
  subArm: string | null
  /** pitch slots that may take the armed bench card (null = none armed) */
  eligibleSlots: number[] | null
  /** KP-rubbed slot (arms KEY PLAYER) */
  armedSlot: number | null
  /** footista hotline selection in progress */
  hotlineSel: number[]
  /** live hotline links */
  hotline: number[] | null
  pendingSub: PendingSub | null
  isPulsing: (name: string) => boolean
  onBenchClick: (cardId: string) => void
  onSlotClick: (slot: number) => void
}) {
  const ringFor = (p: PlayerLive2, i: number): 'pulse' | 'gold' | 'glow' | 'hotline' | null => {
    if (armedSlot === i) return 'gold'
    if (eligibleSlots?.includes(i)) return 'glow'
    if (hotlineSel.includes(i) || hotline?.includes(i)) return 'hotline'
    if (isPulsing(p.name)) return 'pulse'
    return null
  }

  return (
    <div className="flex items-center justify-center gap-1 overflow-x-auto rounded-panel border border-line bg-panel px-2 py-1.5">
      {/* XI in formation (slot) order */}
      {xi.map((p, i) => (
        <MiniCard
          key={`xi-${i}`}
          number={p.number}
          name={p.name}
          position={p.position}
          stamina={p.stamina}
          card={p.card}
          ring={ringFor(p, i)}
          dim={p.subbedOff || p.sentOff}
          chip={pendingSub?.slot === i ? 'SUB QUEUED' : p.subbedOn ? `ON ${p.subMinute}'` : null}
          onClick={() => onSlotClick(i)}
        />
      ))}

      {/* divider */}
      <span className="mx-1 h-10 w-px shrink-0 bg-line-strong" aria-hidden />

      {/* bench */}
      {Array.from({ length: benchSlots }, (_, i) => {
        const b = bench[i]
        if (!b) {
          return (
            <span
              key={`bench-${i}`}
              className="flex h-[46px] w-[64px] shrink-0 items-center justify-center rounded-[5px] border border-dashed border-line font-mono text-[8px] uppercase text-wccf-mute"
            >
              empty
            </span>
          )
        }
        const id = b.id ?? b.name
        return (
          <MiniCard
            key={`bench-${id}`}
            number={b.number}
            name={b.name}
            position={b.position}
            ring={subArm === id ? 'gold' : isPulsing(b.name) ? 'pulse' : null}
            chip={pendingSub?.cardId === id ? 'QUEUED' : null}
            onClick={() => onBenchClick(id)}
            title={`Sub: ${b.number} ${b.name} (${b.position})`}
          />
        )
      })}
    </div>
  )
}
