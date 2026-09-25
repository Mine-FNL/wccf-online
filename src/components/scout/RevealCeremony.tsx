import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Loader2, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import PlayerCard from '@/components/PlayerCard'
import type { PlayerCardData, Rarity } from '@/lib/data/types'
import { FOIL_RARITIES, HIGH_RARITIES, RARITY_COLOR, RARITY_SHORT, type ScoutTier } from './odds'

gsap.registerPlugin(useGSAP)

export interface CeremonyData {
  tier: ScoutTier
  cards: PlayerCardData[]
  creditsBefore: number | null
  cost: number
}

interface RevealCeremonyProps {
  data: CeremonyData
  /** a "scout again" pull is currently in flight */
  pendingAgain: boolean
  onScoutAgain: () => void
  onClose: () => void
}

const FAN_ROTATION = [-6, -3, 0, 3, 6]

/** Cabinet card-slot graphic that slides up in the slot phase. */
function CabinetSlot({ tier, slotRef }: { tier: ScoutTier; slotRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={slotRef} className="pointer-events-none mx-auto mt-6 w-64 opacity-0">
      <div className="rounded-panel border border-line-strong bg-panel px-4 pb-3 pt-4 shadow-modal">
        <div
          className={cn(
            'h-2.5 rounded-full border',
            tier === 'elite'
              ? 'border-[#7A5CFF88] bg-[#080A0F] shadow-[0_0_14px_rgba(122,92,255,0.45)]'
              : 'border-line-strong bg-[#080A0F] shadow-[0_0_14px_rgba(255,138,30,0.35)]',
          )}
        />
        <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-wccf-mute">
          <span>Card slot</span>
          <span className={tier === 'elite' ? 'text-[#B7A5FF]' : 'text-accent'}>
            {tier === 'elite' ? 'Elite Scout' : 'Pro Scout'}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Face-down card back — bg-raised with a version stripe. */
function CardBack({ tier, w, h }: { tier: ScoutTier; w: number; h: number }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-card border border-line-strong bg-raised"
      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
    >
      <div
        className={cn(
          'h-2 w-full',
          tier === 'elite'
            ? 'bg-gradient-to-r from-[#7A5CFF] via-[#4DD0E1] to-[#E8B84B]'
            : 'bg-accent',
        )}
      />
      <div className="flex h-[calc(100%-8px)] flex-col items-center justify-center gap-2">
        <img src="/logo-badge.svg" alt="" style={{ width: w * 0.28, height: w * 0.28 }} className="rounded-lg opacity-90" />
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.3em] text-wccf-mute">WCCF</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-wccf-mute/70">
          {tier === 'elite' ? 'Elite pack' : 'Pro pack'} · {h > 0 ? '5 cards' : ''}
        </span>
      </div>
    </div>
  )
}

/** Gold/confetti particle burst (12 particles, 800ms). */
function burstParticles(container: HTMLElement | null, color: string) {
  if (!container) return
  const parts = container.querySelectorAll<HTMLElement>('[data-particle]')
  parts.forEach((p) => {
    const angle = Math.random() * Math.PI * 2
    const dist = 60 + Math.random() * 50
    gsap.fromTo(
      p,
      { x: 0, y: 0, opacity: 1, scale: 0.8 + Math.random() * 0.6, backgroundColor: color },
      {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        opacity: 0,
        scale: 0.2,
        duration: 0.8,
        ease: 'power2.out',
      },
    )
  })
}

/**
 * Full-screen pack-opening ceremony — GSAP slot → eject → flip choreography
 * (scouting.md §3). Isolated GSAP tree; no Framer Motion inside.
 */
