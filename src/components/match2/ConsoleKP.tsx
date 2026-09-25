/**
 * ConsoleKP — the 2006-07 → 2013-14 cabinet console (spec §1):
 * the classic console plus the KEY PLAYER button and the DATA toggle.
 *
 * Rub a card on the panel strip (it glows gold), then press KEY PLAYER (L)
 * to activate that card's Team Style. Long-press L at SPIRIT ≥ 95 fires the
 * Special Command — the button turns gold when the special is available.
 */
import { useRef } from 'react'
import type { Lane, TacticState } from '@/lib/engine2'
import ConsoleClassic from './ConsoleClassic'
import { ConsoleButton } from './consoleShared'

export default function ConsoleKP(props: {
  tactic: TacticState
  windowMode: 'attack' | 'defense' | null
  onLane: (lane: Lane) => void
  onStance: (stance: 'counter' | 'press') => void
  onShoot: () => void
  onGk: (heldMs: number) => void
  /** name of the rubbed panel card (null = rub one first) */
  armedName: string | null
  /** home spirit 0–100 — ≥95 turns the button gold (special armed) */
  spirit: number
  /** press L (heldMs ≥ 800 = special command attempt) */
  onKeyPlayer: (heldMs: number) => void
  /** DATA toggle — cycles the left panel */
  onCycleData: () => void
  dataViewLabel: string
}) {
  const {
    armedName,
    spirit,
    onKeyPlayer,
    onCycleData,
    dataViewLabel,
    ...classic
  } = props
  const specialReady = spirit >= 95
  return (
    <ConsoleClassic
      {...classic}
      extra={
        <div className="flex flex-col justify-center gap-1.5 rounded-panel border border-line bg-panel p-2">
          <KeyPlayerButton
            armedName={armedName}
            gold={specialReady}
            onRelease={onKeyPlayer}
          />
          <ConsoleButton
            label="Data"
            sub={dataViewLabel}
            hint="TAB"
            onPress={onCycleData}
            className="w-[104px]"
          />
        </div>
      }
    />
  )
}

function KeyPlayerButton({
  armedName,
  gold,
  onRelease,
}: {
  armedName: string | null
  gold: boolean
  onRelease: (heldMs: number) => void
}) {
  /* long-press support (≥0.8 s = Special Command) — ref because the screen
   * re-renders at 10 Hz while the button is held */
  const downAt = useRef(0)
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onPointerDown={() => {
          downAt.current = performance.now()
        }}
        onPointerUp={() => onRelease(performance.now() - downAt.current)}
        className={
          gold
            ? 'flex w-[104px] flex-col items-center gap-[2px] rounded-btn border border-wccf-gold bg-[rgba(232,184,75,0.16)] px-2 py-1.5 text-wccf-gold shadow-[0_0_14px_rgba(232,184,75,0.45)] transition-colors select-none'
            : 'flex w-[104px] flex-col items-center gap-[2px] rounded-btn border border-line-strong bg-raised px-2 py-1.5 text-wccf-dim transition-colors select-none hover:border-wccf-gold hover:text-wccf-gold'
        }
      >
        <span className="font-display text-[13px] font-bold uppercase leading-none tracking-[0.06em]">
          Key Player
        </span>
        <span className="max-w-full truncate font-mono text-[8px] uppercase tracking-[0.06em] opacity-80">
          {gold ? 'SPECIAL READY' : (armedName ?? 'rub a card')}
        </span>
        <span className="rounded-[3px] border border-line-strong bg-inset px-1 py-[1px] font-mono text-[8px] font-bold leading-none text-wccf-mute">
          L
        </span>
      </button>
    </div>
  )
}
