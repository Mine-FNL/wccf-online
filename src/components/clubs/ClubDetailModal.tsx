import { useMemo } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import Modal from '@/components/Modal'
import PlayerCard from '@/components/PlayerCard'
import TrainingRadar from '@/components/club/TrainingRadar'
import { hashString, seededRand, type TrainingLevels } from '@/components/club/clubUtils'
import { allCards, cardTotal } from '@/lib/data/cards'
import type { PlayerCardData } from '@/lib/data/types'
import type { DisplayClub } from './displayClub'

/** Deterministic synthetic ambience (radar, form, signature cards). */
function useClubAmbience(club: DisplayClub | null) {
  return useMemo(() => {
    if (!club) return null
    const rand = seededRand(hashString(club.name))
    const training: TrainingLevels = {
      off: Math.floor(rand() * 6),
      def: Math.floor(rand() * 6),
      pas: Math.floor(rand() * 6),
      pos: Math.floor(rand() * 6),
      spe: Math.floor(rand() * 6),
      pow: Math.floor(rand() * 6),
    }
    /* recent form: draw from the club's real W/D/L ratios when available */
    const total = club.wins + club.draws + club.losses
    const pW = total > 0 ? club.wins / total : 0.38
    const pD = total > 0 ? club.draws / total : 0.24
    const form: ('W' | 'D' | 'L')[] = Array.from({ length: 5 }, () => {
      const r = rand()
      return r < pW ? 'W' : r < pW + pD ? 'D' : 'L'
    })
    /* signature cards: seeded top-total picks from the card pool */
    const pool = allCards()
    const signature: PlayerCardData[] = pool.length
      ? [...pool]
          .map((c) => ({ c, k: cardTotal(c) * 100 + Math.floor(rand() * 60) }))
          .sort((a, b) => b.k - a.k)
          .slice(0, 3)
          .map((r) => r.c)
      : []
    const trophies = Math.floor(rand() * 3)
    return { training, form, signature, trophies }
  }, [club])
}

const FORM_STYLE: Record<'W' | 'D' | 'L', string> = {
  W: 'border-[rgba(61,214,140,0.5)] bg-[rgba(61,214,140,0.12)] text-wccf-live',
  D: 'border-line-strong bg-raised text-wccf-dim',
  L: 'border-[rgba(255,77,79,0.5)] bg-[rgba(255,77,79,0.1)] text-wccf-danger',
}

/** Club detail modal — header, training radar, recent form, signature cards. */
export default function ClubDetailModal({
  club,
  onClose,
}: {
  club: DisplayClub | null
  onClose: () => void
}) {
  const amb = useClubAmbience(club)

  return (
    <Modal open={club !== null} onClose={onClose} widthClass="max-w-2xl">
      {club && amb && (
        <div>
          {/* header */}
          <div className="flex items-center gap-4">
            <img src={club.avatar} alt="" className="h-16 w-16 rounded-card border border-line object-cover" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate font-display text-[28px] font-bold uppercase leading-[0.95] tracking-[0.04em] text-wccf-ink">
                  {club.name}
                </h3>
                <span
                  className="rounded px-2 py-[2px] font-mono text-[11px] font-bold uppercase"
                  style={{ backgroundColor: `${club.kitPrimary}22`, color: club.kitPrimary }}
                >
                  {club.shortName}
                </span>
                {club.kind === 'sim' && (
                  <span className="rounded border border-dashed border-line-strong px-1.5 py-[1px] font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-wccf-mute">
                    House club
                  </span>
                )}
              </div>
              <p className="mt-1 font-mono text-[12px] text-wccf-mute">
                {club.manager ? `Manager ${club.manager} · ` : ''}
                {club.createdAt
                  ? `Founded ${club.createdAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`
                  : 'Cabinet regular'}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-wccf-mute">Rating</p>
              <p className="font-mono text-3xl font-bold leading-none text-accent tnum">{club.rating}</p>
            </div>
          </div>

          {/* record chips */}
          <div className="mt-4 flex flex-wrap gap-2 font-mono text-[12px] tnum">
            <span className="rounded-full bg-raised px-2.5 py-1 text-wccf-dim">
              <span className="text-wccf-live">W {club.wins}</span> · D {club.draws} ·{' '}
              <span className="text-wccf-danger">L {club.losses}</span>
            </span>
            <span className="rounded-full bg-raised px-2.5 py-1 text-wccf-dim">
              GF {club.goalsFor} / GA {club.goalsAgainst}
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-raised px-2.5 py-1 text-wccf-dim">
              Kit
              <span className="h-3 w-3 rounded-full border border-line" style={{ backgroundColor: club.kitPrimary }} />
              <span className="h-3 w-3 rounded-full border border-line" style={{ backgroundColor: club.kitSecondary }} />
            </span>
          </div>

          <div className="mt-5 grid items-start gap-5 min-[640px]:grid-cols-[220px_1fr]">
            {/* radar */}
            <div className="mx-auto">
              <p className="mb-1 text-center font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-wccf-mute">
                Training areas
              </p>
              <TrainingRadar levels={amb.training} size={210} />
            </div>

            <div className="flex flex-col gap-4">
              {/* recent form */}
              <div>
                <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-wccf-mute">
                  Recent form
                </p>
                <div className="flex gap-1.5">
                  {amb.form.map((f, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.06 * i, duration: 0.25, ease: 'easeOut' }}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-btn border font-mono text-[12px] font-bold',
                        FORM_STYLE[f],
                      )}
                    >
                      {f}
                    </motion.span>
                  ))}
                </div>
              </div>

              {/* trophy case */}
              <div>
                <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-wccf-mute">
                  Trophy case
                </p>
                <div className="flex gap-1.5">
                  {Array.from({ length: 4 }, (_, i) => (
                    <span
                      key={i}
                      title={i < amb.trophies ? 'Event winner' : 'No trophy yet'}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-btn border',
                        i < amb.trophies
                          ? 'border-[rgba(232,184,75,0.5)] bg-[rgba(232,184,75,0.1)] text-wccf-gold'
                          : 'border-line text-wccf-mute/50',
                      )}
                    >
                      <Trophy size={13} />
                    </span>
                  ))}
                </div>
              </div>

              {/* signature cards */}
              {amb.signature.length > 0 && (
                <div>
                  <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-wccf-mute">
                    Signature cards
                  </p>
                  <div className="flex gap-2">
                    {amb.signature.map((c) => (
                      <div key={c.id} className="transition-transform hover:-translate-y-1">
                        <PlayerCard card={c} size="sm" flippable={false} className="pointer-events-none" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Link
            to="/hall-of-fame"
            onClick={onClose}
            className="mt-5 block rounded-full border border-line-strong px-4 py-2 text-center text-[12px] font-bold uppercase tracking-[0.06em] text-wccf-dim transition-colors hover:border-accent hover:text-accent"
          >
            View in Hall of Fame
          </Link>
        </div>
      )}
    </Modal>
  )
}
