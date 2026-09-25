/**
 * Theatre tape helpers — normalize a match row's timelineJson into a
 * scrubbable event tape and derive score / commentary from a playhead.
 *
 * Backend contract (api/matchRouter.ts): timelineJson is an array of
 * `{ min: number, type: string, team?: string, player?: string, detail?: string }`
 * with types goal / chance / booking / red / sub / ht / ft. We also tolerate
 * the engine vocabulary (yellow / halftime / fulltime / kickoff / kp / miss).
 */

/** One event on the tape. */
export interface TapeEvent {
  min: number
  type: string
  team?: string
  player?: string
  detail?: string
}

/** Shape of a row returned by trpc.match.history (createdAt via superjson). */
export interface TapeMatch {
  id: number
  cabinetId: string
  cabinetVersion: string
  opponentName: string
  scoreFor: number
  scoreAgainst: number
  result: string
  timelineJson: unknown
  rewardCardId: string
  createdAt: Date
}

export type TapeKind =
  | 'goal'
  | 'chance'
  | 'miss'
  | 'booking'
  | 'red'
  | 'sub'
  | 'kp'
  | 'ht'
  | 'ft'
  | 'kickoff'
  | 'info'

export type TapeSide = 'home' | 'away'

/** Normalize the raw event type string to a TapeKind. */
export function normKind(type: string): TapeKind {
  const k = type.toLowerCase()
  if (k === 'goal') return 'goal'
  if (k === 'chance' || k === 'shot' || k === 'save') return 'chance'
  if (k === 'miss') return 'miss'
  if (k === 'booking' || k === 'yellow' || k === 'card') return 'booking'
  if (k === 'red') return 'red'
  if (k === 'sub' || k === 'substitution') return 'sub'
  if (k === 'kp') return 'kp'
  if (k === 'ht' || k === 'halftime' || k === 'half-time') return 'ht'
  if (k === 'ft' || k === 'fulltime' || k === 'full-time') return 'ft'
  if (k === 'kickoff' || k === 'ko') return 'kickoff'
  return 'info'
}

/** Parse timelineJson (unknown from the API) into a sorted TapeEvent[]. */
export function parseTimeline(json: unknown): TapeEvent[] {
  if (!Array.isArray(json)) return []
  const out: TapeEvent[] = []
  for (const raw of json) {
    if (!raw || typeof raw !== 'object') continue
    const e = raw as Record<string, unknown>
    const min = Number(e.min)
    if (!Number.isFinite(min) || typeof e.type !== 'string') continue
    out.push({
      min,
      type: e.type,
      team: typeof e.team === 'string' ? e.team : undefined,
      player: typeof e.player === 'string' ? e.player : undefined,
      detail: typeof e.detail === 'string' ? e.detail : undefined,
    })
  }
  return out.sort((a, b) => a.min - b.min)
}

/** Which side an event belongs to ('home' = the signed-in club). */
export function eventSide(ev: TapeEvent, opponentName: string): TapeSide | null {
  const t = (ev.team ?? '').trim().toLowerCase()
  if (!t) return null
  if (t === 'home' || t === 'for' || t === 'us') return 'home'
  if (t === 'away' || t === 'opp' || t === 'against' || t === 'them') return 'away'
  const opp = opponentName.toLowerCase()
  if (opp && (opp.includes(t) || t.includes(opp.slice(0, 3)))) return 'away'
  return 'home'
}

/** Score at playhead minute t — counts goal events per side. */
export function scoreAt(
  events: TapeEvent[],
  t: number,
  opponentName: string,
): { home: number; away: number } {
  let home = 0
  let away = 0
  for (const ev of events) {
    if (ev.min > t) break
    if (normKind(ev.type) !== 'goal') continue
    if (eventSide(ev, opponentName) === 'away') away += 1
    else home += 1
  }
  return { home, away }
}

/** End of the tape — 90' or the last event, whichever is later. */
export function tapeEnd(events: TapeEvent[]): number {
  const last = events.length ? events[events.length - 1].min : 0
  return Math.max(90, Math.ceil(last))
}

/** Minute of the half-time marker, if any. */
export function htMinute(events: TapeEvent[]): number | null {
  const ht = events.find((e) => normKind(e.type) === 'ht')
  return ht ? ht.min : null
}

/** "34:12" style continuous match clock from a float minute. */
export function fmtClock(t: number): string {
  const clamped = Math.max(0, t)
  const mm = Math.floor(clamped)
  const ss = Math.floor((clamped - mm) * 60)
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

/** Rendered commentary line for one event. */
export function commentaryLine(
  ev: TapeEvent,
  homeName: string,
  awayName: string,
): string {
  if (ev.detail) return ev.detail
  const side = eventSide(ev, awayName)
  const teamName = side === 'away' ? awayName : homeName
  const who = ev.player ?? teamName
  switch (normKind(ev.type)) {
    case 'goal':
      return `GOAL! ${who} scores for ${teamName}!`
    case 'chance':
      return `Big chance — ${who} forces a strong save!`
    case 'miss':
      return `${who} drags it wide of the far post.`
    case 'booking':
      return `Yellow card — ${who} goes into the book.`
    case 'red':
      return `RED CARD! ${who} is sent off!`
    case 'sub':
      return `Substitution for ${teamName}${ev.player ? `: ${ev.player}` : ''}.`
    case 'kp':
      return `★ KP moment — ${who} raises the level!`
    case 'ht':
      return `Half-time — ${homeName} v ${awayName}.`
    case 'ft':
      return `Full-time — ${homeName} v ${awayName}.`
    case 'kickoff':
      return `We're underway — ${homeName} v ${awayName}.`
    default:
      return `${who} — ${ev.type}.`
  }
}

/** Deterministic opponent kit color from the club name. */
const OPP_PALETTE = ['#4DD0E1', '#FF3D71', '#E8B84B', '#7A5CFF', '#3DD68C', '#C9A86A']

export function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function opponentColor(name: string): string {
  return OPP_PALETTE[hashString(name) % OPP_PALETTE.length]
}

/** 3–4 letter broadcast abbreviation for a club name. */
export function shortOf(name: string): string {
  const clean = name.replace(/[^A-Za-z]/g, '').toUpperCase()
  return clean.slice(0, 3) || 'OPP'
}

/** Opponent crest avatar (deterministic pick from the avatar set). */
export function opponentAvatar(name: string): string {
  return `/avatar-${(hashString(name) % 8) + 1}.png`
}

/** "12 MAR 25" style short date for the history rail. */
export function fmtDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  const day = String(date.getDate()).padStart(2, '0')
  const mon = date.toLocaleString('en-US', { month: 'short' }).toUpperCase()
  const yr = String(date.getFullYear()).slice(2)
  return `${day} ${mon} ${yr}`
}

/** "2025-03" season-month key for the filter dropdown. */
export function monthKey(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
