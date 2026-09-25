import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import JoinCta from './JoinCta'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/** Final CTA band — emblem 64px + wordmark + gold pill, fades up on scroll. */
export default function FinalBand() {
  const rootRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      gsap.from(rootRef.current, {
        y: 28,
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out',
        scrollTrigger: { trigger: rootRef.current, start: 'top 85%' },
      })
    },
    { scope: rootRef },
  )

  return (
    <section ref={rootRef} className="mx-auto max-w-3xl px-4 pb-20 pt-8">
      <div
        className="flex flex-col items-center gap-4 rounded-panel border bg-panel px-6 py-10 text-center"
        style={{
          borderColor: 'rgba(232,184,75,0.35)',
          background: 'radial-gradient(circle at 50% 0%, rgba(232,184,75,0.08) 0%, transparent 65%), #12161F',
        }}
      >
        <img src="/circle-emblem.svg" alt="" style={{ width: 64, height: 64 }} />
        <h2 className="font-display text-[32px] font-bold uppercase leading-none tracking-[0.04em]">
          <span className="bg-gradient-to-b from-[#F5D98A] via-[#E8B84B] to-[#B8862E] bg-clip-text text-transparent">
            Champion's Circle
          </span>
        </h2>
        <p className="text-[14px] italic text-wccf-dim">"Support the arcade. Wear the gold."</p>
        <JoinCta large />
      </div>
    </section>
  )
}
