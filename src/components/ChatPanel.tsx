/* eslint-disable react-refresh/only-export-components -- shared demo data + hooks intentionally co-located */
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, SendHorizonal, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LOGIN_PATH } from '@/const'

export interface ChatReaction {
  emoji: string
  count: number
  mine?: boolean
}

export interface ChatMessage {
  id: string | number
  kind: 'chat' | 'record'
  author?: string
  avatar?: string
  /** e.g. "2m" */
  ago?: string
  text: string
  reactions?: ChatReaction[]
}

export const REACTION_EMOJIS = ['👍', '⚽', '🔥', '🏆'] as const

/** Highlight @mentions with accent-dim chips. */
function MessageText({ text }: { text: string }) {
  const parts = text.split(/(@\w[\w-]*)/g)
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((p, i) =>
        p.startsWith('@') ? (
          <span key={i} className="rounded bg-accent-dim px-1 py-[1px] text-accent">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  )
}

function RecordCard({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ x: -16, opacity: 0, backgroundColor: 'rgba(232,184,75,0.25)' }}
      animate={{ x: 0, opacity: 1, backgroundColor: 'rgba(232,184,75,0)' }}
      transition={{ duration: 0.6 }}
      className="rounded-r-btn border-l-2 border-wccf-gold px-3 py-2"
    >
      <div className="flex items-start gap-2">
        <Trophy size={14} className="mt-[2px] shrink-0 text-wccf-gold" />
        <div className="text-[12.5px] leading-snug text-wccf-gold">{text}</div>
      </div>
    </motion.div>
  )
}

