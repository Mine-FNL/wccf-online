/**
 * Cabinet seat gameplay flow — full-screen overlay above the lobby.
 *
 * Stages: setup (VS panel) → live (compressed match) → reward (report +
 * card ceremony). The completed match is reported exactly once via
 * match.report; abandoning mid-match asks for confirmation and reports
 * nothing. Header chrome carries cabinet name, version badge and seat.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { Link } from 'react-router'
import type { Cabinet } from '@/lib/data/cabinets'
import { loadCards } from '@/lib/data/cards'
import type { MatchTimeline } from '@/lib/engine'
import type { CommandLogEntry, MatchTimeline2 } from '@/lib/engine2'
import { LOGIN_PATH } from '@/const'
import { trpc } from '@/providers/trpc'
import { useToast } from '@/components/Toast'
import Modal from '@/components/Modal'
import MatchSetup from './MatchSetup'
import MatchScreen from '@/components/match2/MatchScreen'
import RewardReveal, {
  type MatchResultSummary,
  type ReportState,
} from './RewardReveal'
import {
  buildReportTimeline,
  clampScore,
  toV1Timeline,
  type ClubSnapshot,
  type KickoffPlan,
} from './helpers'

type Stage = 'setup' | 'live' | 'reward'

const STAGE_LABEL: Record<Stage, string> = {
  setup: 'Match setup',
  live: 'Live',
  reward: 'Full time',
}

export default function SeatMatchFlow({
  cabinet,
  seat,
  onClose,
}: {
  cabinet: Cabinet
  seat: number
  onClose: () => void
}) {
  const { toast } = useToast()
  const utils = trpc.useUtils()

  /* card db (module-cached; the lobby already warmed it) */
  const [cardsReady, setCardsReady] = useState(false)
  useEffect(() => {
    let on = true
    void loadCards().then(() => on && setCardsReady(true))
    return () => {
      on = false
    }
  }, [])

  /* lock body scroll while the flow is open */
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const clubQuery = trpc.club.me.useQuery(undefined, {
    retry: false,
    staleTime: 15_000,
  })
  const club = (clubQuery.data?.club ?? null) as ClubSnapshot | null
  const ownedCardIds: string[] = useMemo(
    () => clubQuery.data?.collection.map((r) => r.cardId) ?? [],
    [clubQuery.data],
  )

  const [stage, setStage] = useState<Stage>('setup')
  const [nonce, setNonce] = useState(0)
  const [plan, setPlan] = useState<KickoffPlan | null>(null)
  const [result, setResult] = useState<MatchResultSummary | null>(null)
  const [reportState, setReportState] = useState<ReportState>({ status: 'pending' })
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [prev, setPrev] = useState<{ credits: number; rating: number } | null>(null)
  const planRef = useRef<KickoffPlan | null>(null)
  const reportedRef = useRef(false)

  const report = trpc.match.report.useMutation({
    onSuccess: (data) => {
      setReportState({ status: 'success', data })
      void utils.club.me.invalidate()
      void utils.match.history.invalidate()
    },
    onError: (err) => {
      setReportState({ status: 'error' })
      toast(`Match report failed: ${err.message}`, 'danger')
    },
  })

  const handleKickoff = useCallback(
    (p: KickoffPlan) => {
      setPrev(club ? { credits: club.credits, rating: club.rating } : null)
      reportedRef.current = false
      planRef.current = p
      setPlan(p)
      setStage('live')
    },
    [club],
  )

  /* full-time whistle → report exactly once, then show the ceremony */
  const handleFullTime = useCallback(
    (tl: MatchTimeline) => {
      const p = planRef.current
      if (!p) return
      setResult({
        scoreFor: tl.finalScore.home,
        scoreAgainst: tl.finalScore.away,
        opponentName: p.opponent.club,
      })
      if (!reportedRef.current) {
        reportedRef.current = true
        setReportState({ status: 'pending' })
        report.mutate({
          cabinetId: cabinet.id,
          cabinetVersion: cabinet.version,
          opponentName: p.opponent.club,
          opponentRating: p.opponentRating,
          scoreFor: clampScore(tl.finalScore.home),
          scoreAgainst: clampScore(tl.finalScore.away),
          timeline: buildReportTimeline(tl),
        })
      }
      setStage('reward')
    },
    [cabinet, report],
  )

  /* engine2 full-time (timeline + command log from MatchScreen) → adapt to
   * the v1 shape so the report / Theatre / RewardReveal pipeline is unchanged */
  const handleFullTime2 = useCallback(
    (tl2: MatchTimeline2, log: CommandLogEntry[]) => {
      /* the command log also rides the v2 timeline (tl2.commandLog) —
       * available for Theatre replays of seat matches */
      void log
      handleFullTime(toV1Timeline(tl2))
    },
    [handleFullTime],
  )

  const close = useCallback(() => {
    void utils.club.me.invalidate()
    void utils.match.history.invalidate()
    onClose()
  }, [utils, onClose])

  const requestClose = () => {
    if (stage === 'live') setConfirmAbandon(true)
    else close()
  }

  const playAgain = () => {
    setNonce((n) => n + 1)
    planRef.current = null
    setPlan(null)
    setResult(null)
    reportedRef.current = false
    setStage('setup')
  }

  const loading = !cardsReady || clubQuery.isLoading

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[85] flex flex-col bg-base"
    >
      {/* header chrome */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
        <img src="/logo-badge.svg" alt="" className="h-7 w-7 rounded-[6px]" />
        <span className="truncate font-display text-lg font-semibold uppercase tracking-[0.04em] text-accent">
          {cabinet.name}
        </span>
        <span className="rounded-full bg-accent-dim px-2 py-[3px] font-mono text-[10px] font-bold uppercase text-accent">
          {cabinet.version === 'all' ? 'ATLE' : cabinet.version}
        </span>
        <span className="rounded-full border border-line px-2 py-[3px] font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-wccf-dim">
          Seat {seat}
        </span>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-wccf-mute min-[640px]:inline">
          {STAGE_LABEL[stage]}
        </span>
        <button
          onClick={requestClose}
          aria-label="Close match flow"
          className="ml-auto rounded-btn p-1.5 text-wccf-mute transition-colors hover:bg-raised hover:text-wccf-ink"
        >
          <X size={18} />
        </button>
      </header>

      {/* stage */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Loader2 size={22} className="animate-spin text-accent" />
            <span className="font-mono text-xs text-wccf-dim">
              Loading your club from the cabinet…
            </span>
          </div>
        ) : clubQuery.isError || !club ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <span className="font-mono text-xs text-wccf-danger">
              Couldn't load your club.
            </span>
            <span className="max-w-sm text-[13px] text-wccf-dim">
              Your session may have expired — sign in again to take a seat.
            </span>
            <Link
              to={LOGIN_PATH}
              className="rounded-btn bg-accent px-4 py-2 text-[12px] font-bold uppercase tracking-[0.06em] text-[#0B0E14] transition-colors hover:bg-accent-hover"
            >
              Sign in
            </Link>
          </div>
        ) : stage === 'setup' ? (
          <MatchSetup
            cabinet={cabinet}
            seat={seat}
            nonce={nonce}
            club={club}
            ownedCardIds={ownedCardIds}
            onKickoff={handleKickoff}
          />
        ) : stage === 'live' && plan && plan.home2 && plan.away2 && plan.era ? (
          <MatchScreen
            key={`${plan.seed}:${nonce}`}
            seed={plan.seed}
            home2={plan.home2}
            away2={plan.away2}
            era={plan.era}
            formation={club.formation}
            seat={seat}
            onFullTime={handleFullTime2}
          />
        ) : stage === 'reward' && result ? (
          <RewardReveal
            result={result}
            prev={prev}
            report={reportState}
            onClose={close}
            onPlayAgain={playAgain}
          />
        ) : null}
      </main>

      {/* abandon confirmation */}
      <Modal
        open={confirmAbandon}
        onClose={() => setConfirmAbandon(false)}
        title="Abandon match?"
      >
        <div className="flex flex-col gap-3 text-[13px] text-wccf-dim">
          <p>
            This match is still playing. If you leave now it{' '}
            <span className="text-wccf-ink">won't be reported</span> — no rating,
            no credits, and the cabinet keeps its reward card.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setConfirmAbandon(false)
                close()
              }}
              className="flex-1 rounded-btn bg-wccf-danger px-3 py-2 text-[12px] font-bold uppercase tracking-[0.06em] text-white transition-opacity hover:opacity-90"
            >
              Abandon match
            </button>
            <button
              onClick={() => setConfirmAbandon(false)}
              className="flex-1 rounded-btn border border-line px-3 py-2 text-[12px] font-bold uppercase tracking-[0.06em] text-wccf-dim transition-colors hover:border-accent hover:text-wccf-ink"
            >
              Keep playing
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>,
    document.body,
  )
}
