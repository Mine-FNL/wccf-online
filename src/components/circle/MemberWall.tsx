import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const MEMBERS: { name: string; avatar: number; since: string }[] = [
  { name: 'CalcioNova', avatar: 1, since: 'S1' },
  { name: 'Riviera FC', avatar: 2, since: 'S1' },
  { name: 'Kobe Steelworks', avatar: 3, since: 'S1' },
  { name: 'Porto Azul', avatar: 4, since: 'S1' },
  { name: 'Nordkap XI', avatar: 5, since: 'S1' },
  { name: 'Estrella Roja', avatar: 6, since: 'S1' },
  { name: 'FC Halbzeit', avatar: 7, since: 'S1' },
  { name: 'Milano Notte', avatar: 8, since: 'S1' },
  { name: 'Albion Rovers', avatar: 1, since: 'S1' },
  { name: 'Santos Verde', avatar: 2, since: 'S1' },
  { name: 'Torino Grigia', avatar: 3, since: 'S1' },
  { name: 'Busan Waves', avatar: 4, since: 'S1' },
  { name: 'Real Periferia', avatar: 5, since: 'S1' },
  { name: 'FK Sloboda', avatar: 6, since: 'S1' },
  { name: 'Athletic Norte', avatar: 7, since: 'S1' },
  { name: 'Villa Cometa', avatar: 8, since: 'S1' },
  { name: 'SC Meridian', avatar: 1, since: 'S1' },
  { name: 'Olympic Kita', avatar: 2, since: 'S1' },
]

/** "IN THE CIRCLE" — member chips with gold laurel frames, stagger 30ms. */
export default function MemberWall() {
  const rootRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      gsap.from('[data-member]', {
        y: 12,
        opacity: 0,
        duration: 0.35,
        ease: 'power2.out',
        stagger: 0.03,
        scrollTrigger: { trigger: rootRef.current, start: 'top 82%' },
      })
    },
    { scope: rootRef },
  )

  return (
    <section ref={rootRef} className="mx-auto max-w-5xl px-4 py-16">
      <h2 className="text-center font-display text-[28px] font-semibold uppercase tracking-[0.06em] text-wccf-ink">
        In the Circle
      </h2>
      <p className="mt-1 text-center text-[14px] text-wccf-dim">The managers keeping the cabinets humming.</p>

      <div className="mt-8 flex flex-wrap justify-center gap-2.5">
        {MEMBERS.map((m) => (
          <div
            key={m.name}
            data-member
            className="flex items-center gap-2 rounded-full border border-line bg-panel py-1.5 pl-1.5 pr-3.5 transition-transform duration-150 hover:-rotate-1 hover:scale-[1.03]"
          >
            <img
              src={`/avatar-${m.avatar}.png`}
              alt=""
              className="h-7 w-7 rounded-full object-cover"
              style={{ boxShadow: '0 0 0 2px rgba(232,184,75,0.55)' }}
            />
            <span className="font-sans text-[12px] font-semibold text-wccf-gold">{m.name}</span>
            <span className="font-mono text-[10px] text-wccf-mute tnum">since {m.since}</span>
          </div>
        ))}
        <div
          data-member
          className="flex items-center rounded-full border border-dashed px-3.5 py-1.5 font-mono text-[11px] text-wccf-mute"
          style={{ borderColor: 'rgba(232,184,75,0.4)' }}
        >
          and 142 more
        </div>
      </div>
    </section>
  )
}
