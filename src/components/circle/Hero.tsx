import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import JoinCta from './JoinCta'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const TITLE = "CHAMPION'S CIRCLE"

/**
 * Gold-on-black ceremonial hero — emblem rotates in with a ring ripple,
 * title characters stagger up; pinned 120vh scroll moment with emblem
 * parallax-rise and intensifying glow (champions-circle.md §1).
 */
export default function CircleHero() {
  const rootRef = useRef<HTMLElement>(null)
  const emblemRef = useRef<HTMLImageElement>(null)
  const ringRef = useRef<HTMLSpanElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const charsRef = useRef<HTMLSpanElement>(null)
  const subRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      /* entry choreography */
      const chars = charsRef.current?.querySelectorAll('[data-char]') ?? []
      const tl = gsap.timeline()
      tl.fromTo(
        emblemRef.current,
        { rotation: -12, scale: 0.8, opacity: 0 },
        { rotation: 0, scale: 1, opacity: 1, duration: 0.9, ease: 'power2.out' },
        0,
      )
        .fromTo(
          ringRef.current,
          { scale: 0.55, opacity: 0.9 },
          { scale: 2.3, opacity: 0, duration: 1.3, ease: 'power2.out' },
          0.15,
        )
        .fromTo(
          chars,
          { yPercent: 110, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.028 },
          0.35,
        )
        .fromTo(
          subRef.current?.children ?? [],
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.09 },
          0.8,
        )

      /* pinned scroll moment: emblem parallax-rises, glow intensifies */
      gsap.to(emblemRef.current, {
        y: -60,
        ease: 'none',
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top top',
          end: '+=120%',
          scrub: true,
          pin: true,
          anticipatePin: 1,
        },
      })
      gsap.to(glowRef.current, {
        opacity: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top top',
          end: '+=120%',
          scrub: true,
        },
      })
    },
    { scope: rootRef },
  )

  const scrollToPerks = () => {
    document.getElementById('perks')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section ref={rootRef} className="relative flex min-h-[80dvh] items-center justify-center overflow-hidden">
      {/* radial gold glow over bg-base */}
      <div
        ref={glowRef}
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.55,
          background: 'radial-gradient(circle at 50% 42%, rgba(232,184,75,0.10) 0%, transparent 60%)',
        }}
      />
      {/* faint emblem watermark */}
      <img
        src="/circle-emblem.svg"
        alt=""
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.05]"
        style={{ width: 800, height: 800 }}
      />

      <div className="relative flex flex-col items-center px-4 text-center">
        <div className="relative">
          <span
            ref={ringRef}
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-wccf-gold opacity-0"
            style={{ width: 190, height: 190 }}
          />
          <img ref={emblemRef} src="/circle-emblem.svg" alt="Champion's Circle crest" style={{ width: 160, height: 160 }} />
        </div>

        <h1 className="mt-6 font-display text-[42px] font-bold uppercase leading-[0.95] tracking-[0.04em] min-[640px]:text-[56px]">
          <span ref={charsRef} className="inline-block" aria-label={TITLE}>
            {TITLE.split('').map((ch, i) => (
              <span key={i} data-char className="inline-block overflow-hidden align-bottom" aria-hidden>
                <span
                  className="inline-block bg-gradient-to-b from-[#F5D98A] via-[#E8B84B] to-[#B8862E] bg-clip-text text-transparent"
                  style={{ paddingBottom: '0.08em' }}
                >
                  {ch === ' ' ? ' ' : ch}
                </span>
              </span>
            ))}
          </span>
        </h1>

        <div ref={subRef} className="flex flex-col items-center">
          <p className="mt-3 text-[15px] italic text-wccf-dim">"Support the arcade. Wear the gold."</p>
          <p className="mt-2 font-mono text-xl font-bold tnum text-wccf-gold">$5 / month — cancel anytime</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <JoinCta large />
            <button
              onClick={scrollToPerks}
              className="font-sans text-[13px] font-semibold uppercase tracking-[0.06em] text-wccf-dim transition-colors hover:text-wccf-gold"
            >
              See perks ↓
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
