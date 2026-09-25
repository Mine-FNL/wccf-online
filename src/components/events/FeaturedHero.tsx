import { useMemo, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Calendar, Landmark, Trophy, Users } from 'lucide-react'
import StatusPill from '@/components/StatusPill'
import CountdownFlip from './CountdownFlip'
import { fmtDay, fmtTime, nextSunday2000 } from './data'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * Featured event hero — Intercontinental Cup. Full-bleed panel pinned by
 * ScrollTrigger for ~150vh: bg scale 1.15→1, overlay 0.4→0.85, title chars
 * slide up (first 40%), countdown tiles rise/unblur (40–70%), CTAs fade up
 * (70–100%) (events.md §1). GSAP is isolated to this component tree.
 */
export default function FeaturedHero({
  onEnter,
  onBracket,
}: {
  onEnter: () => void
  onBracket: () => void
}) {
  const root = useRef<HTMLElement>(null)
  const kickoff = useMemo(() => nextSunday2000(), [])
  const title = 'INTERCONTINENTAL CUP'

  useGSAP(
    () => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: 'top 72px',
          end: '+=1200',
          scrub: 0.6,
          pin: true,
          anticipatePin: 1,
        },
        defaults: { ease: 'none' },
      })

      tl.fromTo('.hero-bg', { scale: 1.15 }, { scale: 1, duration: 1 }, 0)
      tl.fromTo('.hero-overlay', { opacity: 0.4 }, { opacity: 0.85, duration: 1 }, 0)
      tl.fromTo(
        '.hero-char',
        { yPercent: 110 },
        { yPercent: 0, stagger: 0.02, duration: 0.3, ease: 'power2.out' },
        0,
      )
      tl.fromTo(
        '.cd-tile',
        { y: 24, autoAlpha: 0, filter: 'blur(6px)' },
        { y: 0, autoAlpha: 1, filter: 'blur(0px)', stagger: 0.04, duration: 0.2, ease: 'power2.out' },
        0.4,
      )
      tl.fromTo(
        '.hero-cta',
        { y: 16, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, stagger: 0.06, duration: 0.2, ease: 'power2.out' },
        0.75,
      )
    },
    { scope: root },
  )

  const meta = [
    { icon: Calendar, text: `${fmtDay(kickoff)} · ${fmtTime(kickoff)} kickoff` },
    { icon: Landmark, text: 'Host cabinet: WCCF 2011-12 — Intercontinental Clubs' },
    { icon: Users, text: '32 seats' },
    { icon: Trophy, text: 'Prize: exclusive ATLE scout pack' },
  ]

  return (
    <section
      ref={root}
      className="relative overflow-hidden rounded-xl border border-line"
      style={{ minHeight: 520 }}
    >
      {/* background */}
      <img
        src="/event-intercontinental.png"
        alt=""
        className="hero-bg absolute inset-0 h-full w-full object-cover"
      />
      <div
        className="hero-overlay absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(11,14,20,0.55), rgba(11,14,20,0.92))',
        }}
      />

      {/* content */}
      <div className="relative flex min-h-[520px] flex-col justify-end gap-4 p-6 min-[768px]:p-10">
        <div className="absolute left-6 top-6 min-[768px]:left-10 min-[768px]:top-8">
          <StatusPill variant="playing" pulse>
            Registration open
          </StatusPill>
        </div>

        <h1
          className="max-w-[900px] font-display text-[44px] font-bold uppercase leading-[0.95] tracking-[0.04em] text-white min-[768px]:text-[64px]"
          aria-label={title}
        >
          {title.split(' ').map((word, wi) => (
            <span key={wi} className="mr-[0.28em] inline-block whitespace-nowrap">
              {word.split('').map((ch, ci) => (
                <span key={ci} className="inline-block overflow-hidden align-bottom">
                  <span className="hero-char inline-block">{ch}</span>
                </span>
              ))}
            </span>
          ))}
        </h1>
        <div className="h-1 w-20 bg-accent" />

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[13px] text-wccf-dim">
          {meta.map((m) => (
            <span key={m.text} className="flex items-center gap-1.5">
              <m.icon size={13} className="text-accent" />
              {m.text}
            </span>
          ))}
        </div>

        <CountdownFlip target={kickoff} />

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={onEnter}
            className="hero-cta rounded-btn bg-accent px-5 py-2.5 font-sans text-[13px] font-bold uppercase tracking-[0.06em] text-[#0B0E14] transition-all duration-150 hover:bg-accent-hover active:scale-[0.97]"
          >
            Enter your club
          </button>
          <button
            onClick={onBracket}
            className="hero-cta rounded-btn border border-line-strong bg-transparent px-5 py-2.5 font-sans text-[13px] font-bold uppercase tracking-[0.06em] text-wccf-ink transition-all duration-150 hover:border-accent hover:text-accent active:scale-[0.97]"
          >
            Bracket
          </button>
        </div>
      </div>
    </section>
  )
}
