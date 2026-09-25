import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Gift, Target } from 'lucide-react'
import { challengeCabinet, type CabinetChallenge } from './data'

/**
 * Per-cabinet weekly challenges — 2×2 grid, marquee thumbs dimmed with a
 * slow ken-burns on hover, accent progress bars that tween on load and tick
 * live while on the page (events.md §3).
 */
export default function CabinetChallenges({ challenges }: { challenges: CabinetChallenge[] }) {
  const [progress, setProgress] = useState<Record<string, number>>(() =>
    Object.fromEntries(challenges.map((c) => [c.cabinetId, c.start])),
  )

  /* live progress ticks while on page (demo: no backend for challenges) */
  useEffect(() => {
    const t = setInterval(() => {
      setProgress((prev) => {
        const pending = challenges.filter((c) => (prev[c.cabinetId] ?? 0) < c.target)
        if (pending.length === 0 || Math.random() > 0.35) return prev
        const pick = pending[Math.floor(Math.random() * pending.length)]
        return { ...prev, [pick.cabinetId]: (prev[pick.cabinetId] ?? 0) + 1 }
      })
    }, 6000)
    return () => clearInterval(t)
  }, [challenges])

  return (
    <div className="grid gap-3 min-[768px]:grid-cols-2">
      {challenges.map((c, i) => {
        const cab = challengeCabinet(c.cabinetId)
        const value = progress[c.cabinetId] ?? 0
        const done = value >= c.target
        return (
          <motion.div
            key={c.cabinetId}
            initial={{ y: 16, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ delay: i * 0.08, duration: 0.35, ease: 'easeOut' }}
            className="group overflow-hidden rounded-panel border border-line bg-panel"
          >
            {/* marquee thumb, dimmed; slow ken-burns on hover only */}
            <div className="relative h-[120px] overflow-hidden border-b border-line">
              <img
                src={cab.image}
                alt={cab.name}
                className="h-full w-full object-cover opacity-60 transition-opacity duration-300 group-hover:opacity-80 group-hover:animate-ken-burns"
                style={{ animationDuration: '12s' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-panel via-transparent to-transparent" />
              <div className="absolute bottom-2 left-3">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">
                  {cab.name} — {cab.badge}
                </div>
                <div className="font-display text-xl font-semibold uppercase tracking-[0.04em] text-wccf-ink">
                  {c.name}
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-center gap-1.5 text-[13px] text-wccf-dim">
                <Target size={13} className="text-accent" />
                {c.objective}
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: done ? '#3DD68C' : '#FF8A1E' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (value / c.target) * 100)}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
                <motion.span
                  key={value}
                  initial={{ scale: 1.25 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className="font-mono text-[12px] font-bold text-wccf-ink tnum"
                >
                  {value}/{c.target}
                </motion.span>
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-wccf-gold">
                <Gift size={13} />
                Reward: {c.reward}
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
