import { useState } from 'react'
import { Minus, Plus, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { trpc } from '@/providers/trpc'
import {
  TRAINING_AREAS,
  parseTraining,
  type Club,
  type TrainingLevels,
} from './clubUtils'
import TrainingRadar from './TrainingRadar'

function sameLevels(a: TrainingLevels, b: TrainingLevels): boolean {
  return TRAINING_AREAS.every((ar) => a[ar.key] === b[ar.key])
}

/**
 * Training tab — six 0–5 steppers + live hexagon radar preview.
 * Save persists via club.update { training }.
 */
export default function TrainingTab({ club }: { club: Club }) {
  const { toast } = useToast()
  const utils = trpc.useUtils()
  const [levels, setLevels] = useState<TrainingLevels>(() => parseTraining(club.trainingJson))
  const [saved, setSaved] = useState(levels)
  const dirty = !sameLevels(levels, saved)

  const update = trpc.club.update.useMutation({
    onSuccess: (data) => {
      setSaved(parseTraining(data.club.trainingJson))
      toast('Training focus saved.', 'success')
    },
    onError: (e) => toast(e.message || 'Could not save training', 'danger'),
    onSettled: () => utils.club.me.invalidate(),
  })

  const step = (key: keyof TrainingLevels, delta: number) => {
    setLevels((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.min(5, prev[key] + delta)),
    }))
  }

  return (
    <div className="grid gap-6 min-[1000px]:grid-cols-[1fr_320px]">
      {/* area panels */}
      <div className="grid gap-3 min-[640px]:grid-cols-2 min-[1200px]:grid-cols-3">
        {TRAINING_AREAS.map((area) => {
          const lv = levels[area.key]
          return (
            <div key={area.key} className="rounded-panel border border-line bg-panel p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-lg font-semibold uppercase tracking-[0.06em] text-wccf-ink">
                  {area.label}
                </h3>
                <span className="font-mono text-sm font-bold text-accent tnum">Lv. {lv}</span>
              </div>
              {/* progress segments */}
              <div className="mt-3 flex gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-colors duration-300',
                      i < lv ? 'bg-accent' : 'bg-raised',
                    )}
                  />
                ))}
              </div>
              {/* stepper */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => step(area.key, -1)}
                  disabled={lv === 0}
                  aria-label={`Lower ${area.label}`}
                  className="flex h-8 w-8 items-center justify-center rounded-btn border border-line text-wccf-dim transition-colors enabled:hover:border-line-strong enabled:hover:text-wccf-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Minus size={13} />
                </button>
                <span className="flex-1 text-center font-mono text-lg font-bold text-wccf-ink tnum">
                  {lv} <span className="text-[11px] text-wccf-mute">/ 5</span>
                </span>
                <button
                  onClick={() => step(area.key, 1)}
                  disabled={lv === 5}
                  aria-label={`Raise ${area.label}`}
                  className="flex h-8 w-8 items-center justify-center rounded-btn border border-line text-wccf-dim transition-colors enabled:hover:border-accent enabled:hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* radar + save */}
      <div className="flex flex-col items-center rounded-panel border border-line bg-panel p-4">
        <h3 className="self-start font-display text-lg font-semibold uppercase tracking-[0.06em] text-wccf-dim">
          Practice zone
        </h3>
        <div className="my-2">
          <TrainingRadar levels={levels} size={240} />
        </div>
        <p className="mb-4 text-center font-mono text-[11px] leading-relaxed text-wccf-mute">
          Training raises your practice zone on match day. Matches raise performance. Formation fit is up to you.
        </p>
        <button
          onClick={() => update.mutate({ training: levels })}
          disabled={!dirty || update.isPending}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold uppercase tracking-[0.06em] transition-all',
            dirty
              ? 'bg-accent text-[#0B0E14] hover:bg-accent-hover active:scale-[0.97]'
              : 'cursor-not-allowed border border-line bg-raised text-wccf-mute',
          )}
        >
          <Save size={13} />
          {update.isPending ? 'Saving…' : dirty ? 'Save training' : 'Saved'}
        </button>
      </div>
    </div>
  )
}
