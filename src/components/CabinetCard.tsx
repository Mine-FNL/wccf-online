import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { Mic, MonitorUp, RefreshCw, ScrollText, Shirt } from 'lucide-react'
import { cn } from '@/lib/utils'
import MatchViewer from './MatchViewer'
import SeatTile from './SeatTile'
import StatusPill from './StatusPill'
import Modal from './Modal'
import { useToast } from './Toast'
import type { Cabinet, SeatInfo } from '@/lib/data/cabinets'
import type { MatchTimeline } from '@/lib/engine'

const RULES = [
  'One club per seat — no multi-seating a cabinet.',
  'No queue sniping: a taken seat keeps its place in line.',
  'The cabinet ejects a reward card after every session — win or lose.',
  'Be decent in chat. Managers make the lobby.',
]

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * One lobby cabinet: header (name / version badge / signal / icons),
 * live MatchViewer, seat row + 8-seat grid, and the house button row.
 */
export default function CabinetCard({
  cabinet,
  timeline,
  clock,
  seats,
  nextKickoffIn,
  className,
}: {
  cabinet: Cabinet
  timeline: MatchTimeline
  clock: number
  seats: SeatInfo[]
  /** seconds until the cabinet's next match */
  nextKickoffIn: number
  className?: string
}) {
  const { toast } = useToast()
  const [taken, setTaken] = useState<Record<number, string>>({})
  const [confirmSeat, setConfirmSeat] = useState<number | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const merged = useMemo(
    () =>
      seats.map((s) =>
        taken[s.seat]
          ? { ...s, occupant: taken[s.seat], playing: true }
          : s,
      ),
    [seats, taken],
  )
  const openCount = merged.filter((s) => s.occupant === null).length

  const reconnect = () => {
    setConnecting(true)
    window.setTimeout(() => {
      setConnecting(false)
      toast('Sim reconnected — signal strong', 'success')
    }, 800)
  }

  const takeSeat = (seat: number) => {
    setTaken((t) => ({ ...t, [seat]: 'Your Club' }))
    setConfirmSeat(null)
    toast(`Seat ${seat} taken — ${cabinet.badge}`, 'gold')
  }

  return (
    <motion.section
      initial={{ y: 16, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn('flex flex-col gap-3 rounded-panel border border-line bg-panel p-4', className)}
    >
      {/* header */}
      <div className="flex items-center gap-2">
        <h2 className="relative font-display text-[19px] font-semibold uppercase tracking-[0.03em] text-accent">
          <span className="group/nm cursor-pointer" onClick={() => toast('Pop-out viewer coming with your account', 'info')}>
            {cabinet.name}
            <span className="absolute -bottom-[2px] left-0 h-[2px] w-0 bg-accent transition-all duration-200 group-hover/nm:w-full" />
          </span>
        </h2>
        {/* version badge + marquee popover */}
        <span className="group/badge relative">
          <span className="cursor-default rounded-full bg-accent-dim px-2 py-[3px] font-mono text-[10px] font-bold text-accent">
            {cabinet.badge}
          </span>
          <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-52 -translate-x-1/2 flex-col overflow-hidden rounded-card border border-line bg-panel shadow-modal group-hover/badge:flex">
            <img src={cabinet.image} alt="" className="aspect-video w-full object-cover" />
            <span className="px-2.5 py-2 text-[11px] leading-snug text-wccf-dim">{cabinet.flavor}</span>
          </span>
        </span>
        <StatusPill variant="strong" pulse className="ml-auto" />
        <button
          aria-label="Pop out viewer"
          title="Pop-out viewer"
          onClick={() => toast('Pop-out viewer coming with your account', 'info')}
          className="rounded-btn p-1.5 text-wccf-mute transition-colors hover:bg-raised hover:text-wccf-ink"
        >
          <MonitorUp size={14} />
        </button>
        <button
          aria-label="Reconnect sim"
          title="Reconnect sim"
          onClick={reconnect}
          className="rounded-btn p-1.5 text-wccf-mute transition-colors hover:bg-raised hover:text-wccf-ink"
        >
          <RefreshCw size={14} className={cn(connecting && 'animate-spin')} />
        </button>
      </div>

      {/* live match */}
      <MatchViewer
        timeline={timeline}
        clock={clock}
        connecting={connecting}
        seatContext={`${merged[0].occupant ?? '—'} v ${merged[1].occupant ?? '—'}`}
      />

      {/* seat row header */}
      <div className="flex items-center justify-between font-mono text-xs text-wccf-dim tnum">
        <span>
          <span className="font-bold text-wccf-live">{openCount} OPEN</span>
          <span className="text-wccf-mute"> / 8 seats</span>
        </span>
        <span>
          next match in <span className="text-wccf-ink">{formatCountdown(nextKickoffIn)}</span>
        </span>
      </div>

      {/* seat grid */}
      <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-4">
        {merged.map((s) => (
          <motion.span
            key={s.seat}
            initial={false}
            animate={taken[s.seat] ? { scale: [1.06, 1] } : {}}
            transition={{ duration: 0.25 }}
          >
            <SeatTile
              seatNumber={s.seat}
              occupant={s.occupant}
              playing={s.playing}
              onTakeSeat={(n) => setConfirmSeat(n)}
              className="w-full"
            />
          </motion.span>
        ))}
      </div>

      {/* house buttons */}
      <div className="flex gap-2">
        <Link
          to="/club"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-btn border border-line px-2 py-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-wccf-dim transition-colors hover:border-accent hover:text-wccf-ink"
        >
          <Shirt size={13} /> Your Club
        </Link>
        <a
          href="https://discord.com"
          target="_blank"
          rel="noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-btn border border-line px-2 py-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-wccf-dim transition-colors hover:border-accent hover:text-wccf-ink"
        >
          <Mic size={13} /> Join Voice
        </a>
        <button
          onClick={() => setRulesOpen(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-btn border border-line px-2 py-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-wccf-dim transition-colors hover:border-accent hover:text-wccf-ink"
        >
          <ScrollText size={13} /> House rules
        </button>
      </div>

      {/* confirm-seat modal */}
      <Modal
        open={confirmSeat !== null}
        onClose={() => setConfirmSeat(null)}
        title={`Take Seat ${confirmSeat ?? ''}?`}
      >
        <div className="flex flex-col gap-3 text-[13px] text-wccf-dim">
          <div className="rounded-btn border border-line bg-inset px-3 py-2.5 font-mono text-xs leading-relaxed tnum">
            <div>CLUB&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-wccf-ink">Your Club</span></div>
            <div>CABINET&nbsp;<span className="text-accent">{cabinet.name}</span></div>
            <div>QUEUE&nbsp;&nbsp;&nbsp;<span className="text-wccf-ink">#{Math.max(1, 8 - openCount + 1)} for the next match</span></div>
          </div>
          <p>
            Your starting XI loads from My Club when the current match ends.
            The cabinet ejects a reward card after your session.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => confirmSeat !== null && takeSeat(confirmSeat)}
              className="flex-1 rounded-btn bg-accent px-3 py-2 text-[12px] font-bold uppercase tracking-[0.06em] text-[#0B0E14] transition-colors hover:bg-accent-hover"
            >
              Take seat
            </button>
            <button
              onClick={() => setConfirmSeat(null)}
              className="rounded-btn border border-line px-3 py-2 text-[12px] font-bold uppercase tracking-[0.06em] text-wccf-dim transition-colors hover:border-line-strong hover:text-wccf-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* house rules modal */}
      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="House rules">
        <ul className="flex flex-col gap-2.5">
          {RULES.map((r, i) => (
            <li key={r} className="flex items-start gap-3 text-[13px] text-wccf-dim">
              <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accent font-mono text-[10px] font-bold text-accent">
                {i + 1}
              </span>
              {r}
            </li>
          ))}
        </ul>
      </Modal>
    </motion.section>
  )
}
