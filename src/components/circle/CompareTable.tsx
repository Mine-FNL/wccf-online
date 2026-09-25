import { useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

gsap.registerPlugin(ScrollTrigger, useGSAP)

interface Row {
  label: string
  free: ReactNode
  circle: ReactNode
}

const YES = <Check size={14} className="inline text-wccf-live" />
const NO = <Minus size={14} className="inline text-wccf-mute" />

const ROWS: Row[] = [
  { label: 'Lobby seats', free: YES, circle: <span className="text-wccf-gold">{YES} + priority</span> },
  { label: 'Reward cards', free: YES, circle: YES },
  { label: 'Scout odds', free: <span className="text-wccf-mute">base</span>, circle: <span className="font-bold text-wccf-gold">+2% kira</span> },
  { label: 'Nameplate', free: <span className="text-wccf-mute">white</span>, circle: <span className="font-bold text-wccf-gold">gold</span> },
  { label: 'Crest frame', free: NO, circle: YES },
  { label: 'Supporter badge in chat', free: NO, circle: YES },
]

/** Dense Free vs Circle comparison table — rows stagger in 40ms. */
export default function CompareTable() {
  const rootRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      gsap.from('[data-row]', {
        y: 10,
        opacity: 0,
        duration: 0.35,
        ease: 'power2.out',
        stagger: 0.04,
        scrollTrigger: { trigger: rootRef.current, start: 'top 82%' },
      })
    },
    { scope: rootRef },
  )

  return (
    <section ref={rootRef} className="mx-auto max-w-3xl px-4 py-16">
      <h2 className="text-center font-display text-[28px] font-semibold uppercase tracking-[0.06em] text-wccf-ink">
        Free vs Circle
      </h2>

      <div className="mt-8 overflow-hidden rounded-panel border border-line bg-panel">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-wccf-mute">
                Perk
              </th>
              <th className="w-28 px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-wccf-mute min-[560px]:w-40">
                Free
              </th>
              <th className="w-32 bg-[rgba(232,184,75,0.1)] px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-wccf-gold min-[560px]:w-44">
                Circle
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr
                key={r.label}
                data-row
                className={cn('border-b border-line/60 transition-colors last:border-b-0 hover:bg-raised/50')}
              >
                <td className="px-4 py-2.5 font-sans font-semibold text-wccf-ink">{r.label}</td>
                <td className="px-4 py-2.5 text-wccf-dim">{r.free}</td>
                <td className="bg-[rgba(232,184,75,0.06)] px-4 py-2.5 text-wccf-ink">{r.circle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
