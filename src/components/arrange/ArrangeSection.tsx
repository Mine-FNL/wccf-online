import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { trpc } from '@/providers/trpc'
import { byId } from '@/lib/data/cards'
import HexagonRadar from '@/components/HexagonRadar'
import FlatPanel from './FlatPanel'
import {
  computeFormationHex,
  fromLineupSlots,
  parseArrangement,
  pruneUnknown,
  toLineupSlots,
  validateRegistration,
  xiEntries,
  type Arrangement,
} from '@/lib/arrangement'
import { parseLineup, parseTraining, type Club, type OwnedEntry } from '@/components/club/clubUtils'

/**
 * Squad & Formation section (v2) — the flat-panel card arrangement editor
 * next to the live 3-zone hexagon radar.
 *
 * Persistence: formation + XI go to the club row via club.update
 * ({ formation, lineup }); the full panel state (bench, nudges, slot map)
 * is mirrored to localStorage keyed by club id, since the legacy lineup
 * column only holds 11 slots.
 */

const storageKey = (clubId: Club['id']) => `wccf-arrangement:v2:${String(clubId)}`

function loadInitial(club: Club, ownedIds: Set<string>): Arrangement {
  const known = (id: string) => ownedIds.has(id) && !!byId(id)
  try {
    const raw = window.localStorage.getItem(storageKey(club.id))
    if (raw) {
      const parsed = parseArrangement(JSON.parse(raw))
      if (parsed) return pruneUnknown(parsed, known)
    }
  } catch {
    /* fall through to club row */
  }
  return pruneUnknown(fromLineupSlots(club.formation, parseLineup(club.lineupJson)), known)
}

/** Training levels (0–5) → practice zone (0–100) on OFF/DEF/POS/WIN/SPD/POW. */
function practiceZone(club: Club): number[] {
  const t = parseTraining(club.trainingJson)
  return [t.off, t.def, t.pas, t.pos, t.spe, t.pow].map((lv) => Math.round((lv / 5) * 100))
}

export default function ArrangeSection({ club, owned }: { club: Club; owned: OwnedEntry[] }) {
  const { toast } = useToast()
  const utils = trpc.useUtils()
  const ownedIds = useMemo(() => new Set(owned.map((e) => e.cardId)), [owned])

  const [arrangement, setArrangement] = useState<Arrangement>(() => loadInitial(club, ownedIds))
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(arrangement))
  const dirty = JSON.stringify(arrangement) !== savedJson

  /* mirror the full panel state locally (bench + nudges don't fit the club row) */
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(club.id), JSON.stringify(arrangement))
    } catch {
      /* storage full/blocked — editor stays functional in-memory */
    }
  }, [club.id, arrangement])

  const formationHex = useMemo(
    () => computeFormationHex(xiEntries(arrangement, byId), arrangement.nudges),
    [arrangement],
  )
  const practiceHex = useMemo(() => practiceZone(club), [club])
  const registration = useMemo(() => validateRegistration(arrangement, byId), [arrangement])

  const update = trpc.club.update.useMutation({
    onSuccess: () => {
      setSavedJson(JSON.stringify(arrangement))
      toast(
        registration.ok
          ? 'Card panel saved to your club.'
          : 'Panel saved — card check still has errors.',
        registration.ok ? 'success' : 'info',
      )
    },
    onError: (e) => toast(e.message || 'Could not save the panel', 'danger'),
    onSettled: () => utils.club.me.invalidate(),
  })

  const save = () => {
    update.mutate({ formation: arrangement.formation, lineup: toLineupSlots(arrangement) })
  }

  return (
    <div className="grid gap-4 min-[1100px]:grid-cols-[3fr_2fr]">
      <FlatPanel arrangement={arrangement} onChange={setArrangement} owned={owned} />

      {/* team grid — live 3-zone hexagon */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col items-center rounded-panel border border-line bg-panel p-4">
          <div className="flex w-full items-baseline justify-between">
            <h3 className="font-display text-lg font-semibold uppercase tracking-[0.06em] text-wccf-dim">
              Team grid
            </h3>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-wccf-mute">
              {arrangement.formation}
            </span>
          </div>
          <div className="my-2">
            <HexagonRadar formation={formationHex} practice={practiceHex} size={280} />
          </div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-wccf-dim">
              <span className="h-1.5 w-3 rounded-full" style={{ backgroundColor: '#1E7A4C' }} />
              Formation
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-wccf-dim">
              <span className="h-1.5 w-3 rounded-full" style={{ backgroundColor: '#FFC531' }} />
              Practice
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-wccf-dim">
              <span className="h-1.5 w-3 rounded-full" style={{ backgroundColor: '#3DD68C' }} />
              Performance
            </span>
          </div>
          <p className="mt-3 text-center font-mono text-[11px] leading-relaxed text-wccf-mute">
            Move cards to move the green frame. Training grows the yellow zone toward it — the
            bright overlap is how your club actually plays.
          </p>
        </div>

        <button
          onClick={save}
          disabled={!dirty || update.isPending}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold uppercase tracking-[0.06em] transition-all',
            dirty
              ? 'bg-accent text-[#0B0E14] hover:bg-accent-hover active:scale-[0.97]'
              : 'cursor-not-allowed border border-line bg-raised text-wccf-mute',
          )}
        >
          <Save size={13} />
          {update.isPending ? 'Saving…' : dirty ? 'Save panel' : 'Saved'}
        </button>
        <p className="text-center font-mono text-[10px] leading-relaxed text-wccf-mute">
          Save keeps the formation + XI on your club across devices; bench and line nudges stay
          on this device.
        </p>
      </div>
    </div>
  )
}
