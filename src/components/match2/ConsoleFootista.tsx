/**
 * ConsoleFootista — the 2019 → 2021 stadium cabinet console (spec §1, §4):
 * the regenerating INSTRUCTION COST pool (0–100, +6/s) and five instruction
 * buttons:
 *   A SHOOT&GK (25) · B PRESS (20) · C SKILL (30) · D HOTLINE (35) · E MAN-MARK (20)
 *
 * Buttons disable while their cost is unaffordable. D enters hotline mode:
 * tap up to 3 cards on the panel strip, then confirm. BREAK flashes the
 * console red when the opponent destroys our hotline.
 */
import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { INSTRUCTION_COST } from './catalog'
import { Kbd } from './consoleShared'

export type FootistaTargeting = 'skill' | 'hotline' | null

function InstructionButton({
  letter,
  label,
  cost,
  pool,
  active = false,
  pulse = false,
  onPress,
  onHoldRelease,
  sub,
}: {
  letter: string
  label: string
  cost: number
  pool: number
  active?: boolean
  /** pulse while its chance window is open (A button) */
  pulse?: boolean
  onPress: () => void
  /** release after hold — A button: heldMs ≥ 800 on defense = rush */
  onHoldRelease?: (heldMs: number) => void
  sub?: string
}) {
  const affordable = pool >= cost
  /* ref: the screen re-renders at 10 Hz while the button is held */
  const downAt = useRef(0)
  return (
    <button
      type="button"
      disabled={!affordable}
      onPointerDown={() => {
        downAt.current = performance.now()
      }}
      onPointerUp={() => {
        if (onHoldRelease) onHoldRelease(performance.now() - downAt.current)
      }}
      onClick={onHoldRelease ? undefined : onPress}
      className={cn(
        'flex w-[118px] flex-col items-center gap-[2px] rounded-btn border px-2 py-2 transition-colors duration-100 select-none',
        active
          ? 'border-accent bg-accent-dim text-accent shadow-[0_0_10px_rgba(255,138,30,0.3)]'
          : affordable
            ? 'border-line-strong bg-raised text-wccf-dim hover:border-accent hover:text-wccf-ink'
            : 'cursor-not-allowed border-line bg-panel text-wccf-mute opacity-45',
        pulse && affordable && 'animate-pulse border-accent text-accent',
      )}
    >
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-full border font-display text-[12px] font-bold',
            active || pulse ? 'border-accent text-accent' : 'border-line-strong text-wccf-ink',
          )}
        >
          {letter}
        </span>
        <span className="font-display text-[12px] font-bold uppercase tracking-[0.05em]">
          {label}
        </span>
      </span>
      <span className="font-mono text-[8px] uppercase tracking-[0.08em] opacity-80">
        {sub ?? ' '}
      </span>
      <span className="flex items-center gap-1.5">
        {cost > 0 && (
          <span className="font-mono text-[9px] font-bold text-wccf-caution">-{cost}</span>
        )}
        <Kbd>{letter}</Kbd>
      </span>
    </button>
  )
}

export default function ConsoleFootista({
  pool,
  windowMode,
  targeting,
  hotlineCount,
  breakFlash,
  onA,
  onB,
  onC,
  onD,
  onConfirmHotline,
  onE,
}: {
  /** instruction-cost pool 0–100 (home) */
  pool: number
  windowMode: 'attack' | 'defense' | null
  targeting: FootistaTargeting
  /** cards picked so far in hotline mode (≤3) */
  hotlineCount: number
  /** opponent just broke our hotline — flash the console red */
  breakFlash: boolean
  onA: (heldMs: number) => void
  onB: () => void
  onC: () => void
  onD: () => void
  onConfirmHotline: () => void
  onE: () => void
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-panel border bg-panel p-2 transition-colors duration-150',
        breakFlash ? 'border-wccf-danger shadow-[0_0_18px_rgba(255,77,79,0.4)]' : 'border-line',
      )}
    >
      {/* instruction-cost bar */}
      <div className="flex items-center gap-2 px-1">
        <span
          className={cn(
            'font-mono text-[9px] font-bold uppercase tracking-[0.16em]',
            breakFlash ? 'text-wccf-danger' : 'text-wccf-mute',
          )}
        >
          {breakFlash ? 'Break — hotline destroyed' : 'Instruction cost'}
        </span>
        <div className="relative h-[10px] min-w-0 flex-1 overflow-hidden rounded-full bg-inset">
          <div
            className="h-full rounded-full bg-wccf-caution transition-[width] duration-150 ease-linear"
            style={{ width: `${pool}%` }}
          />
        </div>
        <span className="font-mono text-[10px] font-bold text-wccf-caution tnum">
          {Math.round(pool)}
        </span>
        <span className="font-mono text-[8px] uppercase text-wccf-mute">+6/s</span>
      </div>

      {/* instruction buttons */}
      <div className="flex items-stretch justify-center gap-1.5">
        <InstructionButton
          letter="A"
          label="Shoot & GK"
          cost={INSTRUCTION_COST.shoot}
          pool={pool}
          pulse={windowMode != null}
          onPress={() => onA(0)}
          onHoldRelease={onA}
          sub={windowMode === 'defense' ? 'hold = rush' : 'timing window'}
        />
        <InstructionButton
          letter="B"
          label="Press"
          cost={INSTRUCTION_COST.press}
          pool={pool}
          onPress={onB}
          sub="15 s burst"
        />
        <InstructionButton
          letter="C"
          label="Skill"
          cost={INSTRUCTION_COST.skill}
          pool={pool}
          active={targeting === 'skill'}
          onPress={onC}
          sub={targeting === 'skill' ? 'pick a card' : 'trait 10 s'}
        />
        {targeting === 'hotline' ? (
          <InstructionButton
            letter="D"
            label={`Link ${hotlineCount}/3`}
            cost={0}
            pool={100}
            active
            onPress={onConfirmHotline}
            sub="tap to confirm"
          />
        ) : (
          <InstructionButton
            letter="D"
            label="Hotline"
            cost={INSTRUCTION_COST.hotline}
            pool={pool}
            onPress={onD}
            sub="link ≤3 · 20 s"
          />
        )}
        <InstructionButton
          letter="E"
          label="Man-Mark"
          cost={INSTRUCTION_COST.manmark}
          pool={pool}
          onPress={onE}
          sub="30 s shadow"
        />
      </div>
    </div>
  )
}
