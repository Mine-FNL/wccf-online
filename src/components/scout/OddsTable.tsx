import { forwardRef } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { cn } from '@/lib/utils'
import { formatPct, RARITY_COLOR, RARITY_SHORT, SCOUT_COST, TIER_ODDS, type OddsRow, type ScoutTier } from './odds'

interface DisplayRow {
  label: string
  color: string
  p: number
}

/**
 * Collapse WBE+WGK+MVP into one combined bucket for display, except in the
 * elite guaranteed slot where the server splits them individually.
 */
function displayRows(rows: OddsRow[], combineTrio: boolean): DisplayRow[] {
  if (!combineTrio) {
    return rows.map((r) => ({ label: RARITY_SHORT[r.rarity], color: RARITY_COLOR[r.rarity], p: r.p }))
  }
  const out: DisplayRow[] = []
  let trio = 0
  for (const r of rows) {
    if (r.rarity === 'WBE' || r.rarity === 'WGK' || r.rarity === 'MVP') {
      trio += r.p
    } else {
      out.push({ label: RARITY_SHORT[r.rarity], color: RARITY_COLOR[r.rarity], p: r.p })
    }
  }
  if (trio > 0) {
    /* insert the combined bucket before ATLE if present, else at the end */
    const atleIdx = out.findIndex((o) => o.label === RARITY_SHORT.ATLE)
    const row: DisplayRow = { label: 'WBE / WGK / MVP', color: RARITY_COLOR.WBE, p: trio }
    if (atleIdx >= 0) out.splice(atleIdx, 0, row)
    else out.push(row)
  }
  return out
}

/**
 * Odds & drop table — one accordion row per tier, bars animate on expand.
 * Mirrors the server tables in api/queries/scout.ts exactly.
 */
const OddsTable = forwardRef<HTMLDivElement>(function OddsTable(_props, ref) {
  const tiers: { key: ScoutTier; name: string; blurb: string }[] = [
    { key: 'pro', name: 'Pro Scout', blurb: `${SCOUT_COST.pro} cr · 5 cards` },
    { key: 'elite', name: 'Elite Scout', blurb: `${SCOUT_COST.elite} cr · 5 cards · ≥ RAR guaranteed` },
  ]

  return (
    <div ref={ref} id="odds" className="rounded-panel border border-line bg-panel">
      <style>{`
        @keyframes odds-bar-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      `}</style>
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-display text-[22px] font-semibold uppercase tracking-[0.06em] text-wccf-ink">
          Odds &amp; Drop Table
        </h2>
        <p className="mt-0.5 font-mono text-[11px] text-wccf-mute">
          Odds are per card, per slot. Guaranteed floors per pack.
        </p>
      </div>

      <Accordion type="single" collapsible className="px-4">
        {tiers.map((t) => (
          <AccordionItem key={t.key} value={t.key} className="border-line">
            <AccordionTrigger className="py-3 hover:no-underline">
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-display text-lg font-semibold uppercase tracking-[0.05em] text-wccf-ink">
                  {t.name}
                </span>
                <span className="font-mono text-[11px] text-wccf-mute">{t.blurb}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-4 min-[820px]:grid-cols-2">
                {TIER_ODDS[t.key].map((slot) => {
                  const guaranteed = slot.label.includes('Guaranteed')
                  const rows = displayRows(slot.rows, !guaranteed)
                  const max = Math.max(...rows.map((r) => r.p))
                  return (
                    <div key={slot.label} className="rounded-card border border-line bg-raised/50 p-3">
                      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-wccf-dim">
                        {slot.label}
                      </span>
                      <p className="mt-0.5 text-[12px] text-wccf-mute">{slot.note}</p>
                      <div className="mt-2.5 flex flex-col gap-2">
                        {rows.map((row, idx) => (
                          <div key={row.label} className="flex items-center gap-2.5">
                            <span
                              className="flex w-[128px] shrink-0 items-center gap-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.05em]"
                              style={{ color: row.color }}
                            >
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                              <span className="truncate">{row.label}</span>
                            </span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                              <div
                                className={cn('h-full origin-left rounded-full')}
                                style={{
                                  width: `${(row.p / max) * 100}%`,
                                  backgroundColor: row.color,
                                  animation: `odds-bar-grow 0.5s ease-out ${idx * 0.05}s both`,
                                }}
                              />
                            </div>
                            <span className="w-12 shrink-0 text-right font-mono text-[11px] font-bold tnum text-wccf-ink">
                              {formatPct(row.p)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {!guaranteed && rows.some((r) => r.label === 'WBE / WGK / MVP') && (
                        <p className="mt-2 font-mono text-[10px] text-wccf-mute">
                          WBE / WGK / MVP is a combined bucket — split evenly across the three.
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="border-t border-line px-4 py-3">
        <p className="font-mono text-[11px] text-wccf-mute">
          World Legends (ATLE-only) returns during events — watch the lobby ticker.
        </p>
      </div>
    </div>
  )
})

export default OddsTable
