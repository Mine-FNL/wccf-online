import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import PlayerCard from '@/components/PlayerCard'
import { byId, cardTotal } from '@/lib/data/cards'
import type { PlayerCardData, Rarity } from '@/lib/data/types'
import {
  POSITION_GROUPS,
  cardPrimaryGroup,
  type OwnedEntry,
  type PositionGroup,
} from './clubUtils'
import CardDetailModal from './CardDetailModal'

const RARITY_FILTERS: { value: Rarity | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'REG', label: 'REG' },
  { value: 'SPE', label: 'SPE' },
  { value: 'RAR', label: 'Kira' },
  { value: 'WBE', label: 'WBE' },
  { value: 'WGK', label: 'WGK' },
  { value: 'MVP', label: 'MVP' },
  { value: 'ATLE', label: 'ATLE' },
  { value: 'YS', label: 'YS' },
]

type SortKey = 'total' | 'name' | 'newest' | 'cardNo'
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'Name' },
  { value: 'cardNo', label: 'Card No.' },
]

interface Row {
  entry: OwnedEntry
  card: PlayerCardData
}

export default function CollectionTab({ owned }: { owned: OwnedEntry[] }) {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<PositionGroup | 'ALL'>('ALL')
  const [rarity, setRarity] = useState<Rarity | 'ALL'>('ALL')
  const [version, setVersion] = useState<string>('ALL')
  const [sort, setSort] = useState<SortKey>('total')
  const [detail, setDetail] = useState<Row | null>(null)

  const versions = useMemo(() => {
    const set = new Set<string>()
    for (const e of owned) {
      const c = byId(e.cardId)
      if (c) set.add(c.version)
    }
    return [...set].sort()
  }, [owned])

  const rows = useMemo<Row[]>(() => {
    const needle = q.trim().toLowerCase()
    const list = owned
      .map((entry) => ({ entry, card: byId(entry.cardId) }))
      .filter((r): r is Row => !!r.card)
      .filter((r) => (group === 'ALL' ? true : cardPrimaryGroup(r.card) === group))
      .filter((r) => (rarity === 'ALL' ? true : r.card.rarity === rarity))
      .filter((r) => (version === 'ALL' ? true : r.card.version === version))
      .filter((r) =>
        needle
          ? r.card.name.toLowerCase().includes(needle) || r.card.club.toLowerCase().includes(needle)
          : true,
      )
    list.sort((a, b) => {
      switch (sort) {
        case 'total':
          return cardTotal(b.card) - cardTotal(a.card)
        case 'name':
          return a.card.name.localeCompare(b.card.name)
        case 'cardNo':
          return a.card.cardNo.localeCompare(b.card.cardNo)
        case 'newest':
          return b.entry.acquiredAt.getTime() - a.entry.acquiredAt.getTime()
      }
    })
    return list
  }, [owned, q, group, rarity, version, sort])

  const totalCopies = useMemo(() => owned.reduce((a, e) => a + e.count, 0), [owned])

  /* -------- empty collection -------- */
  if (owned.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-panel border border-line bg-panel px-6 py-14 text-center">
        <img src="/empty-collection.png" alt="" className="w-[300px] max-w-full opacity-90" />
        <p className="mt-6 max-w-md text-[14px] text-wccf-dim">
          No cards yet — take a seat in the lobby, the cabinet ejects one after every session.
        </p>
        <Link
          to="/"
          className="mt-5 rounded-full bg-accent px-5 py-2 text-[12px] font-bold uppercase tracking-[0.06em] text-[#0B0E14] transition-colors hover:bg-accent-hover"
        >
          Go to lobby
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-wccf-dim tnum">
          {totalCopies} cards · {rows.length} shown
        </span>
        <div className="relative ml-auto w-full min-[560px]:w-56">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-wccf-mute" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or club…"
            className="w-full rounded-btn border border-line bg-raised py-1.5 pl-8 pr-3 font-mono text-xs text-wccf-ink placeholder:text-wccf-mute focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* position group */}
        <div className="flex items-center gap-1">
          {(['ALL', ...POSITION_GROUPS] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={cn(
                'rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.06em] transition-colors',
                group === g
                  ? 'border-accent bg-accent-dim text-accent'
                  : 'border-line text-wccf-dim hover:border-line-strong hover:text-wccf-ink',
              )}
            >
              {g}
            </button>
          ))}
        </div>
        {/* rarity */}
        <div className="flex flex-wrap items-center gap-1">
          {RARITY_FILTERS.map((r) => (
            <button
              key={r.value}
              onClick={() => setRarity(r.value)}
              className={cn(
                'rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.06em] transition-colors',
                rarity === r.value
                  ? 'border-accent bg-accent-dim text-accent'
                  : 'border-line text-wccf-dim hover:border-line-strong hover:text-wccf-ink',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        {/* version + sort */}
        <div className="flex items-center gap-2">
          <select
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            aria-label="Filter by version"
            className="rounded-btn border border-line bg-raised px-2 py-1.5 font-mono text-[11px] text-wccf-ink focus:border-accent focus:outline-none"
          >
            <option value="ALL">All versions</option>
            {versions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort cards"
            className="rounded-btn border border-line bg-raised px-2 py-1.5 font-mono text-[11px] text-wccf-ink focus:border-accent focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* grid */}
      {rows.length === 0 ? (
        <p className="rounded-panel border border-line bg-panel py-12 text-center font-mono text-xs text-wccf-mute">
          No cards match these filters.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 min-[768px]:grid-cols-4 min-[1200px]:grid-cols-6">
          {rows.map((r, i) => (
            <motion.button
              key={r.card.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut', delay: Math.min(i, 12) * 0.03 }}
              whileHover={{ y: -4 }}
              onClick={() => setDetail(r)}
              className="group relative justify-self-center rounded-card"
              aria-label={`Inspect ${r.card.name}`}
            >
              <PlayerCard card={r.card} size="sm" flippable={false} className="pointer-events-none" />
              {r.entry.count > 1 && (
                <span className="absolute right-1 top-1 rounded bg-[#0B0E14]/85 px-1.5 py-[1px] font-mono text-[10px] font-bold text-accent tnum">
                  ×{r.entry.count}
                </span>
              )}
              <span className="pointer-events-none absolute inset-0 rounded-card border border-transparent transition-colors group-hover:border-accent/60" />
            </motion.button>
          ))}
        </div>
      )}

      <CardDetailModal
        card={detail?.card ?? null}
        meta={
          detail
            ? { source: detail.entry.source, acquiredAt: detail.entry.acquiredAt, count: detail.entry.count }
            : undefined
        }
        onClose={() => setDetail(null)}
      />
    </div>
  )
}
