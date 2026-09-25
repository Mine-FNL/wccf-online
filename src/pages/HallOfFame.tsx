import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { ArrowLeft, BookOpen, ListOrdered } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/hooks/useAuth'
import Podium from '@/components/fame/Podium'
import RankingsTable from '@/components/fame/RankingsTable'
import RecordBook from '@/components/fame/RecordBook'
import RecordsTicker from '@/components/fame/RecordsTicker'
import ClubModal from '@/components/fame/ClubModal'
import {
  demoLeaderboard,
  demoRecords,
  demoTicker,
  demoToLeaderRow,
  toLeaderRow,
  RECORD_CATEGORIES,
  type DemoRecordRow,
  type LeaderRow,
} from '@/components/fame/demoData'

const PAGE_SIZE = 25

type Tab = 'rankings' | 'records'

/** Gold gradient display title, words slide up staggered 120ms. */
function GoldTitle() {
  const words = ['HALL', 'OF', 'FAME']
  return (
    <h1
      className="font-display text-[44px] font-bold uppercase leading-[0.95] tracking-[0.04em]"
      aria-label="Hall of Fame"
    >
      {words.map((w, i) => (
        <span key={w} className="inline-block overflow-hidden pb-1 align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            transition={{ delay: i * 0.12, duration: 0.4, ease: 'easeOut' }}
            style={{
              backgroundImage: 'linear-gradient(180deg, #E8B84B, #B8860B)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </h1>
  )
}

export default function HallOfFame() {
  const [tab, setTab] = useState<Tab>('rankings')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<LeaderRow | null>(null)

  const { isAuthenticated } = useAuth()
  const ownClub = trpc.club.me.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    staleTime: 1000 * 60 * 5,
  })

  /* leaderboard — live rows when the DB has clubs, demo ambience otherwise */
  const top = trpc.leaderboard.top.useQuery({ limit: 50 }, { retry: false })
  const rows: LeaderRow[] = useMemo(() => {
    const live = top.data ?? []
    if (live.length > 0) return live.map(toLeaderRow)
    return demoLeaderboard().map(demoToLeaderRow)
  }, [top.data])

  /* record book — live holder per category, demo holder fills empty slots */
  const recordsList = trpc.records.list.useQuery(undefined, { retry: false })
  const bookRows: DemoRecordRow[] = useMemo(() => {
    const live = recordsList.data ?? []
    const demo = demoRecords()
    return RECORD_CATEGORIES.map((cat) => {
      const hit = live.find((r) => r.category === cat)
      return hit ?? demo.find((r) => r.category === cat)!
    })
  }, [recordsList.data])

  /* live record ticker — polls 10s; fresh rows get the gold flash */
  const recent = trpc.records.recent.useQuery(undefined, {
    retry: false,
    refetchInterval: 10_000,
  })
  const tickerRows: DemoRecordRow[] = useMemo(() => {
    const live = recent.data ?? []
    return live.length > 0 ? live : demoTicker()
  }, [recent.data])

  const seenIds = useRef<Set<number> | null>(null)
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set())
  useEffect(() => {
    const live = recent.data
    if (!live || live.length === 0) return
    if (seenIds.current === null) {
      /* first load: nothing is "fresh" yet */
      seenIds.current = new Set(live.map((r) => r.id))
      return
    }
    const fresh = live.filter((r) => !seenIds.current!.has(r.id))
    for (const r of live) seenIds.current.add(r.id)
    if (fresh.length > 0) {
      const ids = new Set(fresh.map((r) => r.id))
      setFreshIds(ids)
      const t = setTimeout(() => setFreshIds(new Set()), 2600)
      return () => clearTimeout(t)
    }
  }, [recent.data])

  const flashingCategories = useMemo(
    () => new Set(tickerRows.filter((r) => freshIds.has(r.id)).map((r) => r.category)),
    [tickerRows, freshIds],
  )

  /* pagination (25/page, mono pager) */
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  const TABS: { id: Tab; label: string; icon: typeof ListOrdered }[] = [
    { id: 'rankings', label: 'Club Rankings', icon: ListOrdered },
    { id: 'records', label: 'Record Book', icon: BookOpen },
  ]

  return (
    <div className="mx-auto max-w-shell px-4 pb-8 pt-5">
      {/* back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 font-sans text-[12px] font-semibold uppercase tracking-[0.06em] text-wccf-dim transition-colors hover:text-accent"
      >
        <ArrowLeft size={13} />
        Lobby
      </Link>

      {/* header */}
      <div className="mb-5 mt-3">
        <GoldTitle />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="mt-1 text-[14px] text-wccf-dim"
        >
          The record book never closes.
        </motion.p>
      </div>

      {/* record ticker strip (records only, 20s loop) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="mb-5 overflow-hidden rounded-panel border border-line"
      >
        <RecordsTicker rows={tickerRows} freshIds={freshIds} />
      </motion.div>

      {/* tabs */}
      <div className="mb-5 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'relative flex items-center gap-1.5 px-3 pb-2.5 pt-1 font-sans text-[13px] font-semibold uppercase tracking-[0.04em] transition-colors',
              tab === t.id ? 'text-accent' : 'text-wccf-dim hover:text-wccf-ink',
            )}
          >
            <t.icon size={14} />
            {t.label}
            {tab === t.id && (
              <motion.span
                layoutId="hof-tab"
                className="absolute inset-x-0 -bottom-px h-[2px] bg-accent"
              />
            )}
          </button>
        ))}
      </div>

      {tab === 'rankings' ? (
        <div className="flex flex-col gap-6">
          <Podium rows={rows} />
          <RankingsTable
            rows={pageRows}
            ownClubId={ownClub.data?.club?.id}
            pageKey={safePage}
            onSelect={setSelected}
          />
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3 font-mono text-[12px] tnum">
              <button
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
                className="rounded-btn border border-line px-2.5 py-1 text-wccf-dim transition-colors enabled:hover:border-line-strong enabled:hover:text-wccf-ink disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-wccf-mute">
                {safePage + 1} / {pageCount}
              </span>
              <button
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
                className="rounded-btn border border-line px-2.5 py-1 text-wccf-dim transition-colors enabled:hover:border-line-strong enabled:hover:text-wccf-ink disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      ) : (
        <RecordBook rows={bookRows} flashingCategories={flashingCategories} />
      )}

      <ClubModal row={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
