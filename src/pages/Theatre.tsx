import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { Clapperboard, Star, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LOGIN_PATH } from '@/const'
import { useAuth } from '@/hooks/useAuth'
import { trpc } from '@/providers/trpc'
import Modal from '@/components/Modal'
import PlayerCard from '@/components/PlayerCard'
import { loadCards, byId } from '@/lib/data/cards'
import ReplayStage from '@/components/theatre/ReplayStage'
import MatchHistory from '@/components/theatre/MatchHistory'
import type { TapeMatch } from '@/components/theatre/tape'
import { monthKey, parseTimeline } from '@/components/theatre/tape'

const PAGE_SIZE = 20
const SERVER_MAX = 50

type ResultFilter = 'all' | 'W' | 'D' | 'L'

/* ------------------------------------------------------------------ */
/* Skeletons / gates                                                    */
/* ------------------------------------------------------------------ */

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-shell px-4 py-8">
      <div className="h-10 w-56 animate-pulse rounded bg-raised" />
      <div className="mt-2 h-4 w-72 animate-pulse rounded bg-raised" />
      <div className="mt-6 aspect-video w-full animate-pulse rounded-xl border border-line bg-panel" />
      <div className="mt-6 flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-panel border border-line bg-panel" />
        ))}
      </div>
    </div>
  )
}