function MessageRow({ msg, onReact }: { msg: ChatMessage; onReact: (id: ChatMessage['id'], emoji: string) => void }) {
  const [picker, setPicker] = useState(false)
  return (
    <div
      className="group relative flex items-start gap-2"
      onMouseLeave={() => setPicker(false)}
    >
      <img
        src={msg.avatar ?? '/avatar-1.png'}
        alt=""
        className="mt-[2px] h-6 w-6 shrink-0 rounded-full border border-line object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[13px] font-semibold text-accent">{msg.author}</span>
          <span className="shrink-0 font-mono text-[10px] text-wccf-mute tnum">{msg.ago}</span>
        </div>
        <div className="text-[13.5px] leading-[1.55] text-wccf-ink">
          <MessageText text={msg.text} />
        </div>
        {(msg.reactions?.length ?? 0) > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {msg.reactions!.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(msg.id, r.emoji)}
                className={cn(
                  'flex items-center gap-1 rounded-full border bg-raised px-1.5 py-[2px] font-mono text-[10px] tnum',
                  r.mine ? 'border-accent text-wccf-ink' : 'border-line text-wccf-dim hover:border-line-strong',
                )}
              >
                <span>{r.emoji}</span>
                <span>{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {/* hover reaction "+" */}
      <div className="absolute -top-1 right-0 hidden group-hover:block">
        {picker ? (
          <div className="flex gap-0.5 rounded-full border border-line bg-panel px-1.5 py-1 shadow-modal">
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                className="rounded px-0.5 text-[13px] transition-transform hover:scale-125"
                onClick={() => { onReact(msg.id, e); setPicker(false) }}
              >
                {e}
              </button>
            ))}
          </div>
        ) : (
          <button
            aria-label="Add reaction"
            onClick={() => setPicker(true)}
            className="rounded-full border border-line bg-panel p-1 text-wccf-mute shadow-modal hover:text-wccf-ink"
          >
            <Plus size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Lobby chat panel (design.md §6). Data-driven: pass `messages`; for local
 * demo data see `demoChatFeed()`. Reactions are managed locally on top of the
 * incoming props; sending calls `onSend` and echoes locally until the
 * backend graft wires real chat.
 */
export default function ChatPanel({
  messages,
  onlineCount = 23,
  signedIn = false,
  onSend,
  className,
}: {
  messages: ChatMessage[]
  onlineCount?: number
  signedIn?: boolean
  onSend?: (text: string) => void
  className?: string
}) {
  const [draft, setDraft] = useState('')
  const [local, setLocal] = useState<ChatMessage[]>([])
  const [reacted, setReacted] = useState<Record<string, Record<string, number>>>({})
  const feedRef = useRef<HTMLDivElement>(null)

  const feed = [...messages, ...local]

  useEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [feed.length])

  const send = () => {
    const text = draft.trim()
    if (!text) return
    onSend?.(text)
    setLocal((xs) => [
      ...xs,
      { id: `me-${Date.now()}`, kind: 'chat', author: 'You', avatar: '/avatar-2.png', ago: 'now', text },
    ])
    setDraft('')
  }

  const react = (id: ChatMessage['id'], emoji: string) => {
    setReacted((m) => {
      const cur = m[String(id)] ?? {}
      return { ...m, [String(id)]: { ...cur, [emoji]: (cur[emoji] ?? 0) + 1 } }
    })
  }

  const withReactions = (msg: ChatMessage): ChatMessage => {
    const extra = reacted[String(msg.id)]
    if (!extra) return msg
    const map = new Map((msg.reactions ?? []).map((r) => [r.emoji, { ...r }]))
    for (const [emoji, n] of Object.entries(extra)) {
      const ex = map.get(emoji)
      if (ex) map.set(emoji, { ...ex, count: ex.count + n, mine: true })
      else map.set(emoji, { emoji, count: n, mine: true })
    }
    return { ...msg, reactions: [...map.values()] }
  }

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-panel border border-line bg-panel', className)}>
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <span className="font-display text-[16px] font-semibold uppercase tracking-[0.08em] text-wccf-ink">
          Lobby chat
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-wccf-live tnum">
          <span className="h-[6px] w-[6px] rounded-full bg-wccf-live animate-pulse-dot" />
          {onlineCount} online
        </span>
      </div>

      <div ref={feedRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
        <AnimatePresence initial={false}>
          {feed.map((m) =>
            m.kind === 'record' ? (
              <RecordCard key={m.id} text={m.text} />
            ) : (
              <motion.div
                key={m.id}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <MessageRow msg={withReactions(m)} onReact={react} />
              </motion.div>
            ),
          )}
        </AnimatePresence>
      </div>

      <div className="border-t border-line p-2.5">
        {signedIn ? (
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Message the lobby…"
              className="min-w-0 flex-1 rounded-btn border border-line bg-raised px-3 py-2 text-[13px] text-wccf-ink placeholder:text-wccf-mute focus:border-accent focus:outline-none"
            />
            <button
              aria-label="Send"
              onClick={send}
              className="rounded-btn bg-accent p-2 text-[#0B0E14] transition-colors hover:bg-accent-hover"
            >
              <SendHorizonal size={15} />
            </button>
          </div>
        ) : (
          <a
            href={LOGIN_PATH}
            className="block rounded-btn bg-accent px-3 py-2 text-center text-[12px] font-bold uppercase tracking-[0.08em] text-[#0B0E14] transition-colors hover:bg-accent-hover"
          >
            Sign in to chat
          </a>
        )}
      </div>
    </div>
  )
}

/** Local demo feed (used by the lobby until real chat lands). */
export function demoChatFeed(): ChatMessage[] {
  return [
    { id: 1, kind: 'chat', author: 'CalcioNova', avatar: '/avatar-3.png', ago: '12m', text: 'Just packed a kira IBRAHIMOVIĆ from the 2013-14 cabinet, the shine on these cards is unreal', reactions: [{ emoji: '🔥', count: 4 }] },
    { id: 2, kind: 'chat', author: 'Nordvik IF', avatar: '/avatar-4.png', ago: '11m', text: 'Seat 2 on World Clubs if anyone wants a race for it' },
    { id: 3, kind: 'record', text: 'New online record — CalcioNova: MOST GOALS IN A MATCH 9' },
    { id: 4, kind: 'chat', author: 'FC Stellar', avatar: '/avatar-2.png', ago: '9m', text: '@CalcioNova gg, my Buffon is still having nightmares' },
    { id: 5, kind: 'chat', author: 'Ember Athletic', avatar: '/avatar-7.png', ago: '8m', text: 'How are people training STA so fast? My front line is gassed by 70\'', reactions: [{ emoji: '👍', count: 2 }] },
    { id: 6, kind: 'chat', author: 'Lobos del Norte', avatar: '/avatar-8.png', ago: '7m', text: 'Rotate your squad between sessions and keep an eye on the stamina bars in the drawer @Ember Athletic' },
    { id: 7, kind: 'record', text: 'New online record — FC Stellar: LONGEST WIN STREAK 14' },
    { id: 8, kind: 'chat', author: 'Torenstad FC', avatar: '/avatar-5.png', ago: '5m', text: 'Legends cabinet is kira heaven, confirmed. Pulled ATLE Cantona' },
    { id: 9, kind: 'chat', author: 'Haruka FC', avatar: '/avatar-2.png', ago: '4m', text: 'Kagawa with a 90+3 winner on Intercontinental, this sim hates me 😭', reactions: [{ emoji: '⚽', count: 3 }] },
    { id: 10, kind: 'chat', author: 'Porto Azul', avatar: '/avatar-6.png', ago: '3m', text: 'Remember the card ejects after EVERY session, win or lose. Free packs basically' },
    { id: 11, kind: 'chat', author: 'Dynamo Verge', avatar: '/avatar-4.png', ago: '2m', text: 'Anyone up for voice? Discord link is on the cabinet card' },
    { id: 12, kind: 'record', text: 'New online record — Torenstad FC: MOST KIRA CARDS IN A WEEK 21' },
    { id: 13, kind: 'chat', author: 'Real Costena', avatar: '/avatar-6.png', ago: '1m', text: 'Theatre replays saved my season — watch your goals back and fix the shape' },
  ]
}
