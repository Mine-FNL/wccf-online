import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Users } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { loadCards } from '@/lib/data/cards'
import { AI_CLUBS } from '@/lib/data/aiClubs'
import { crestFor, hashString, seededRand } from '@/components/club/clubUtils'
import ClubGridCard from '@/components/clubs/ClubGridCard'
import ClubDetailModal from '@/components/clubs/ClubDetailModal'
import type { DisplayClub } from '@/components/clubs/displayClub'

const PAGE = 20

const SIM_KITS = [
  ['#FF8A1E', '#12161F'], ['#3B82F6', '#F2EFE7'], ['#FF4D4F', '#12161F'],
  ['#3DD68C', '#0B0E14'], ['#E8B84B', '#12161F'], ['#7A5CFF', '#F2EFE7'],
  ['#4DD0E1', '#0B0E14'], ['#F2EFE7', '#FF4D4F'],
] as const

/** Fictional house clubs → display rows (deterministic synthetic stats). */
function simClubs(q: string): DisplayClub[] {
  const needle = q.trim().toLowerCase()
  return AI_CLUBS.filter(
    (a) =>
      !needle ||
      a.club.toLowerCase().includes(needle) ||
      a.manager.toLowerCase().includes(needle),
  ).map((a) => {
    const rand = seededRand(hashString(a.club))
    const wins = 20 + Math.floor(rand() * 90)
    const draws = 8 + Math.floor(rand() * 30)
    const losses = 15 + Math.floor(rand() * 60)
    const kit = SIM_KITS[Math.floor(rand() * SIM_KITS.length)]
    return {
      key: `sim-${a.club}`,
      kind: 'sim',
      name: a.club,
      shortName: a.club.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'SIM',
      kitPrimary: kit[0],
      kitSecondary: kit[1],
      rating: 1400 + Math.floor(rand() * 520),
      wins,
      draws,
      losses,
      goalsFor: wins + Math.floor(rand() * 160),
      goalsAgainst: losses + Math.floor(rand() * 120),
      avatar: a.avatar,
      manager: a.manager,
      online: rand() < 0.3,
    }
  })
}

function GridSkeleton() {
  return (
    <div className="grid gap-3 min-[768px]:grid-cols-2 min-[1100px]:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-[132px] animate-pulse rounded-panel border border-line bg-panel" />
      ))}
    </div>
  )
}

export default function Clubs() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [offset, setOffset] = useState(0)
  const [items, setItems] = useState<DisplayClub[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [detail, setDetail] = useState<DisplayClub | null>(null)

  /* preload the card pool for signature cards in the detail modal */
  useEffect(() => {
    loadCards().catch(() => undefined)
  }, [])

  /* 200ms live-search debounce */
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 200)
    return () => window.clearTimeout(t)
  }, [q])

  /* reset pagination when the query changes */
  useEffect(() => {
    setOffset(0)
    setItems([])
  }, [debouncedQ])

  const list = trpc.club.list.useQuery(
    { q: debouncedQ.trim() || undefined, limit: PAGE, offset },
    { retry: false, placeholderData: (prev) => prev },
  )

  /* accumulate pages */
  useEffect(() => {
    if (!list.data) return
    const rows: DisplayClub[] = list.data.map((c) => ({
      key: `real-${c.id}`,
      kind: 'real',
      name: c.name,
      shortName: c.shortName,
      kitPrimary: c.kitPrimary,
      kitSecondary: c.kitSecondary,
      rating: c.rating,
      wins: c.wins,
      draws: c.draws,
      losses: c.losses,
      goalsFor: c.goalsFor,
      goalsAgainst: c.goalsAgainst,
      avatar: crestFor(c.id),
      createdAt: c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt),
    }))
    setItems((prev) => (offset === 0 ? rows : [...prev, ...rows]))
    setHasMore(rows.length === PAGE)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data])

  const sims = useMemo(() => simClubs(debouncedQ), [debouncedQ])

  return (
    <div className="mx-auto max-w-shell px-4 py-8">
      {/* header */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex flex-wrap items-end gap-x-6 gap-y-4"
      >
        <div>
          <h1 className="font-display text-[40px] font-bold uppercase leading-[0.95] tracking-[0.04em] text-wccf-ink">
            Clubs
          </h1>
          <p className="mt-1.5 font-mono text-[12px] text-wccf-dim tnum">
            {items.length}
            {hasMore ? '+' : ''} registered clubs{items.length === 0 && !list.isLoading ? '' : ' '}· {sims.length} house clubs on the circuit
          </p>
        </div>
        <div className="relative ml-auto w-full min-[560px]:w-72">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-wccf-mute" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clubs or managers…"
            className="w-full rounded-btn border border-line bg-raised py-2 pl-9 pr-3 font-mono text-[13px] text-wccf-ink placeholder:text-wccf-mute focus:border-accent focus:outline-none"
          />
        </div>
      </motion.header>

      {/* registered clubs */}
      <section className="mt-6" aria-label="Registered clubs">
        {list.isLoading && items.length === 0 ? (
          <GridSkeleton />
        ) : list.isError ? (
          <div className="rounded-panel border border-line bg-panel py-12 text-center">
            <p className="font-mono text-sm text-wccf-danger">Could not load the club directory.</p>
            <button
              onClick={() => list.refetch()}
              className="mt-4 rounded-full border border-line px-5 py-2 text-[12px] font-bold uppercase tracking-[0.06em] text-wccf-dim hover:text-wccf-ink"
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center rounded-panel border border-line bg-panel py-14 text-center">
            <Users size={22} className="text-wccf-mute/50" />
            <p className="mt-3 font-mono text-[13px] text-wccf-mute">
              No clubs found — try another name.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 min-[768px]:grid-cols-2 min-[1100px]:grid-cols-3">
              {items.map((c, i) => (
                <ClubGridCard key={c.key} club={c} index={i} onClick={() => setDetail(c)} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-5 text-center">
                <button
                  onClick={() => setOffset((o) => o + PAGE)}
                  disabled={list.isFetching}
                  className="rounded-full border border-line-strong px-6 py-2 text-[12px] font-bold uppercase tracking-[0.06em] text-wccf-dim transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  {list.isFetching ? 'Loading…' : 'Load more clubs'}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* house clubs ambience */}
      {sims.length > 0 && (
        <section className="mt-10" aria-label="House clubs">
          <div className="mb-3 flex items-center gap-3">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-wccf-mute">
              Simulated circuit — house clubs
            </span>
            <span className="h-px flex-1 bg-line" />
            <span className="font-mono text-[10px] text-wccf-mute/70">
              fictional opponents that fill cabinet seats
            </span>
          </div>
          <div className="grid gap-3 min-[768px]:grid-cols-2 min-[1100px]:grid-cols-3">
            {sims.slice(0, 12).map((c, i) => (
              <ClubGridCard key={c.key} club={c} index={i} onClick={() => setDetail(c)} />
            ))}
          </div>
        </section>
      )}

      <ClubDetailModal club={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