function SignInGate() {
  return (
    <div className="mx-auto flex w-full max-w-shell justify-center px-4 py-24">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="flex w-full max-w-md flex-col items-center rounded-panel border border-line bg-panel px-8 py-10 text-center"
      >
        <Clapperboard size={28} className="text-accent" />
        <h1 className="mt-3 font-display text-[28px] font-bold uppercase tracking-[0.04em] text-wccf-ink">
          Theatre <Star size={14} className="mb-2 inline text-wccf-gold" fill="currentColor" />
        </h1>
        <p className="mt-2 text-[14px] text-wccf-dim">
          Sign in to rewatch your matches on any device.
        </p>
        <Link
          to={LOGIN_PATH}
          className="mt-5 rounded-btn bg-accent px-5 py-2.5 font-sans text-[13px] font-bold uppercase tracking-[0.06em] text-[#0B0E14] transition-colors hover:bg-accent-hover"
        >
          Sign in
        </Link>
      </motion.div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Filter pill                                                          */
/* ------------------------------------------------------------------ */

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 font-sans text-[11px] font-bold uppercase tracking-[0.06em] transition-colors',
        active
          ? 'border-[rgba(255,138,30,0.45)] bg-accent-dim text-accent'
          : 'border-line bg-panel text-wccf-mute hover:border-line-strong hover:text-wccf-ink',
      )}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function Theatre() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [limit, setLimit] = useState(PAGE_SIZE)
  const historyQuery = trpc.match.history.useQuery(
    { limit },
    { enabled: isAuthenticated, retry: false },
  )
  const clubQuery = trpc.club.me.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    staleTime: 1000 * 60 * 5,
  })

  /* card database (reward chips / modal) */
  const [cardsReady, setCardsReady] = useState(false)
  useEffect(() => {
    let on = true
    loadCards()
      .catch(() => undefined)
      .finally(() => {
        if (on) setCardsReady(true)
      })
    return () => {
      on = false
    }
  }, [])

  const matches: TapeMatch[] = useMemo(
    () => (historyQuery.data?.matches ?? []) as TapeMatch[],
    [historyQuery.data],
  )

  /* filters */
  const [versionFilter, setVersionFilter] = useState<string>('all')
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')
  const [monthFilter, setMonthFilter] = useState<string>('all')

  const versions = useMemo(
    () => [...new Set(matches.map((m) => m.cabinetVersion))],
    [matches],
  )
  const months = useMemo(() => {
    const keys = [...new Set(matches.map((m) => monthKey(m.createdAt)).filter(Boolean))]
    return keys.sort().reverse()
  }, [matches])

  const filtered = useMemo(
    () =>
      matches.filter((m) => {
        if (versionFilter !== 'all' && m.cabinetVersion !== versionFilter) return false
        if (resultFilter !== 'all' && m.result !== resultFilter) return false
        if (monthFilter !== 'all' && monthKey(m.createdAt) !== monthFilter) return false
        return true
      }),
    [matches, versionFilter, resultFilter, monthFilter],
  )

  /* selection + stage scroll */
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const selected: TapeMatch | null =
    matches.find((m) => m.id === selectedId) ?? matches[0] ?? null
  const selectedEvents = useMemo(
    () => (selected ? parseTimeline(selected.timelineJson) : []),
    [selected],
  )

  const selectMatch = (m: TapeMatch) => {
    setSelectedId(m.id)
    stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /* reward card modal */
  const [rewardCardId, setRewardCardId] = useState<string | null>(null)
  const rewardCard = rewardCardId && cardsReady ? byId(rewardCardId) : undefined
  const selectedReward =
    selected && cardsReady ? byId(selected.rewardCardId) : undefined

  /* infinite scroll — the server caps at 50 rows */
  const canLoadMore = matches.length >= limit && limit < SERVER_MAX
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!canLoadMore) return
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLimit((l) => Math.min(l + PAGE_SIZE, SERVER_MAX))
        }
      },
      { rootMargin: '240px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [canLoadMore])

  /* ------------------------------ gates ------------------------------ */
  if (authLoading) return <PageSkeleton />
  if (!isAuthenticated) return <SignInGate />

  const club = clubQuery.data?.club
  const homeName = club?.name ?? 'My Club'
  const homeShort = club?.shortName ?? 'YOU'
  const homeColor = club?.kitPrimary ?? '#FF8A1E'

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-').map(Number)
    const d = new Date(y, (m ?? 1) - 1, 1)
    return `${d.toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${y}`
  }

  return (
    <div className="mx-auto w-full max-w-shell px-4 py-8">
      {/* ---------------- Header ---------------- */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <h1 className="font-display text-[40px] font-bold uppercase leading-[0.95] tracking-[0.04em] text-wccf-ink">
          Theatre <Star size={18} className="mb-3 inline text-wccf-gold" fill="currentColor" />
        </h1>
        <p className="mt-1 text-[14px] italic text-wccf-dim">
          Every match your club has played, on tape.
        </p>

        {matches.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Pill active={versionFilter === 'all'} onClick={() => setVersionFilter('all')}>
              All cabinets
            </Pill>
            {versions.map((v) => (
              <Pill key={v} active={versionFilter === v} onClick={() => setVersionFilter(v)}>
                {v}
              </Pill>
            ))}
            <span className="mx-1 hidden h-5 w-px bg-line min-[640px]:block" />
            {(['all', 'W', 'D', 'L'] as const).map((r) => (
              <Pill key={r} active={resultFilter === r} onClick={() => setResultFilter(r)}>
                {r === 'all' ? 'All results' : r}
              </Pill>
            ))}
            {months.length > 1 && (
              <select
                aria-label="Season month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="rounded-full border border-line bg-panel px-3 py-1 font-mono text-[11px] font-bold uppercase text-wccf-dim outline-none transition-colors hover:border-line-strong focus:border-[rgba(255,138,30,0.45)]"
              >
                <option value="all">All months</option>
                {months.map((k) => (
                  <option key={k} value={k}>
                    {monthLabel(k)}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </motion.header>

      {/* ---------------- Replay stage ---------------- */}
      {selected && (
        <section ref={stageRef} className="mt-6 scroll-mt-4">
          <ReplayStage
            key={selected.id}
            match={selected}
            events={selectedEvents}
            homeName={homeName}
            homeShort={homeShort}
            homeColor={homeColor}
            rewardCard={selectedReward}
            onRewardClick={() => setRewardCardId(selected.rewardCardId)}
          />
        </section>
      )}

      {/* ---------------- Match history ---------------- */}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-[22px] font-semibold uppercase tracking-[0.06em] text-wccf-ink">
            Match history
          </h2>
          {matches.length > 0 && (
            <span className="font-mono text-[11px] text-wccf-mute tnum">
              {filtered.length} {filtered.length === 1 ? 'tape' : 'tapes'}
            </span>
          )}
        </div>

        {historyQuery.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-panel border border-line bg-panel" />
            ))}
          </div>
        ) : historyQuery.isError ? (
          <div className="flex flex-col items-center gap-3 rounded-panel border border-line bg-panel px-6 py-10 text-center">
            <TriangleAlert size={22} className="text-wccf-caution" />
            <p className="font-mono text-[12px] text-wccf-dim">
              The projector jammed — tapes failed to load.
            </p>
            <button
              onClick={() => historyQuery.refetch()}
              className="rounded-btn border border-line bg-raised px-4 py-2 font-sans text-[12px] font-bold uppercase tracking-[0.06em] text-wccf-ink transition-colors hover:border-line-strong"
            >
              Retry
            </button>
          </div>
        ) : matches.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex flex-col items-center gap-4 rounded-panel border border-line bg-panel px-6 py-12 text-center"
          >
            <Clapperboard size={26} className="text-wccf-mute" />
            <p className="font-mono text-[13px] text-wccf-dim">
              No tapes yet — your first match is waiting in the lobby.
            </p>
            <Link
              to="/"
              className="rounded-btn bg-accent px-5 py-2.5 font-sans text-[13px] font-bold uppercase tracking-[0.06em] text-[#0B0E14] transition-colors hover:bg-accent-hover"
            >
              Play now
            </Link>
          </motion.div>
        ) : filtered.length === 0 ? (
          <div className="rounded-panel border border-line bg-panel px-6 py-10 text-center">
            <p className="font-mono text-[12px] text-wccf-mute">
              No tapes match these filters.
            </p>
          </div>
        ) : (
          <MatchHistory
            matches={filtered}
            selectedId={selected?.id ?? null}
            onSelect={selectMatch}
            onRewardClick={setRewardCardId}
            sentinelRef={canLoadMore ? sentinelRef : null}
            loadingMore={historyQuery.isFetching && canLoadMore}
          />
        )}
      </section>

      {/* ---------------- Reward card modal ---------------- */}
      <Modal
        open={!!rewardCard}
        onClose={() => setRewardCardId(null)}
        title="Reward card"
        widthClass="max-w-xs"
      >
        {rewardCard && (
          <div className="flex flex-col items-center gap-3">
            <PlayerCard card={rewardCard} size="md" flippable />
            <p className="text-center font-mono text-[11px] text-wccf-mute">
              Ejected after the final whistle — click the card to flip it.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
