/**
 * Post-match screen — result summary plus the reward-card ceremony:
 * the card slides up out of the cabinet slot and flips over (GSAP timeline,
 * foil shine sweep for kira-and-above rarities) revealing PlayerCard lg.
 * Gold "NEW ONLINE RECORD" banners for any broken records.
 */
import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, RotateCcw, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import PlayerCard from '@/components/PlayerCard'
import { byId, RARITY_META } from '@/lib/data/cards'
import type { PlayerCardData } from '@/lib/data/types'

gsap.registerPlugin(useGSAP)

/* ------------------------------------------------------------------ */
/* Types (subset of the match.report response the screen needs)        */
/* ------------------------------------------------------------------ */

export interface MatchResultSummary {
  scoreFor: number
  scoreAgainst: number
  opponentName: string
}

export interface ReportSuccess {
  club: { credits: number; rating: number }
  rewardCardId: string
  recordsBroken: {
    id: number
    category: string
    value: number
    detail: string
    holderClubName: string
  }[]
}

export type ReportState =
  | { status: 'pending' }
  | { status: 'success'; data: ReportSuccess }
  | { status: 'error' }

const RECORD_LABELS: Record<string, string> = {
  TOP_RATING: 'TOP RATING',
  MOST_GOALS_MATCH: 'MOST GOALS IN A MATCH',
  BIGGEST_WIN: 'BIGGEST WIN',
  LONGEST_UNBEATEN: 'LONGEST UNBEATEN RUN',
}

/* ------------------------------------------------------------------ */
/* GSAP card-eject ceremony                                            */
/* ------------------------------------------------------------------ */

