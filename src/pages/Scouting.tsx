import { useEffect, useMemo, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { Coins } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { trpc } from '@/providers/trpc'
import { useToast } from '@/components/Toast'
import { allCards, byId, loadCards } from '@/lib/data/cards'
import type { PlayerCardData, Position } from '@/lib/data/types'
import PackTiers from '@/components/scout/PackTiers'
import RevealCeremony, { type CeremonyData } from '@/components/scout/RevealCeremony'
import OddsTable from '@/components/scout/OddsTable'
import PullsRail, { makeDemoPulls, type PullEntry } from '@/components/scout/PullsRail'
import { SCOUT_COST, type ScoutTier } from '@/components/scout/odds'

/** Gold credits balance with count-up (800ms) whenever the value changes. */
function CreditsBalance({ credits }: { credits: number }) {
  const mv = useMotionValue(0)
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString())
  useEffect(() => {
    const controls = animate(mv, credits, { duration: 0.8, ease: 'easeOut' })
    return () => controls.stop()
  }, [credits, mv])
  return (
    <div className="text-right">
      <div className="flex items-center justify-end gap-2">
        <Coins size={18} className="text-wccf-gold" />
        <motion.span className="font-mono text-xl font-bold tnum text-wccf-gold">{text}</motion.span>
      </div>
      <p className="mt-0.5 font-mono text-[11px] text-wccf-mute">earned from matches &amp; events</p>
    </div>
  )
}

/** Full card data for a server pool entry (falls back to a minimal shell). */
function resolveCard(entry: { id: string; name: string; rarity: PlayerCardData['rarity']; positions: string[]; version: string }): PlayerCardData {
  const full = byId(entry.id)
  if (full) return full
  return {
    id: entry.id,
    name: entry.name,
    club: '',
    version: entry.version,
    cardNo: '—',
    positions: entry.positions as Position[],
    stats: { off: 0, def: 0, tec: 0, pow: 0, spd: 0, sta: 0 },
    trait: '',
    rarity: entry.rarity,
    number: 0,
  }
}

const HOT = (r: PlayerCardData['rarity']) => r !== 'REG' && r !== 'SPE'

export default function Scouting() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const { toast } = useToast()
  const utils = trpc.useUtils()

  const clubQuery = trpc.club.me.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    staleTime: 1000 * 30,
  })
  const credits = isAuthenticated ? clubQuery.data?.club.credits ?? null : null

  /* card database for rendering pulls */
  const [cardsReady, setCardsReady] = useState(false)
  useEffect(() => {
    let alive = true
    loadCards()
      .then(() => alive && setCardsReady(true))
      .catch(() => alive && setCardsReady(true))
    return () => {
      alive = false
    }
  }, [])
  const demoPulls = useMemo(() => (cardsReady ? makeDemoPulls(allCards()) : []), [cardsReady])

  const [sessionPulls, setSessionPulls] = useState<PullEntry[]>([])
  const [ceremony, setCeremony] = useState<(CeremonyData & { pullKey: number }) | null>(null)
  const [pulling, setPulling] = useState<ScoutTier | null>(null)
  const [insufficient, setInsufficient] = useState<ScoutTier | null>(null)
  const pullSeq = useRef(0)
  const pendingRef = useRef<{ before: number | null }>({ before: null })
  const oddsRef = useRef<HTMLDivElement>(null)

  const pull = trpc.scout.pull.useMutation({
    onSuccess: (data, vars) => {
      const cards = data.cards.map(resolveCard)
      pullSeq.current += 1
      setCeremony({
        pullKey: pullSeq.current,
        tier: vars.tier,
        cards,
        creditsBefore: pendingRef.current.before,
        cost: SCOUT_COST[vars.tier],
      })
      void utils.club.me.invalidate()
      const clubName = user?.name ?? 'You'
      const avatar = user?.avatar || `/avatar-${(Math.abs(Number(user?.id ?? 1)) % 8) + 1}.png`
      setSessionPulls((prev) =>
        [
          ...cards.map((c, i) => ({
            id: `pull-${pullSeq.current}-${i}-${c.id}`,
            clubName,
            avatar,
            card: c,
            time: 'just now',
            hot: HOT(c.rarity),
          })),
          ...prev,
        ].slice(0, 20),
      )
      setInsufficient(null)
      setPulling(null)
      const best = cards.some((c) => HOT(c.rarity))
      toast(best ? 'Pack opened — kira in the pack!' : 'Pack opened — 5 cards added.', best ? 'gold' : 'success')
    },
    onError: (err, vars) => {
      setPulling(null)
      if (err.data?.code === 'BAD_REQUEST') {
        setInsufficient(vars.tier)
        toast('Not enough credits for that pack.', 'danger')
      } else {
        toast(err.message || 'The cabinet jammed. Try again.', 'danger')
      }
    },
  })

  const doPull = (tier: ScoutTier) => {
    if (pulling !== null) return
    pendingRef.current = { before: credits }
    setPulling(tier)
    setInsufficient(null)
    pull.mutate({ tier })
  }

  return (
    <div className="mx-auto max-w-shell px-4 pb-8 pt-8">
      {/* Section 1 — header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[40px] font-bold uppercase leading-[0.95] tracking-[0.04em] text-wccf-ink">
            Scouting
          </h1>
          <p className="mt-1 text-[15px] italic text-wccf-dim">
            "The cabinet always has one more card."
          </p>
        </div>
        {isAuthenticated && credits !== null && <CreditsBalance credits={credits} />}
      </div>

      {/* Section 2 — pack tiers */}
      <section className="mt-6">
        <PackTiers
          isAuthenticated={isAuthenticated}
          authLoading={authLoading}
          credits={credits}
          pulling={pulling}
          insufficient={insufficient}
          onPull={doPull}
          onShowOdds={() => oddsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />
      </section>

      {/* Section 4 — odds & drop table */}
      <section className="mt-6">
        <OddsTable ref={oddsRef} />
      </section>

      {/* Section 5 — recent pulls */}
      <section className="mt-6">
        <PullsRail sessionPulls={sessionPulls} demoPulls={demoPulls} />
      </section>

      {/* Section 3 — reveal ceremony (full-screen takeover) */}
      {ceremony && (
        <RevealCeremony
          key={ceremony.pullKey}
          data={ceremony}
          pendingAgain={pulling !== null}
          onScoutAgain={() => doPull(ceremony.tier)}
          onClose={() => setCeremony(null)}
        />
      )}
    </div>
  )
}
