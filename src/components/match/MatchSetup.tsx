/**
 * Pre-match screen — two-side VS panel: the user's club (identity from
 * club.me, XI from lineupJson with auto-filled empty slots) versus a
 * deterministic AI club drawn from the cabinet's card pool.
 */
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Bot, Shield, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Cabinet } from '@/lib/data/cabinets'
import { cardTotal } from '@/lib/data/cards'
import { squadStrength, teamFromCards, type SquadStrength } from '@/lib/engine'
import PreMatch from '@/components/match2/PreMatch'
import {
  buildOpponent,
  buildUserXI,
  type ClubSnapshot,
  type KickoffPlan,
} from './helpers'

/* ------------------------------------------------------------------ */

function KitChips({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <span className="flex overflow-hidden rounded-[4px] border border-line">
      <span className="h-4 w-4" style={{ backgroundColor: primary }} />
      <span className="h-4 w-4" style={{ backgroundColor: secondary }} />
    </span>
  )
}

function StrengthRow({
  label,
  home,
  away,
  homeColor,
  awayColor,
}: {
  label: string
  home: number
  away: number
  homeColor: string
  awayColor: string
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-[5px] flex-1 justify-end overflow-hidden rounded-full bg-inset">
        <div
          className="h-full rounded-full"
          style={{ width: `${home}%`, backgroundColor: homeColor }}
        />
      </div>
      <span className="w-8 text-center font-mono text-[9px] font-bold tracking-wider text-wccf-mute">
        {label}
      </span>
      <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-inset">
        <div
          className="h-full rounded-full"
          style={{ width: `${away}%`, backgroundColor: awayColor }}
        />
      </div>
    </div>
  )
}

