import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Coins, Flame } from 'lucide-react'
import { crestFor, parseTraining, TRAINING_AREAS, type Club } from './clubUtils'

function useCountUp(target: number, duration = 900): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const step = (now: number) => {
      const f = Math.min(1, (now - start) / duration)
      setV(Math.round(target * (1 - Math.pow(1 - f, 3))))
      if (f < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return v
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-raised px-2.5 py-1 font-mono text-[12px] text-wccf-dim tnum">
      {children}
    </span>
  )
}

/**
 * Club header band — crest, name + shortName chip, kit colors, rating
 * (count-up), training mini bars, and stat chips.
 */
export default function ClubHeader({ club, cardCount }: { club: Club; cardCount: number }) {
  const rating = useCountUp(club.rating)
  const training = parseTraining(club.trainingJson)
  const played = club.wins + club.draws + club.losses
  const founded = club.createdAt instanceof Date ? club.createdAt : new Date(club.createdAt)

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="rounded-panel border border-line bg-panel p-4 min-[768px]:p-6"
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
        {/* identity */}
        <div className="flex min-w-0 items-center gap-4">
          <img
            src={crestFor(club.id)}
            alt=""
            className="h-14 w-14 rounded-card border border-line object-cover"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-[34px] font-bold uppercase leading-[0.95] tracking-[0.04em] text-wccf-ink">
                {club.name}
              </h1>
              <span className="rounded bg-accent-dim px-2 py-[2px] font-mono text-[11px] font-bold uppercase text-accent">
                {club.shortName}
              </span>
              {/* kit chips */}
              <span className="flex items-center gap-1" title="Kit colors">
                <span
                  className="h-4 w-4 rounded-full border border-line"
                  style={{ backgroundColor: club.kitPrimary }}
                />
                <span
                  className="h-4 w-4 rounded-full border border-line"
                  style={{ backgroundColor: club.kitSecondary }}
                />
              </span>
            </div>
            <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.06em] text-wccf-mute">
              Est. {founded.getFullYear()} · Cabinet regular
            </p>
          </div>
        </div>

        {/* rating + training mini bars */}
        <div className="flex items-center gap-5">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-wccf-mute">
              Club rating
            </p>
            <p className="font-mono text-4xl font-bold leading-none text-accent tnum">{rating}</p>
          </div>
          <div className="flex items-end gap-1.5">
            {TRAINING_AREAS.map((a, i) => (
              <div key={a.key} className="flex flex-col items-center gap-1" title={`${a.label} Lv. ${training[a.key]}`}>
                <div className="flex h-12 w-2 items-end overflow-hidden rounded-full bg-raised">
                  <motion.div
                    className="w-full rounded-full bg-accent"
                    initial={{ height: 0 }}
                    animate={{ height: `${(training[a.key] / 5) * 100}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: 0.06 * i }}
                  />
                </div>
                <span className="font-mono text-[8px] font-bold uppercase text-wccf-mute">
                  {a.label.slice(0, 3)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* stat chips */}
        <div className="flex flex-wrap items-center gap-2 min-[1200px]:ml-auto">
          <Chip>Played {played}</Chip>
          <Chip>
            <span className="text-wccf-live">W {club.wins}</span>
            <span className="mx-1 text-wccf-mute">·</span>
            <span>D {club.draws}</span>
            <span className="mx-1 text-wccf-mute">·</span>
            <span className="text-wccf-danger">L {club.losses}</span>
          </Chip>
          <Chip>
            GF {club.goalsFor} <span className="text-wccf-mute">/</span> GA {club.goalsAgainst}
          </Chip>
          {club.unbeatenStreak > 0 && (
            <Chip>
              <Flame size={11} className="mr-1 inline text-wccf-caution" />
              {club.unbeatenStreak} unbeaten
            </Chip>
          )}
          <Chip>Cards {cardCount}</Chip>
          <Chip>
            <Coins size={11} className="mr-1 inline text-wccf-gold" />
            <span className="text-wccf-gold">{club.credits.toLocaleString()} cr</span>
          </Chip>
        </div>
      </div>
    </motion.section>
  )
}
