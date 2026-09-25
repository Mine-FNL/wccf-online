import { memo, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { Shapes, Dumbbell, IdCard, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LOGIN_PATH } from '@/const'
import { useAuth } from '@/hooks/useAuth'
import { trpc } from '@/providers/trpc'
import { loadCards } from '@/lib/data/cards'
import ClubHeader from '@/components/club/ClubHeader'
import ArrangeSection from '@/components/arrange/ArrangeSection'
import CollectionTab from '@/components/club/CollectionTab'
import TrainingTab from '@/components/club/TrainingTab'
import IdentityTab from '@/components/club/IdentityTab'
import StarterModal from '@/components/club/StarterModal'
import { groupCollection, type Club, type OwnedEntry } from '@/components/club/clubUtils'

/* ------------------------------------------------------------------ */
/* Auth gate                                                           */
/* ------------------------------------------------------------------ */

/** Floating card-back silhouette (memoized perpetual animation). */
const FloatingCard = memo(function FloatingCard() {
  return (
    <motion.div
      animate={{ y: [-6, 6, -6] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      className="mx-auto flex h-[196px] w-[140px] flex-col items-center justify-center rounded-card border border-line-strong bg-[#101114] opacity-70 shadow-modal"
    >
      <img src="/logo-badge.svg" alt="" className="h-10 w-10 rounded-lg opacity-60" />
      <span className="mt-3 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-wccf-mute">
        WCCF Online
      </span>
      <span className="mt-1 font-mono text-[8px] text-wccf-mute/60">No. — / —</span>
    </motion.div>
  )
})

function SignInGate() {
  return (
    <div className="mx-auto flex max-w-shell justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-[420px] rounded-panel border border-line bg-panel p-8 text-center"
      >
        <FloatingCard />
        <h1 className="mt-6 font-display text-[32px] font-bold uppercase tracking-[0.04em] text-wccf-ink">
          My Club
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-wccf-dim">
          Sign in to see your club on any device. Your cards, your XI, your training — like the
          card the cabinet ejects, it stays with you.
        </p>
        <Link
          to={LOGIN_PATH}
          className="mt-6 inline-block rounded-full bg-accent px-6 py-2.5 text-[12px] font-bold uppercase tracking-[0.06em] text-[#0B0E14] transition-colors hover:bg-accent-hover active:scale-[0.97]"
        >
          Sign in with Kimi
        </Link>
      </motion.div>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-shell px-4 py-8">
      <div className="h-32 animate-pulse rounded-panel border border-line bg-panel" />
      <div className="mt-4 flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-8 w-28 animate-pulse rounded-full bg-raised" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 min-[1100px]:grid-cols-[3fr_2fr]">
        <div className="aspect-[4/5] animate-pulse rounded-panel border border-line bg-panel" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-card bg-raised" />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

const TABS = [
  { id: 'squad', label: 'Squad & Formation', icon: Shapes },
  { id: 'collection', label: 'Collection', icon: LayoutGrid },
  { id: 'training', label: 'Training', icon: Dumbbell },
  { id: 'identity', label: 'Identity', icon: IdCard },
] as const
type TabId = (typeof TABS)[number]['id']

/* ------------------------------------------------------------------ */
/* Dashboard (authenticated)                                           */
/* ------------------------------------------------------------------ */

function ClubDashboard() {
  const me = trpc.club.me.useQuery(undefined, { retry: false })
  const [cardsReady, setCardsReady] = useState(false)
  const [tab, setTab] = useState<TabId>('squad')
  const [starterDismissed, setStarterDismissed] = useState(false)

  useEffect(() => {
    let alive = true
    loadCards()
      .catch(() => undefined)
      .finally(() => alive && setCardsReady(true))
    return () => {
      alive = false
    }
  }, [])

  const club: Club | undefined = me.data?.club
  const owned: OwnedEntry[] = useMemo(
    () => (me.data ? groupCollection(me.data.collection) : []),
    [me.data],
  )

  /* one-time starter-squad modal for freshly created clubs */
  const [mountedAt] = useState(() => Date.now())
  const freshClub = useMemo(() => {
    if (!me.data || !club) return false
    const played = club.wins + club.draws + club.losses
    const createdAt = club.createdAt instanceof Date ? club.createdAt : new Date(club.createdAt)
    return (
      mountedAt - createdAt.getTime() < 2 * 60 * 1000 ||
      (played === 0 &&
        me.data.collection.length > 0 &&
        me.data.collection.every((c) => c.source === 'starter'))
    )
  }, [me.data, club, mountedAt])
  const starterKey = club ? `wccf-starter-modal:${club.id}` : ''
  const starterShownBefore = starterKey !== '' && window.localStorage.getItem(starterKey) === '1'
  const starterOpen = freshClub && !starterShownBefore && !starterDismissed

  /* persist "shown" to localStorage (external system write) */
  useEffect(() => {
    if (starterOpen && starterKey) window.localStorage.setItem(starterKey, '1')
  }, [starterOpen, starterKey])

  if (me.isLoading || !cardsReady) return <PageSkeleton />
  if (me.isError || !club) {
    return (
      <div className="mx-auto max-w-shell px-4 py-16 text-center">
        <p className="font-mono text-sm text-wccf-danger">Could not load your club.</p>
        <button
          onClick={() => me.refetch()}
          className="mt-4 rounded-full border border-line px-5 py-2 text-[12px] font-bold uppercase tracking-[0.06em] text-wccf-dim hover:text-wccf-ink"
        >
          Retry
        </button>
      </div>
    )
  }

  const cardCount = owned.reduce((a, e) => a + e.count, 0)

  return (
    <div className="mx-auto max-w-shell px-4 py-6">
      <ClubHeader club={club} cardCount={cardCount} />

      {/* tab pills */}
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Club sections">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.06em] transition-all active:scale-[0.97]',
                active
                  ? 'border-accent bg-accent-dim text-accent'
                  : 'border-line bg-panel text-wccf-dim hover:border-line-strong hover:text-wccf-ink',
              )}
            >
              <Icon size={13} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* panels */}
      <div className="mt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {tab === 'squad' && <ArrangeSection club={club} owned={owned} />}
            {tab === 'collection' && <CollectionTab owned={owned} />}
            {tab === 'training' && <TrainingTab club={club} />}
            {tab === 'identity' && <IdentityTab club={club} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <StarterModal open={starterOpen} owned={owned} onClose={() => setStarterDismissed(true)} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function MyClub() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <PageSkeleton />
  if (!isAuthenticated) return <SignInGate />
  return <ClubDashboard />
}
