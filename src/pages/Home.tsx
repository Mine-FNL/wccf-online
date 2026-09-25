import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleDot, MessageSquare, Trophy, X } from 'lucide-react'
import CabinetCard from '@/components/CabinetCard'
import ChatPanel, { demoChatFeed, type ChatMessage } from '@/components/ChatPanel'
import { KeyCap, KEY_BINDINGS, SEAT_STEPS } from '@/components/HelpModal'
import SeatMatchFlow from '@/components/match/SeatMatchFlow'
import { useToast } from '@/components/Toast'
import { CABINETS, buildCabinetTeams, cabinetSeats, type Cabinet } from '@/lib/data/cabinets'
import { loadCards } from '@/lib/data/cards'
import { cabinetNow, createMatch, type MatchTimeline } from '@/lib/engine'
import { LOGIN_PATH } from '@/const'
import { useAuth } from '@/hooks/useAuth'
import { trpc } from '@/providers/trpc'

/* ------------------------------------------------------------------ */
/* Hero strip                                                          */
/* ------------------------------------------------------------------ */

function useCountUp(target: number, duration = 800): number {
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

function StaggerTitle({ text, accent }: { text: string; accent?: boolean }) {
  return (
    <span className={accent ? 'text-accent' : 'text-wccf-ink'}>
      {text.split('').map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.018 * i, duration: 0.4, ease: 'easeOut' }}
        >
          {ch === ' ' ? ' ' : ch}
        </motion.span>
      ))}
    </span>
  )
}