function CardReveal({ card }: { card: PlayerCardData }) {
  const scope = useRef<HTMLDivElement>(null)
  const foil = RARITY_META[card.rarity].foil

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })
      tl.fromTo(
        '[data-rise]',
        { yPercent: 112, rotate: 6 },
        { yPercent: 0, rotate: 0, duration: 0.7 },
      ).fromTo(
        '[data-flip]',
        { rotationY: 0 },
        { rotationY: 180, duration: 0.6, ease: 'power2.inOut' },
        '+=0.3',
      )
      if (foil) {
        tl.fromTo(
          '[data-shine]',
          { xPercent: -170, skewX: -18 },
          { xPercent: 170, skewX: -18, duration: 0.9, ease: 'power1.inOut' },
          '-=0.25',
        )
      }
    },
    { scope },
  )

  return (
    <div ref={scope} className="flex flex-col items-center">
      {/* eject-slot mask */}
      <div className="relative h-[392px] w-[280px] overflow-hidden rounded-t-card max-sm:scale-[0.82] max-sm:origin-bottom">
        <div data-rise className="h-full w-full" style={{ perspective: 900 }}>
          <div
            data-flip
            className="relative h-full w-full"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* generic card back (shown first) */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-card border border-line-strong bg-panel"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="absolute inset-0 opacity-[0.07]"
                style={{ backgroundImage: 'url(/kira-foil.png)', backgroundSize: 'cover' }} />
              <img src="/logo-badge.svg" alt="" className="h-16 w-16 rounded-[14px]" />
              <div className="font-display text-2xl font-bold uppercase tracking-[0.08em] text-wccf-ink">
                WCCF <span className="text-accent">Online</span>
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-wccf-mute">
                Player card
              </div>
            </div>
            {/* the revealed card */}
            <div
              className="absolute inset-0"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <PlayerCard card={card} size="lg" flippable={false} />
              {foil && (
                <div
                  data-shine
                  className="pointer-events-none absolute inset-y-0 left-0 w-[45%] bg-gradient-to-r from-transparent via-white/35 to-transparent mix-blend-screen"
                />
              )}
            </div>
          </div>
        </div>
      </div>
      {/* cabinet eject slot */}
      <div className="h-[10px] w-[320px] rounded-b-[6px] border border-line bg-inset shadow-[inset_0_3px_6px_rgba(0,0,0,0.7)] max-sm:scale-[0.82] max-sm:origin-top" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Reward reveal screen                                                */
/* ------------------------------------------------------------------ */

export default function RewardReveal({
  result,
  prev,
  report,
  onClose,
  onPlayAgain,
}: {
  result: MatchResultSummary
  /** club credits/rating captured before the match */
  prev: { credits: number; rating: number } | null
  report: ReportState
  onClose: () => void
  onPlayAgain: () => void
}) {
  const { scoreFor, scoreAgainst } = result
  const outcome = scoreFor > scoreAgainst ? 'W' : scoreFor < scoreAgainst ? 'L' : 'D'
  const outcomeLabel = outcome === 'W' ? 'Victory' : outcome === 'L' ? 'Defeat' : 'Draw'
  const outcomeColor =
    outcome === 'W' ? 'text-wccf-live' : outcome === 'L' ? 'text-wccf-danger' : 'text-wccf-caution'

  const settled = report.status !== 'pending'
  const card =
    report.status === 'success' ? byId(report.data.rewardCardId) : undefined

  const creditsDelta =
    report.status === 'success' && prev ? report.data.club.credits - prev.credits : null
  const ratingDelta =
    report.status === 'success' && prev ? report.data.club.rating - prev.rating : null

  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 pb-8"
    >
      <div className="grid items-start gap-6 min-[820px]:grid-cols-[auto_1fr]">
        {/* ------------ card ceremony ------------ */}
        <div className="mx-auto flex min-h-[300px] w-[320px] items-center justify-center">
          {report.status === 'pending' && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={22} className="animate-spin text-accent" />
              <span className="font-mono text-xs text-wccf-dim">
                The cabinet is ejecting your card…
              </span>
              <div className="h-[2px] w-40 overflow-hidden rounded-full bg-raised">
                <div className="h-full w-1/4 rounded-full bg-accent animate-loading-bar" />
              </div>
            </div>
          )}
          {report.status === 'success' && card && <CardReveal key={card.id} card={card} />}
          {report.status === 'success' && !card && (
            <div className="flex flex-col items-center gap-2 rounded-panel border border-line bg-panel p-4 text-center">
              <Trophy size={18} className="text-wccf-gold" />
              <span className="font-mono text-xs text-wccf-dim">
                Card <span className="text-wccf-ink">{report.data.rewardCardId}</span> added to
                your collection.
              </span>
            </div>
          )}
          {report.status === 'error' && (
            <div className="flex max-w-[280px] flex-col items-center gap-2 rounded-panel border border-[rgba(255,77,79,0.4)] bg-panel p-4 text-center">
              <span className="font-mono text-xs text-wccf-danger">
                Result could not be reported — no reward card this time.
              </span>
              <span className="text-[11px] text-wccf-mute">
                Your lobby connection hiccuped. The score below still stands on the cabinet.
              </span>
            </div>
          )}
        </div>

        {/* ------------ result summary ------------ */}
        <div className="flex flex-col gap-3">
          <div className="rounded-panel border border-line bg-panel p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className={cn('font-display text-4xl font-bold uppercase tracking-[0.04em]', outcomeColor)}>
                {outcomeLabel}
              </span>
              <span className="font-mono text-2xl font-bold text-wccf-ink tnum">
                {scoreFor} — {scoreAgainst}
              </span>
            </div>
            <div className="mt-1 font-mono text-[11px] text-wccf-mute">
              vs {result.opponentName}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-btn border border-line bg-inset px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-wccf-mute">
                  Credits
                </div>
                <div className="font-mono text-sm font-bold text-wccf-ink tnum">
                  {creditsDelta !== null ? (
                    <>
                      {report.status === 'success' ? report.data.club.credits : '—'}{' '}
                      <span className="text-wccf-live">
                        (+{creditsDelta})
                      </span>
                    </>
                  ) : (
                    '—'
                  )}
                </div>
              </div>
              <div className="rounded-btn border border-line bg-inset px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-wccf-mute">
                  Rating
                </div>
                <div className="font-mono text-sm font-bold text-wccf-ink tnum">
                  {ratingDelta !== null && report.status === 'success' ? (
                    <>
                      {report.data.club.rating}{' '}
                      <span className={ratingDelta >= 0 ? 'text-wccf-live' : 'text-wccf-danger'}>
                        ({ratingDelta >= 0 ? '+' : ''}
                        {ratingDelta})
                      </span>
                    </>
                  ) : (
                    '—'
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* broken records */}
          {report.status === 'success' &&
            report.data.recordsBroken.map((r) => (
              <motion.div
                key={r.id}
                initial={{ x: -16, opacity: 0, backgroundColor: 'rgba(232,184,75,0.25)' }}
                animate={{ x: 0, opacity: 1, backgroundColor: 'rgba(232,184,75,0)' }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="flex items-center gap-3 rounded-panel border border-l-4 border-line border-l-wccf-gold bg-panel px-4 py-3"
              >
                <Trophy size={16} className="shrink-0 text-wccf-gold" />
                <div>
                  <div className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-wccf-gold">
                    New online record — {RECORD_LABELS[r.category] ?? r.category} {r.value}
                  </div>
                  {r.detail && (
                    <div className="font-mono text-[10px] text-wccf-dim">{r.detail}</div>
                  )}
                </div>
              </motion.div>
            ))}

          {/* actions */}
          <div className="mt-1 flex flex-wrap gap-2">
            <button
              onClick={onClose}
              disabled={!settled}
              className="flex flex-1 items-center justify-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.06em] text-[#0B0E14] transition-colors hover:bg-accent-hover disabled:opacity-50 min-[480px]:flex-none"
            >
              <ArrowLeft size={14} /> Back to lobby
            </button>
            <button
              onClick={onPlayAgain}
              disabled={!settled}
              className="flex flex-1 items-center justify-center gap-2 rounded-btn border border-line px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.06em] text-wccf-dim transition-colors hover:border-accent hover:text-wccf-ink disabled:opacity-50 min-[480px]:flex-none"
            >
              <RotateCcw size={14} /> Play again
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
