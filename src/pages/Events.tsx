import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/hooks/useAuth'
import FeaturedHero from '@/components/events/FeaturedHero'
import UpcomingEvents from '@/components/events/UpcomingEvents'
import CabinetChallenges from '@/components/events/CabinetChallenges'
import PastResultsStrip from '@/components/events/PastResultsStrip'
import BracketModal from '@/components/events/BracketModal'
import EnterModal, { type EnterTarget } from '@/components/events/EnterModal'
import {
  CABINET_CHALLENGES,
  PAST_RESULTS,
  UPCOMING_EVENTS,
  type UpcomingEvent,
} from '@/components/events/data'

const FEATURED_TARGET: EnterTarget = {
  name: 'Intercontinental Cup',
  entry: '200 credits',
  seats: 32,
}

function SectionHeader({ children }: { children: string }) {
  return (
    <h2 className="mb-3 font-display text-[26px] font-semibold uppercase tracking-[0.06em] text-wccf-ink">
      {children}
    </h2>
  )
}

export default function Events() {
  const [bracketOpen, setBracketOpen] = useState(false)
  const [enterTarget, setEnterTarget] = useState<EnterTarget | null>(null)
  const [registered, setRegistered] = useState<Set<string>>(new Set())

  const { isAuthenticated } = useAuth()
  const ownClub = trpc.club.me.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    staleTime: 1000 * 60 * 5,
  })

  const openEventEntry = (ev: UpcomingEvent) =>
    setEnterTarget({ name: ev.name, entry: ev.entry, seats: ev.seats })

  const confirmEntry = (t: EnterTarget) => {
    setRegistered((prev) => new Set(prev).add(t.name))
    setEnterTarget(null)
  }

  /* featured hero registered state is keyed on its event name */
  const registeredNames = new Set(
    UPCOMING_EVENTS.filter((e) => registered.has(e.name)).map((e) => e.id),
  )

  return (
    <div className="mx-auto max-w-shell px-4 pb-8 pt-5">
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1.5 font-sans text-[12px] font-semibold uppercase tracking-[0.06em] text-wccf-dim transition-colors hover:text-accent"
      >
        <ArrowLeft size={13} />
        Lobby
      </Link>

      <div className="mb-5">
        <h1 className="font-display text-[44px] font-bold uppercase leading-[0.95] tracking-[0.04em] text-wccf-ink">
          Events
        </h1>
        <p className="mt-1 text-[14px] text-wccf-dim">
          Tournaments, weekly cabinet challenges and the road to the Intercontinental Cup.
        </p>
      </div>

      {/* featured event hero — pinned scroll moment */}
      <FeaturedHero
        onEnter={() =>
          registered.has(FEATURED_TARGET.name) ? null : setEnterTarget(FEATURED_TARGET)
        }
        onBracket={() => setBracketOpen(true)}
      />

      {/* upcoming events */}
      <section className="mt-10">
        <SectionHeader>Upcoming events</SectionHeader>
        <UpcomingEvents
          events={UPCOMING_EVENTS}
          registered={registeredNames}
          onEnter={openEventEntry}
        />
      </section>

      {/* per-cabinet weekly challenges */}
      <section className="mt-10">
        <SectionHeader>Cabinet challenges — this week</SectionHeader>
        <CabinetChallenges challenges={CABINET_CHALLENGES} />
      </section>

      {/* past champions */}
      <section className="mt-10">
        <SectionHeader>Past results</SectionHeader>
        <PastResultsStrip results={PAST_RESULTS} />
      </section>

      <BracketModal open={bracketOpen} onClose={() => setBracketOpen(false)} />
      <EnterModal
        target={enterTarget}
        isAuthenticated={isAuthenticated}
        clubName={ownClub.data?.club?.name}
        onClose={() => setEnterTarget(null)}
        onConfirm={confirmEntry}
      />
    </div>
  )
}