function HeroStrip() {
  const cabinets = useCountUp(CABINETS.length)
  const managers = useCountUp(23)
  const cards = useCountUp(1204)
  return (
    <section className="relative h-[140px] overflow-hidden border-b border-line">
      <div className="absolute inset-0">
        <img
          src="/hero-lobby-bg.png"
          alt=""
          className="h-full w-full object-cover opacity-[0.12] animate-ken-burns"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-base" />
      </div>
      <div className="relative mx-auto flex h-full max-w-shell items-end justify-between gap-6 px-4 pb-5">
        <div>
          <h1 className="font-display text-[44px] font-bold uppercase leading-[0.95] tracking-[0.04em]">
            <StaggerTitle text="World Club " />
            <StaggerTitle text="Champion Football" accent />
          </h1>
          <p className="mt-2 text-[15px] text-wccf-dim">
            Pick up a seat at the cabinet.
          </p>
        </div>
        <div className="hidden items-center gap-4 font-mono text-xs text-wccf-dim tnum min-[900px]:flex">
          <span className="flex items-center gap-1.5 text-wccf-live">
            <span className="h-[6px] w-[6px] rounded-full bg-wccf-live animate-pulse-dot" />
            {cabinets} cabinets live
          </span>
          <span>{managers} managers online</span>
          <span>{cards.toLocaleString()} cards ejected today</span>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Record ticker marquee                                               */
/* ------------------------------------------------------------------ */

const TICKER_ITEMS: { icon: 'trophy' | 'ball'; gold?: boolean; text: ReactNode }[] = [
  { icon: 'trophy', gold: true, text: 'New online record — CalcioNova: MOST GOALS IN A MATCH 9' },
  { icon: 'ball', text: 'FC Stellar took Seat 3 on WCCF 2011-12' },
  { icon: 'trophy', gold: true, text: 'New online record — Torenstad FC: MOST KIRA CARDS IN A WEEK 21' },
  { icon: 'ball', text: 'Lobos del Norte took Seat 1 on WCCF Legends — ATLE' },
  { icon: 'trophy', gold: true, text: 'New online record — Nordvik IF: LONGEST UNBEATEN RUN 22' },
  { icon: 'ball', text: 'Ember Athletic took Seat 6 on WCCF 2013-14' },
  { icon: 'trophy', gold: true, text: 'New online record — Haruka FC: FASTEST HAT-TRICK 11 MINUTES' },
  { icon: 'ball', text: 'Porto Azul took Seat 4 on WCCF Legends — ATLE' },
]

const RECORD_LABELS: Record<string, string> = {
  TOP_RATING: 'TOP RATING',
  MOST_GOALS_MATCH: 'MOST GOALS IN A MATCH',
  BIGGEST_WIN: 'BIGGEST WIN',
  LONGEST_UNBEATEN: 'LONGEST UNBEATEN RUN',
}

/** Record rows → ticker items (demo items stay when the DB is empty). */
function useTickerItems() {
  const recent = trpc.records.recent.useQuery(undefined, {
    refetchInterval: 10_000,
    retry: false,
  })
  return useMemo(() => {
    const rows = recent.data ?? []
    if (rows.length === 0) return TICKER_ITEMS
    return rows.map((r) => ({
      icon: 'trophy' as const,
      gold: true,
      text: `New online record — ${r.holderClubName}: ${RECORD_LABELS[r.category] ?? r.category} ${r.value}${r.detail ? ` (${r.detail})` : ''}`,
    }))
  }, [recent.data])
}

function Ticker() {
  const live = useTickerItems()
  const items = [...live, ...live]
  return (
    <div className="h-9 overflow-hidden border-b border-line bg-panel">
      <div className="marquee-track flex h-full w-max items-center gap-8 px-4 animate-marquee">
        {items.map((it, i) => (
          <span key={i} className="flex shrink-0 items-center gap-2 text-[12px]">
            {it.icon === 'trophy' ? (
              <Trophy size={12} className="text-wccf-gold" />
            ) : (
              <CircleDot size={12} className="text-accent" />
            )}
            <span className={it.gold ? 'font-semibold text-wccf-gold' : 'text-wccf-dim'}>
              {it.text}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Cabinet controls panel                                              */
/* ------------------------------------------------------------------ */

function ControlsPanel() {
  return (
    <motion.section
      initial={{ y: 16, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="rounded-panel border border-line bg-panel p-4"
    >
      <div className="grid gap-6 min-[900px]:grid-cols-2">
        <div>
          <h3 className="mb-3 font-display text-xl font-semibold uppercase tracking-[0.06em] text-wccf-ink">
            Cabinet controls
          </h3>
          <ul className="flex flex-col gap-2.5">
            {KEY_BINDINGS.map((b, i) => (
              <motion.li
                key={b.label}
                initial={{ x: -10, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
                className="flex items-center gap-3"
              >
                <span className="flex gap-1">
                  {b.keys.map((k) => (
                    <span key={k} className="transition-transform duration-100 hover:translate-y-[2px]">
                      <KeyCap label={k} />
                    </span>
                  ))}
                </span>
                <span className="text-[13px] text-wccf-dim">{b.label}</span>
              </motion.li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-display text-xl font-semibold uppercase tracking-[0.06em] text-wccf-ink">
            How a seat works
          </h3>
          <ol className="flex flex-col gap-2.5">
            {SEAT_STEPS.map((s, i) => (
              <motion.li
                key={s}
                initial={{ x: -10, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * i, duration: 0.3 }}
                className="flex items-center gap-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent font-mono text-[11px] font-bold text-accent">
                  {i + 1}
                </span>
                <span className="text-[13px] text-wccf-dim">{s}</span>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </motion.section>
  )
}

/* ------------------------------------------------------------------ */
/* Home — the lobby                                                    */
/* ------------------------------------------------------------------ */

/** "2m"-style relative timestamps for chat rows. */
function fmtAgo(date: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

/** Lobby chat rows from the backend; demo feed stays when DB is empty/signed out. */
function useLobbyChat() {
  const { isAuthenticated } = useAuth()
  const utils = trpc.useUtils()
  const list = trpc.chat.list.useQuery(undefined, {
    refetchInterval: 5_000,
    retry: false,
  })
  const post = trpc.chat.post.useMutation({
    onSuccess: () => utils.chat.list.invalidate(),
  })

  const messages: ChatMessage[] = useMemo(() => {
    const rows = list.data ?? []
    if (rows.length === 0) return demoChatFeed()
    return rows.map((m) => ({
      id: m.id,
      kind: 'chat' as const,
      author: m.name,
      avatar: `/avatar-${(m.avatarIdx % 8) + 1}.png`,
      ago: fmtAgo(m.createdAt),
      text: m.body,
    }))
  }, [list.data])

  const send = useMemo(
    () => (isAuthenticated ? (text: string) => post.mutate({ body: text }) : undefined),
    [isAuthenticated, post],
  )
  return { messages, signedIn: isAuthenticated, onSend: send }
}

export default function Home() {
  const [ready, setReady] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [chatDrawer, setChatDrawer] = useState(false)
  const chat = useLobbyChat()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { isAuthenticated } = useAuth()
  const [seatFlow, setSeatFlow] = useState<{ cabinet: Cabinet; seat: number } | null>(null)

  /**
   * Intercept OPEN seat-tile clicks before CabinetCard's own confirm modal
   * sees them (capture phase): signed-out → sign-in nudge; signed-in → the
   * full seat match flow. Occupied tiles are disabled buttons, so they never
   * reach this handler; all other cabinet buttons pass through untouched.
   */
  const onCabinetClickCapture = (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest('button')
    if (!btn) return
    const label = btn.querySelector('span')?.textContent?.trim() ?? ''
    const m = /^seat\s+(\d+)$/i.exec(label)
    if (!m) return
    const host = btn.closest('[data-cabinet-idx]')
    if (!host) return
    const cabinet = CABINETS[Number((host as HTMLElement).dataset.cabinetIdx)]
    if (!cabinet) return
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated) {
      toast('Sign in to take a seat at the cabinet', 'info')
      navigate(LOGIN_PATH)
      return
    }
    setSeatFlow({ cabinet, seat: Number(m[1]) })
  }

  useEffect(() => {
    void loadCards().then(() => setReady(true))
  }, [])
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  /* shared wall-clock sync per cabinet — everyone sees the same match */
  const syncs = useMemo(() => CABINETS.map((c) => cabinetNow(c.id, now)), [now])
  const epochsKey = syncs.map((s) => s.epoch).join(',')

  const timelines: (MatchTimeline | null)[] = useMemo(() => {
    if (!ready) return CABINETS.map(() => null)
    return CABINETS.map((c, i) => {
      const sync = syncs[i]
      const seats = cabinetSeats(c.id, sync.epoch)
      const teams = buildCabinetTeams(
        c,
        sync.seed,
        seats[0].occupant ?? 'Home XI',
        seats[1].occupant ?? 'Away XI',
      )
      return createMatch(sync.seed, teams.home, teams.away)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, epochsKey])

  return (
    <div>
      <HeroStrip />
      <Ticker />

      <div className="mx-auto flex max-w-shell items-start gap-6 px-4 pt-6">
        {/* cabinet grid */}
        <div
          id="live"
          onClickCapture={onCabinetClickCapture}
          className="grid min-w-0 flex-1 scroll-mt-20 grid-cols-1 gap-4 min-[768px]:grid-cols-2 min-[1200px]:grid-cols-3"
        >
          {CABINETS.map((c, i) =>
            timelines[i] ? (
              <div key={c.id} data-cabinet-idx={i}>
                <CabinetCard
                  cabinet={c}
                  timeline={timelines[i]!}
                  clock={syncs[i].clock}
                  seats={cabinetSeats(c.id, syncs[i].epoch)}
                  nextKickoffIn={
                    syncs[i].clock < 0
                      ? -syncs[i].clock
                      : Math.max(0, timelines[i]!.duration - syncs[i].clock)
                  }
                />
              </div>
            ) : (
              <div
                key={c.id}
                className="flex aspect-[4/5] items-center justify-center rounded-panel border border-line bg-panel"
              >
                <span className="font-mono text-xs text-wccf-mute">Warming up the cabinet…</span>
              </div>
            ),
          )}
        </div>

        {/* chat rail — fixed 340px ≥1100px */}
        <aside className="sticky top-[72px] hidden h-[calc(100dvh-88px)] w-[340px] shrink-0 min-[1100px]:block">
          <ChatPanel messages={chat.messages} onlineCount={23} signedIn={chat.signedIn} onSend={chat.onSend} className="h-full" />
        </aside>
      </div>

      {/* floating chat button <1100px */}
      <button
        aria-label="Open lobby chat"
        onClick={() => setChatDrawer(true)}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-panel text-wccf-ink shadow-modal min-[1100px]:hidden"
      >
        <MessageSquare size={18} />
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-wccf-danger px-1 font-mono text-[9px] font-bold text-white">
          3
        </span>
      </button>
      <AnimatePresence>
        {chatDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[rgba(4,6,10,0.6)] backdrop-blur-sm min-[1100px]:hidden"
            onClick={() => setChatDrawer(false)}
          >
            <motion.div
              initial={{ x: 340 }}
              animate={{ x: 0 }}
              exit={{ x: 340 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="absolute inset-y-0 right-0 w-[min(340px,90vw)] bg-base p-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex justify-end">
                <button aria-label="Close chat" onClick={() => setChatDrawer(false)} className="rounded-btn p-1.5 text-wccf-mute hover:text-wccf-ink">
                  <X size={16} />
                </button>
              </div>
              <ChatPanel messages={chat.messages} onlineCount={23} signedIn={chat.signedIn} onSend={chat.onSend} className="h-[calc(100%-44px)]" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-shell px-4 pt-6">
        <ControlsPanel />
      </div>

      {/* cabinet seat gameplay flow (lobby stays mounted underneath) */}
      <AnimatePresence>
        {seatFlow && (
          <SeatMatchFlow
            key={seatFlow.cabinet.id}
            cabinet={seatFlow.cabinet}
            seat={seatFlow.seat}
            onClose={() => setSeatFlow(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
