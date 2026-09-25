/**
 * FormationRadar — the left-panel DATA view (spec §2): a mini pitch with
 * player dots at their formation anchors (FW red / MF orange / DF green /
 * GK blue, opponent grey), per-player stamina bars and the sub area.
 */
import { cn } from '@/lib/utils'
import { formationSlots } from '@/lib/arrangement'
import { posGroup } from '@/components/match/helpers'
import type { EnginePlayer2, PlayerLive2 } from '@/lib/engine2'

/** position-band dot colors (spec §2) */
export const BAND_COLORS = {
  GK: '#4DD0E1', // blue
  DEF: '#3DD68C', // green
  MID: '#FF8A1E', // orange
  FWD: '#FF4D4F', // red
} as const

const OPP_GREY = '#8A94A7'

/** mirrored 4-4-2 anchors for the (formationless) opponent */
const AWAY_442: [number, number][] = [
  [0.94, 0.5],
  [0.78, 0.16], [0.8, 0.39], [0.8, 0.61], [0.78, 0.84],
  [0.54, 0.14], [0.57, 0.4], [0.57, 0.6], [0.54, 0.86],
  [0.32, 0.36], [0.32, 0.64],
]

const staminaColor = (s: number) =>
  s > 55 ? '#3DD68C' : s > 28 ? '#FFC531' : '#FF4D4F'

export default function FormationRadar({
  formation,
  homeXI,
  awayXI,
  bench,
  hotline,
}: {
  formation: string
  homeXI: PlayerLive2[]
  awayXI: PlayerLive2[]
  /** remaining bench cards (sub area) */
  bench: EnginePlayer2[]
  /** live hotline links (Footista) — ringed dots */
  hotline: number[] | null
}) {
  const anchors = formationSlots(formation)
  return (
    <div className="flex flex-col gap-2">
      {/* mini pitch */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[6px] border border-line bg-inset">
        {/* markings */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
        <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line" />
        <div className="absolute inset-y-[22%] left-0 w-[14%] border border-l-0 border-line" />
        <div className="absolute inset-y-[22%] right-0 w-[14%] border border-r-0 border-line" />
        {homeXI.map((p, i) => {
          const a = anchors[i] ?? { x: 0.5, y: 0.5 }
          const color = BAND_COLORS[posGroup(p.position)]
          return (
            <span
              key={`h${i}`}
              title={`${p.number} ${p.name}`}
              className={cn(
                'absolute h-[9px] w-[9px] rounded-full',
                hotline?.includes(i) && 'ring-2 ring-wccf-caution',
              )}
              style={{
                left: `${a.x * 100}%`,
                top: `${a.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: p.sentOff ? '#5C6678' : color,
                boxShadow: `0 0 5px ${color}88`,
                opacity: p.subbedOff ? 0.35 : 1,
              }}
            />
          )
        })}
        {awayXI.map((p, i) => {
          const [x, y] = AWAY_442[i] ?? [0.8, 0.5]
          return (
            <span
              key={`a${i}`}
              className="absolute h-[7px] w-[7px] rounded-full"
              style={{
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: OPP_GREY,
                opacity: 0.75,
              }}
            />
          )
        })}
      </div>

      {/* legend */}
      <div className="flex items-center justify-center gap-2.5 font-mono text-[8px] uppercase tracking-[0.1em] text-wccf-mute">
        <span className="flex items-center gap-1"><i className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: BAND_COLORS.FWD }} />FW</span>
        <span className="flex items-center gap-1"><i className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: BAND_COLORS.MID }} />MF</span>
        <span className="flex items-center gap-1"><i className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: BAND_COLORS.DEF }} />DF</span>
        <span className="flex items-center gap-1"><i className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: BAND_COLORS.GK }} />GK</span>
        <span className="flex items-center gap-1"><i className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: OPP_GREY }} />OPP</span>
      </div>

      {/* stamina bars */}
      <div className="flex flex-col gap-[3px]">
        {homeXI.map((p, i) => (
          <div key={`st${i}`} className="flex items-center gap-1.5">
            <span className="w-4 shrink-0 text-right font-mono text-[8.5px] text-wccf-mute tnum">
              {p.number}
            </span>
            <span
              className={cn(
                'w-24 shrink-0 truncate text-[9.5px]',
                p.subbedOff ? 'text-wccf-mute line-through' : 'text-wccf-dim',
              )}
            >
              {p.name}
            </span>
            <div className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-inset">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${p.stamina}%`, backgroundColor: staminaColor(p.stamina) }}
              />
            </div>
            {p.card && (
              <span
                className={cn(
                  'h-2 w-[5px] shrink-0 rounded-[1px]',
                  p.card === 'red' ? 'bg-wccf-danger' : 'bg-wccf-caution',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* sub area */}
      <div className="rounded-[6px] border border-line bg-panel p-1.5">
        <span className="font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-wccf-mute">
          Sub area
        </span>
        <div className="mt-1 flex flex-col gap-[2px]">
          {bench.length === 0 && (
            <span className="font-mono text-[9px] text-wccf-mute">— bench empty —</span>
          )}
          {bench.map((b) => (
            <span key={b.id ?? b.name} className="truncate font-mono text-[9px] text-wccf-dim">
              <span className="text-wccf-mute">{b.number}</span> {b.name}
              <span className="text-wccf-mute"> · {b.position}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
