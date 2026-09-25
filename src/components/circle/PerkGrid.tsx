import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Crown, Frame, Sparkles, Zap } from 'lucide-react'
import JoinCta from './JoinCta'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * 2×2 perk grid with looped mini-previews — staggered so only one loops at
 * a time (3s loops, 0.75s offsets). Gold hairline borders per design.
 */
export default function PerkGrid() {
  const rootRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      gsap.from('[data-perk]', {
        y: 20,
        opacity: 0,
        duration: 0.5,
        ease: 'power2.out',
        stagger: 0.1,
        scrollTrigger: { trigger: rootRef.current, start: 'top 80%' },
      })
    },
    { scope: rootRef },
  )

  return (
    <section ref={rootRef} id="perks" className="mx-auto max-w-5xl px-4 py-16">
      <style>{`
        @keyframes circle-shimmer {
          0%, 22% { background-position: -150% 0; }
          55%, 100% { background-position: 150% 0; }
        }
        @keyframes circle-glint {
          0%, 18% { box-shadow: 0 0 0 2px rgba(232,184,75,0.9), 0 0 22px rgba(232,184,75,0.4); }
          55%, 100% { box-shadow: 0 0 0 2px rgba(232,184,75,0.35), 0 0 0 rgba(232,184,75,0); }
        }
        @keyframes circle-delta {
          0%, 20% { transform: scaleX(0); opacity: 0.4; }
          45% { transform: scaleX(1); opacity: 1; }
          80%, 100% { transform: scaleX(1); opacity: 0.55; }
        }
      `}</style>

      <h2 className="text-center font-display text-[28px] font-semibold uppercase tracking-[0.06em] text-wccf-ink">
        What the gold gets you
      </h2>
      <p className="mt-1 text-center text-[14px] text-wccf-dim">
        Cosmetic, ceremonial, and one tiny luck charm. Never pay-to-win.
      </p>

      <div className="mt-8 grid gap-4 min-[900px]:grid-cols-2">
        {/* 1 — Gold nameplate */}
        <div
          data-perk
          className="rounded-panel border bg-panel p-5"
          style={{ borderColor: 'rgba(232,184,75,0.35)' }}
        >
          <Crown size={20} className="text-wccf-gold" />
          <h3 className="mt-2 font-display text-[22px] font-semibold uppercase tracking-[0.04em] text-wccf-ink">
            Gold nameplate
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-wccf-dim">
            Your club name renders in gold across lobby seats, chat, and the Hall of Fame.
          </p>
          <div className="mt-4 rounded-card border border-line bg-raised/60 px-3 py-2">
            <span
              className="font-display text-lg font-bold uppercase tracking-[0.05em]"
              style={{
                backgroundImage:
                  'linear-gradient(110deg, #E8B84B 30%, #FFF3D0 50%, #E8B84B 70%)',
                backgroundSize: '250% 100%',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                animation: 'circle-shimmer 3s linear infinite',
              }}
            >
              CalcioNova
            </span>
          </div>
        </div>

        {/* 2 — Circle crest frame */}
        <div
          data-perk
          className="rounded-panel border bg-panel p-5"
          style={{ borderColor: 'rgba(232,184,75,0.35)' }}
        >
          <Frame size={20} className="text-wccf-gold" />
          <h3 className="mt-2 font-display text-[22px] font-semibold uppercase tracking-[0.04em] text-wccf-ink">
            Circle crest frame
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-wccf-dim">
            A gold laurel frame around your avatar &amp; club crest, everywhere they appear.
          </p>
          <div className="mt-4 flex items-center gap-3 rounded-card border border-line bg-raised/60 px-3 py-2">
            <img
              src="/avatar-3.png"
              alt=""
              className="h-9 w-9 rounded-full object-cover"
              style={{ animation: 'circle-glint 3s linear infinite', animationDelay: '0.75s' }}
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-wccf-mute">
              laurel frame · glints on the hour
            </span>
          </div>
        </div>

        {/* 3 — Priority seats */}
        <div
          data-perk
          className="rounded-panel border bg-panel p-5"
          style={{ borderColor: 'rgba(232,184,75,0.35)' }}
        >
          <Zap size={20} className="text-wccf-gold" />
          <h3 className="mt-2 font-display text-[22px] font-semibold uppercase tracking-[0.04em] text-wccf-ink">
            Priority seats
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-wccf-dim">
            Jump to the front of any cabinet queue once per day.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-card border border-line bg-raised/60 px-3 py-2">
            <span className="rounded bg-[rgba(232,184,75,0.14)] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-wccf-gold">
              1×/day
            </span>
            <span className="font-mono text-[11px] text-wccf-mute">
              queue pos <span className="text-wccf-dim line-through">#6</span>{' '}
              <span className="font-bold text-wccf-gold">#1</span>
            </span>
          </div>
        </div>

        {/* 4 — Kira luck charm */}
        <div
          data-perk
          className="rounded-panel border bg-panel p-5"
          style={{ borderColor: 'rgba(232,184,75,0.35)' }}
        >
          <Sparkles size={20} className="text-wccf-gold" />
          <h3 className="mt-2 font-display text-[22px] font-semibold uppercase tracking-[0.04em] text-wccf-ink">
            Kira luck charm
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-wccf-dim">
            +2% kira odds on every scout tier. Small, honest, golden.
          </p>
          <div className="mt-4 rounded-card border border-line bg-raised/60 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="w-10 font-mono text-[10px] uppercase text-wccf-mute">RAR</span>
              <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                <div className="h-full rounded-l-full bg-[#7A5CFF]" style={{ width: '38%' }} />
                <div
                  className="h-full origin-left rounded-r-full bg-wccf-gold"
                  style={{ width: '7%', animation: 'circle-delta 3s ease-out infinite', animationDelay: '2.25s' }}
                />
              </div>
              <span className="font-mono text-[10px] font-bold tnum text-wccf-gold">+2%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <JoinCta />
      </div>
    </section>
  )
}
