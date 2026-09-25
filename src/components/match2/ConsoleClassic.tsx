/**
 * ConsoleClassic — the 2001-02 → 2005-06 cabinet console (spec §1):
 * the tactics cross cluster (↑ CENTRE BREAKTHROUGH, ←/→ SIDE ATTACK,
 * ↓ COUNTER, ⊙ PRESS in the middle) plus the two big convex arcade
 * buttons SHOOT (left) and GK RUSH (right, hold ≥0.8 s = rush).
 *
 * Lane and stance combine (last press wins); pressing the active lane
 * again returns to balanced. Keys shown on the buttons.
 */
import type { ReactNode } from 'react'
import type { Lane, TacticState } from '@/lib/engine2'
import { BigArcadeButton, ConsoleButton } from './consoleShared'

export interface ClassicConsoleProps {
  tactic: TacticState
  /** 'attack' while our SHOOT window is open, 'defense' for the GK window */
  windowMode: 'attack' | 'defense' | null
  onLane: (lane: Lane) => void
  onStance: (stance: 'counter' | 'press') => void
  onShoot: () => void
  /** GK release — heldMs ≥ 800 = keeper rush */
  onGk: (heldMs: number) => void
  /** KP-era extra column ([KEY PLAYER] [DATA]) rendered left of the cluster */
  extra?: ReactNode
}

export default function ConsoleClassic({
  tactic,
  windowMode,
  onLane,
  onStance,
  onShoot,
  onGk,
  extra,
}: ClassicConsoleProps) {
  return (
    <div className="flex items-stretch justify-center gap-4">
      {extra}

      {/* tactics cross cluster */}
      <div className="flex flex-col gap-1 rounded-panel border border-line bg-panel p-2">
        <span className="text-center font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-wccf-mute">
          Tactics
        </span>
        <div className="grid w-[210px] grid-cols-3 gap-1">
          <span />
          <ConsoleButton
            label="↑ Centre"
            sub="breakthrough"
            hint="↑"
            active={tactic.lane === 'centre'}
            onPress={() => onLane('centre')}
          />
          <span />
          <ConsoleButton
            label="← Side"
            sub="attack"
            hint="←"
            active={tactic.lane === 'left'}
            onPress={() => onLane('left')}
          />
          <ConsoleButton
            label="⊙ Press"
            sub="stance"
            hint="SPC"
            active={tactic.stance === 'press'}
            onPress={() => onStance('press')}
          />
          <ConsoleButton
            label="Side →"
            sub="attack"
            hint="→"
            active={tactic.lane === 'right'}
            onPress={() => onLane('right')}
          />
          <span />
          <ConsoleButton
            label="↓ Counter"
            sub="stance"
            hint="↓"
            active={tactic.stance === 'counter'}
            onPress={() => onStance('counter')}
          />
          <span />
        </div>
      </div>

      {/* the two big convex buttons */}
      <div className="flex items-center gap-3 rounded-panel border border-line bg-panel px-4 py-2">
        <BigArcadeButton
          color="#FF8A1E"
          label="Shoot"
          hint="J"
          pulse={windowMode === 'attack'}
          onTap={onShoot}
        />
        <BigArcadeButton
          color="#4DD0E1"
          label="GK Rush"
          sub="hold"
          hint="K"
          pulse={windowMode === 'defense'}
          onTap={() => onGk(0)}
          onHoldRelease={onGk}
        />
      </div>
    </div>
  )
}