export default function RevealCeremony({ data, pendingAgain, onScoutAgain, onClose }: RevealCeremonyProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const creditsRef = useRef<HTMLSpanElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const wrapperRefs = useRef<(HTMLDivElement | null)[]>([])
  const flipRefs = useRef<(HTMLDivElement | null)[]>([])
  const fxRefs = useRef<(HTMLDivElement | null)[]>([])
  const badgeRefs = useRef<(HTMLDivElement | null)[]>([])
  const tlRef = useRef<gsap.core.Timeline | null>(null)

  const [phase, setPhase] = useState<'intro' | 'flip' | 'summary'>('intro')
  const [flipped, setFlipped] = useState<boolean[]>(() => data.cards.map(() => false))

  const n = data.cards.length
  const fanRot = (i: number) => FAN_ROTATION[n === 5 ? i : Math.round((i / Math.max(1, n - 1)) * 4)] ?? 0

  /* lock body scroll while the ceremony is up */
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  /* ---- main timeline: slot (0–0.9s) → eject (0.9s+, stagger 250ms) ---- */
  useGSAP(
    () => {
      const tl = gsap.timeline()
      tlRef.current = tl

      tl.fromTo(
        slotRef.current,
        { yPercent: 140, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.7, ease: 'power2.out' },
        0,
      )

      /* credits count-down (600ms) */
      if (data.creditsBefore !== null && creditsRef.current) {
        const counter = { v: data.creditsBefore }
        tl.to(
          counter,
          {
            v: data.creditsBefore - data.cost,
            duration: 0.6,
            ease: 'power1.inOut',
            onUpdate: () => {
              if (creditsRef.current) {
                creditsRef.current.textContent = Math.round(counter.v).toLocaleString()
              }
            },
          },
          0.2,
        )
      }

      /* cards rise from the slot and fan into a row */
      wrapperRefs.current.slice(0, n).forEach((el, i) => {
        if (!el) return
        gsap.set(flipRefs.current[i], { rotationY: 180 })
        tl.fromTo(
          el,
          { yPercent: 110, rotation: 8, opacity: 0 },
          { yPercent: 0, rotation: fanRot(i), opacity: 1, duration: 0.5, ease: 'power2.out' },
          0.9 + i * 0.25,
        )
      })

      tl.call(() => setPhase('flip'))
      return () => tl.kill()
    },
    { scope: rootRef },
  )

  /* ---- rarity-tiered flip effects ---- */
  const runRarityFx = (i: number, rarity: Rarity) => {
    const fx = fxRefs.current[i]
    if (!fx) return
    const shine = fx.querySelector<HTMLElement>('[data-shine]')
    const flash = fx.querySelector<HTMLElement>('[data-flash]')

    if (rarity === 'SPE' && flash) {
      gsap.fromTo(flash, { opacity: 0.9 }, { opacity: 0, duration: 0.5, ease: 'power1.out' })
    }

    if (FOIL_RARITIES.includes(rarity) || rarity === 'ATLE') {
      /* kira shine sweep (900ms) + viewport radial glow pulse */
      if (shine) {
        gsap.fromTo(shine, { opacity: 0.95 }, { opacity: 0, duration: 0.9, ease: 'power1.out' })
      }
      if (glowRef.current) {
        gsap
          .timeline()
          .to(glowRef.current, { opacity: 0.6, duration: 0.25, ease: 'power1.in' })
          .to(glowRef.current, { opacity: 0, duration: 0.65, ease: 'power2.out' })
      }
    }

    if (HIGH_RARITIES.includes(rarity)) {
      const badge = badgeRefs.current[i]
      if (badge) {
        gsap.fromTo(
          badge,
          { scale: 2, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2.5)' },
        )
      }
      burstParticles(fx, RARITY_COLOR[rarity])
    }
  }

  const flipCard = (i: number) => {
    if (phase !== 'flip' || flipped[i] || !flipRefs.current[i]) return
    setFlipped((f) => {
      const next = [...f]
      next[i] = true
      return next
    })
    gsap.to(flipRefs.current[i], { rotationY: 360, duration: 0.6, ease: 'power2.inOut' })
    runRarityFx(i, data.cards[i].rarity)
  }

  const revealAll = () => {
    if (phase !== 'flip') return
    data.cards.forEach((c, i) => {
      if (flipped[i]) return
      gsap.delayedCall(i * 0.18, () => {
        if (!rootRef.current || !flipRefs.current[i]) return
        setFlipped((f) => {
          if (f[i]) return f
          const next = [...f]
          next[i] = true
          return next
        })
        gsap.to(flipRefs.current[i], { rotationY: 360, duration: 0.6, ease: 'power2.inOut' })
        runRarityFx(i, c.rarity)
      })
    })
  }

  /* ---- skip straight to results ---- */
  const skip = () => {
    tlRef.current?.kill()
    gsap.set(slotRef.current, { opacity: 1, yPercent: 0 })
    if (creditsRef.current && data.creditsBefore !== null) {
      creditsRef.current.textContent = (data.creditsBefore - data.cost).toLocaleString()
    }
    wrapperRefs.current.slice(0, n).forEach((el, i) => {
      if (el) gsap.set(el, { opacity: 1, yPercent: 0, rotation: fanRot(i) })
    })
    flipRefs.current.slice(0, n).forEach((el) => el && gsap.set(el, { rotationY: 360 }))
    setFlipped(data.cards.map(() => true))
    setPhase('flip')
  }

  /* ---- all flipped → minimize into the summary strip ---- */
  const allFlipped = flipped.every(Boolean)
  useEffect(() => {
    if (!allFlipped || phase !== 'flip') return
    const t = window.setTimeout(() => {
      setPhase('summary')
      gsap.to(rowRef.current, { opacity: 0, y: -24, scale: 0.9, duration: 0.4, ease: 'power2.in' })
      gsap.fromTo(
        summaryRef.current,
        { y: 16, opacity: 0, display: 'flex' },
        { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out', delay: 0.2 },
      )
    }, 650)
    return () => window.clearTimeout(t)
  }, [allFlipped, phase])

  /* rarity totals for the summary strip */
  const totals = data.cards.reduce<Partial<Record<Rarity, number>>>((acc, c) => {
    acc[c.rarity] = (acc[c.rarity] ?? 0) + 1
    return acc
  }, {})

  return createPortal(
    <div
      ref={rootRef}
      className="fixed inset-0 z-[95] flex flex-col overflow-y-auto"
      style={{ backgroundColor: 'rgba(4,6,10,0.92)', backdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Scout pack reveal"
    >
      {/* viewport radial glow pulse */}
      <div
        ref={glowRef}
        className="pointer-events-none fixed inset-0 opacity-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(232,184,75,0.28) 0%, rgba(122,92,255,0.12) 45%, transparent 70%)',
        }}
      />

      {/* header: credits count-down + skip/close */}
      <div className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-5">
        {data.creditsBefore !== null ? (
          <div className="font-mono text-[12px] uppercase tracking-[0.12em] text-wccf-mute">
            Credits{' '}
            <span ref={creditsRef} className="tnum text-[15px] font-bold text-wccf-gold">
              {data.creditsBefore.toLocaleString()}
            </span>
          </div>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          {phase !== 'summary' && (
            <button
              onClick={skip}
              className="font-mono text-[11px] text-wccf-mute transition-colors hover:text-wccf-ink"
            >
              skip animation ▸
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close reveal"
            className="rounded-btn border border-line p-1.5 text-wccf-dim transition-colors hover:border-line-strong hover:text-wccf-ink"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* stage */}
      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 pb-10 pt-6">
        {phase === 'intro' && (
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-wccf-mute">
            The cabinet is dealing…
          </p>
        )}
        {phase === 'flip' && (
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-wccf-dim">
            Tap a card to reveal — or{' '}
            <button onClick={revealAll} className="text-accent underline underline-offset-2 hover:text-accent-hover">
              reveal all
            </button>
          </p>
        )}

        {/* card row */}
        <div ref={rowRef} className="scale-[0.52] min-[560px]:scale-[0.68] min-[760px]:scale-[0.85] min-[1100px]:scale-100">
          <div className="flex items-center justify-center gap-4">
            {data.cards.map((card, i) => (
              <div
                key={`${card.id}-${i}`}
                ref={(el) => {
                  wrapperRefs.current[i] = el
                }}
                className="relative opacity-0"
                style={{ width: 200, height: 280, perspective: 900 }}
              >
                {/* click target */}
                <div
                  ref={(el) => {
                    flipRefs.current[i] = el
                  }}
                  className="relative h-full w-full cursor-pointer"
                  style={{ transformStyle: 'preserve-3d' }}
                  onClick={() => flipCard(i)}
                >
                  {/* front face = real PlayerCard (non-flippable; GSAP owns the flip) */}
                  <div
                    className="absolute inset-0"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <PlayerCard card={card} size="md" flippable={false} />
                  </div>
                  <CardBack tier={data.tier} w={200} h={280} />
                </div>

                {/* fx layer (shine sweep / edge flash / particles) */}
                <div
                  ref={(el) => {
                    fxRefs.current[i] = el
                  }}
                  className="pointer-events-none absolute inset-0 overflow-visible"
                >
                  <div data-shine className="absolute inset-0 rounded-card kira-shine opacity-0" />
                  <div
                    data-flash
                    className="absolute inset-0 rounded-card opacity-0"
                    style={{ boxShadow: 'inset 0 0 0 3px rgba(200,205,214,0.95), 0 0 24px rgba(200,205,214,0.5)' }}
                  />
                  {Array.from({ length: 12 }, (_, p) => (
                    <span
                      key={p}
                      data-particle
                      className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full opacity-0"
                      style={{ marginLeft: -3, marginTop: -3 }}
                    />
                  ))}
                </div>

                {/* rarity badge slam */}
                <div
                  ref={(el) => {
                    badgeRefs.current[i] = el
                  }}
                  className="pointer-events-none absolute -top-3 left-1/2 z-10 -translate-x-1/2 opacity-0"
                >
                  <span
                    className="rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em]"
                    style={{
                      color: RARITY_COLOR[card.rarity],
                      borderColor: `${RARITY_COLOR[card.rarity]}88`,
                      backgroundColor: 'rgba(8,10,15,0.9)',
                      boxShadow: `0 0 18px ${RARITY_COLOR[card.rarity]}55`,
                    }}
                  >
                    {card.rarity} · {RARITY_SHORT[card.rarity]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <CabinetSlot tier={data.tier} slotRef={slotRef} />

        {/* summary strip */}
        <div
          ref={summaryRef}
          className="mt-6 hidden w-full max-w-3xl flex-col items-center gap-4 rounded-panel border border-line bg-panel p-5 opacity-0"
        >
          <div className="flex items-center gap-2 font-display text-xl font-semibold uppercase tracking-[0.05em] text-wccf-ink">
            <Sparkles size={16} className="text-accent" />
            {n} cards added to your collection
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {(Object.entries(totals) as [Rarity, number][]).map(([r, count]) => (
              <span
                key={r}
                className="rounded-full border px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em]"
                style={{ color: RARITY_COLOR[r], borderColor: `${RARITY_COLOR[r]}66` }}
              >
                ×{count} {RARITY_SHORT[r]}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {data.cards.map((c, i) => (
              <PlayerCard key={`${c.id}-sum-${i}`} card={c} size="xs" flippable={false} />
            ))}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={onScoutAgain}
              disabled={pendingAgain}
              className="flex items-center gap-2 rounded-btn bg-accent px-5 py-2.5 font-sans text-[13px] font-bold uppercase tracking-[0.04em] text-[#0B0E14] transition-all duration-150 hover:bg-accent-hover active:scale-[0.97] disabled:opacity-60"
            >
              {pendingAgain && <Loader2 size={14} className="animate-spin" />}
              Scout again
            </button>
            <Link
              to="/club"
              className="rounded-btn border border-line px-5 py-2.5 font-sans text-[13px] font-bold uppercase tracking-[0.04em] text-wccf-dim transition-colors hover:border-line-strong hover:text-wccf-ink"
            >
              Go to My Club
            </Link>
          </div>
        </div>
      </div>

      {/* pending overlay for "scout again" */}
      {pendingAgain && (
        <div className="fixed inset-0 z-10 flex items-center justify-center" style={{ backgroundColor: 'rgba(4,6,10,0.6)' }}>
          <div className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.16em] text-wccf-dim">
            <Loader2 size={15} className="animate-spin text-accent" /> Contacting the cabinet…
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