function XIRow({
  position,
  name,
  total,
  kp,
  autoFilled,
  align,
}: {
  position: string
  name: string
  total: number
  kp?: boolean
  autoFilled?: boolean
  align: 'left' | 'right'
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-[4px] px-1.5 py-1',
        align === 'right' && 'flex-row-reverse text-right',
      )}
    >
      <span className="w-9 shrink-0 rounded-[3px] bg-inset px-1 py-[1px] text-center font-mono text-[9px] font-bold text-wccf-dim">
        {position}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-wccf-ink">
        {name}
      </span>
      {kp && <Star size={10} className="shrink-0 text-wccf-gold" aria-label="Key player" />}
      {autoFilled && (
        <span className="shrink-0 rounded-[3px] bg-accent-dim px-1 font-mono text-[8px] font-bold text-accent">
          AUTO
        </span>
      )}
      <span className="shrink-0 font-mono text-[10px] font-bold text-wccf-dim tnum">
        Σ{total}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export default function MatchSetup({
  cabinet,
  seat,
  nonce,
  club,
  ownedCardIds,
  onKickoff,
}: {
  cabinet: Cabinet
  seat: number
  /** increments on "Play again" → fresh deterministic opponent */
  nonce: number
  club: ClubSnapshot
  ownedCardIds: string[]
  onKickoff: (plan: KickoffPlan) => void
}) {
  const plan = useMemo(() => {
    const xi = buildUserXI(club, ownedCardIds)
    const home = teamFromCards(club.name, club.shortName || 'YOU', club.kitPrimary, xi.cards)
    const opp = buildOpponent(cabinet, xi.strength, seat, nonce)
    const homeStrength: SquadStrength = squadStrength(home.xi)
    return { xi, home, opp, homeStrength }
  }, [club, ownedCardIds, cabinet, seat, nonce])



  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4"
    >
      <div className="grid gap-4 min-[900px]:grid-cols-[1fr_auto_1fr]">
        {/* ------------ your club ------------ */}
        <section className="flex flex-col gap-3 rounded-panel border border-line bg-panel p-4">
          <div className="flex items-center gap-2.5">
            <KitChips primary={club.kitPrimary} secondary={club.kitSecondary} />
            <div className="min-w-0">
              <div className="truncate font-display text-xl font-semibold uppercase tracking-[0.03em] text-wccf-ink">
                {club.name}
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px] text-wccf-mute tnum">
                <span className="rounded bg-accent-dim px-1 py-[1px] font-bold uppercase text-accent">
                  {club.shortName}
                </span>
                <span>RATING {club.rating}</span>
                <span className="text-wccf-dim">{club.formation}</span>
              </div>
            </div>
            <Shield size={16} className="ml-auto shrink-0 text-accent" aria-label="Your club" />
          </div>
          <div className="flex flex-col gap-[3px]">
            {plan.xi.slots.map((s) => (
              <XIRow
                key={s.position + s.card.id}
                position={s.position}
                name={s.card.name}
                total={cardTotal(s.card)}
                kp={s.kp}
                autoFilled={s.autoFilled}
                align="left"
              />
            ))}
          </div>
          {plan.xi.autoFilled > 0 && (
            <p className="rounded-btn border border-line bg-inset px-2.5 py-2 text-[11px] leading-snug text-wccf-dim">
              {plan.xi.autoFilled} empty slot{plan.xi.autoFilled > 1 ? 's were' : ' was'} auto-filled
              with your best position-compatible cards. Set your own XI in My Club.
            </p>
          )}
        </section>

        {/* ------------ VS + strength compare ------------ */}
        <section className="flex flex-col items-center justify-center gap-3 px-2">
          <span className="font-display text-[44px] font-bold uppercase leading-none tracking-[0.04em] text-wccf-mute">
            VS
          </span>
          <div className="flex w-44 flex-col gap-1.5 min-[900px]:w-40">
            <StrengthRow label="ATT" home={plan.homeStrength.attack} away={plan.opp.strength.attack} homeColor={club.kitPrimary} awayColor={plan.opp.team.color} />
            <StrengthRow label="MID" home={plan.homeStrength.midfield} away={plan.opp.strength.midfield} homeColor={club.kitPrimary} awayColor={plan.opp.team.color} />
            <StrengthRow label="DEF" home={plan.homeStrength.defense} away={plan.opp.strength.defense} homeColor={club.kitPrimary} awayColor={plan.opp.team.color} />
            <StrengthRow label="GK" home={plan.homeStrength.keeper} away={plan.opp.strength.keeper} homeColor={club.kitPrimary} awayColor={plan.opp.team.color} />
            <StrengthRow label="OVR" home={plan.homeStrength.overall} away={plan.opp.strength.overall} homeColor={club.kitPrimary} awayColor={plan.opp.team.color} />
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] text-wccf-mute">
            <span className="flex items-center gap-1">
              <i className="inline-block h-2 w-2 rounded-[2px]" style={{ backgroundColor: club.kitPrimary }} />
              {club.shortName}
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block h-2 w-2 rounded-[2px]" style={{ backgroundColor: plan.opp.team.color }} />
              {plan.opp.team.short}
            </span>
          </div>
        </section>

        {/* ------------ AI club ------------ */}
        <section className="flex flex-col gap-3 rounded-panel border border-line bg-panel p-4">
          <div className="flex items-center gap-2.5">
            <img
              src={plan.opp.club.avatar}
              alt=""
              className="h-8 w-8 rounded-full border border-line object-cover"
            />
            <div className="min-w-0">
              <div className="truncate font-display text-xl font-semibold uppercase tracking-[0.03em] text-wccf-ink">
                {plan.opp.club.club}
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px] text-wccf-mute tnum">
                <span className="rounded bg-raised px-1 py-[1px] font-bold uppercase text-wccf-dim">
                  {plan.opp.team.short}
                </span>
                <span>RATING {plan.opp.rating}</span>
                <span className="truncate">Mgr. {plan.opp.club.manager}</span>
              </div>
            </div>
            <Bot size={16} className="ml-auto shrink-0 text-wccf-dim" aria-label="AI club" />
          </div>
          <div className="flex flex-col gap-[3px]">
            {plan.opp.cards.map((c) => (
              <XIRow
                key={c.id}
                position={c.positions[0]}
                name={c.name}
                total={cardTotal(c)}
                align="right"
              />
            ))}
          </div>
          <p className="rounded-btn border border-line bg-inset px-2.5 py-2 text-[11px] leading-snug text-wccf-mute">
            AI club drawn from the {cabinet.version === 'all' ? 'Legends' : cabinet.version} card pool.
          </p>
        </section>
      </div>

      {/* ------------ pre-match (hexagons, era pickers, management, kick off) ------------ */}
      <PreMatch
        cabinet={cabinet}
        club={club}
        ownedCardIds={ownedCardIds}
        xi={plan.xi}
        home={plan.home}
        opp={plan.opp}
        onKickoff={onKickoff}
      />
    </motion.div>
  )
}
