import { useMemo } from 'react'
import { motion } from 'framer-motion'
import PlayerCard from '@/components/PlayerCard'
import { cn } from '@/lib/utils'
import type { PlayerCardData } from '@/lib/data/types'

export interface PullEntry {
  id: string
  clubName: string
  avatar: string
  card: PlayerCardData
  time: string
  /** kira+ entries get the gold left border */
  hot: boolean
}

const DEMO_CLUBS = [
  'CalcioNova', 'Riviera FC', 'Kobe Steelworks', 'Porto Azul', 'Nordkap XI',
  'Estrella Roja', 'FC Halbzeit', 'Milano Notte', 'Albion Rovers', 'Santos Verde',
]

const DEMO_TIMES = ['just now', '2m', '6m', '11m', '18m', '27m', '41m', '1h', '2h', '3h']

function isHot(rarity: PlayerCardData['rarity']): boolean {
  return rarity !== 'REG' && rarity !== 'SPE'
}

/** Deterministic ambient demo pulls (stable across re-renders). */
export function makeDemoPulls(cards: PlayerCardData[]): PullEntry[] {
  if (cards.length === 0) return []
  // prefer flashier cards for the ambient rail
  const flashy = cards.filter((c) => isHot(c.rarity))
  const pool = flashy.length >= 6 ? flashy : cards
  return Array.from({ length: 10 }, (_, i) => {
    const card = pool[(i * 7 + 3) % pool.length]
    return {
      id: `demo-${i}-${card.id}`,
      clubName: DEMO_CLUBS[i % DEMO_CLUBS.length],
      avatar: `/avatar-${(i % 8) + 1}.png`,
      card,
      time: DEMO_TIMES[i % DEMO_TIMES.length],
      hot: isHot(card.rarity),
    }
  })
}

/**
 * "RECENT PULLS ACROSS THE LOBBY" — session pulls prepended live,
 * ambient demo pulls fill the rail. Capped at 20 entries.
 */
export default function PullsRail({ sessionPulls, demoPulls }: { sessionPulls: PullEntry[]; demoPulls: PullEntry[] }) {
  const entries = useMemo(() => [...sessionPulls, ...demoPulls].slice(0, 20), [sessionPulls, demoPulls])
  if (entries.length === 0) return null

  return (
    <section className="rounded-panel border border-line bg-panel">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-display text-[22px] font-semibold uppercase tracking-[0.06em] text-wccf-ink">
          Recent Pulls Across the Lobby
        </h2>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {entries.map((e) => (
          <motion.div
            key={e.id}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={cn(
              'flex shrink-0 items-center gap-2.5 rounded-card border border-line bg-raised/60 py-2 pl-2.5 pr-3',
              e.hot && 'border-l-2 border-l-wccf-gold',
            )}
          >
            <img src={e.avatar} alt="" className="h-6 w-6 rounded-full border border-line object-cover" />
            <div className="min-w-0">
              <p className="whitespace-nowrap text-[12px] leading-tight text-wccf-dim">
                <span className={cn('font-semibold', e.hot ? 'text-wccf-gold' : 'text-wccf-ink')}>{e.clubName}</span>{' '}
                pulled
              </p>
              <p className="whitespace-nowrap font-mono text-[10px] leading-tight text-wccf-mute tnum">{e.time}</p>
            </div>
            <PlayerCard card={e.card} size="xs" flippable={false} />
          </motion.div>
        ))}
      </div>
    </section>
  )
}
