/**
 * Events page demo data + date helpers (events.md).
 * No backend exists for events yet — content is presentational/demo.
 */
import { AI_CLUBS } from '@/lib/data/aiClubs'
import { CABINETS } from '@/lib/data/cabinets'

/** Next Sunday 20:00 local time (always in the future). */
export function nextSunday2000(from = new Date()): Date {
  const d = new Date(from)
  d.setHours(20, 0, 0, 0)
  const dow = d.getDay() // 0 = Sunday
  let add = (7 - dow) % 7
  if (add === 0 && d.getTime() <= from.getTime()) add = 7
  d.setDate(d.getDate() + add)
  return d
}

const addDays = (n: number, hour: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(hour, 0, 0, 0)
  return d
}

export const fmtDay = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
export const fmtTime = (d: Date) =>
  d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

/* ------------------------------------------------------------------ */
/* Upcoming events (events.md §2)                                      */
/* ------------------------------------------------------------------ */

export interface UpcomingEvent {
  id: string
  name: string
  banner: string
  start: Date
  end: Date
  host: string
  seats: number
  entry: string
  description: string
  status: 'open' | 'queued' | 'full'
  statusLabel: string
}

export const UPCOMING_EVENTS: UpcomingEvent[] = [
  {
    id: 'derby-night',
    name: 'Derby della Madonnina Night',
    banner: '/event-derby.png',
    start: addDays(5, 21),
    end: addDays(5, 23),
    host: 'WCCF 2011-12 — Intercontinental Clubs',
    seats: 16,
    entry: '120 credits',
    description: 'One night, one city: red-and-black vs blue-and-black. Milano-club cards only.',
    status: 'open',
    statusLabel: 'REGISTRATION OPEN',
  },
  {
    id: 'kira-rush',
    name: 'Kira Rush Weekend',
    banner: '/event-kira.png',
    start: addDays(12, 10),
    end: addDays(13, 22),
    host: 'All cabinets',
    seats: 64,
    entry: 'Free entry',
    description: 'Double kira odds on every scout tier for 48 hours. Shine or nothing.',
    status: 'queued',
    statusLabel: 'STARTS SOON',
  },
  {
    id: 'atle-masters',
    name: 'ATLE Masters',
    banner: '/event-intercontinental.png',
    start: addDays(19, 20),
    end: addDays(19, 23),
    host: 'WCCF LEGENDS — ATLE',
    seats: 8,
    entry: '250 credits',
    description: 'All-Time Legends only. Eight seats, vintage foil, zero mercy.',
    status: 'full',
    statusLabel: 'FULL',
  },
]

/* ------------------------------------------------------------------ */
/* Per-cabinet weekly challenges (events.md §3)                        */
/* ------------------------------------------------------------------ */

export interface CabinetChallenge {
  cabinetId: string
  name: string
  objective: string
  target: number
  start: number
  reward: string
}

export const CABINET_CHALLENGES: CabinetChallenge[] = [
  {
    cabinetId: 'ic-1112',
    name: 'Intercontinental Perfect Week',
    objective: 'Win 5 in a row at this cabinet',
    target: 5,
    start: 3,
    reward: 'Continental Scout pack',
  },
  {
    cabinetId: 'wccf-1213',
    name: 'World Clubs Triple',
    objective: 'Win 3 matches at this cabinet this week',
    target: 3,
    start: 1,
    reward: 'Elite Scout pack',
  },
  {
    cabinetId: 'wc-1314',
    name: 'Ver.3.0 Shutout Series',
    objective: 'Keep 3 clean sheets at this cabinet',
    target: 3,
    start: 2,
    reward: 'Pro Scout pack ×2',
  },
  {
    cabinetId: 'legends-atle',
    name: 'Legends Giant-Killing',
    objective: 'Beat a higher-rated club at this cabinet',
    target: 1,
    start: 0,
    reward: 'Kira-guaranteed pack',
  },
]

export function challengeCabinet(id: string) {
  return CABINETS.find((c) => c.id === id) ?? CABINETS[0]
}

/* ------------------------------------------------------------------ */
/* Past results strip (events.md §4)                                   */
/* ------------------------------------------------------------------ */

export interface PastResult {
  event: string
  winner: string
  avatar: string
  date: string
}

export const PAST_RESULTS: PastResult[] = [
  { event: 'Intercontinental Cup #11', winner: 'CalcioNova', avatar: '/avatar-3.png', date: 'Oct 12' },
  { event: 'Derby Night #4', winner: 'Albion Rovers 88', avatar: '/avatar-1.png', date: 'Oct 5' },
  { event: 'Kira Rush #7', winner: 'Leone Dorato', avatar: '/avatar-3.png', date: 'Sep 28' },
  { event: 'ATLE Masters #2', winner: 'Bastion 03', avatar: '/avatar-1.png', date: 'Sep 21' },
  { event: 'Rookie Cup #5', winner: 'Highvale Town', avatar: '/avatar-5.png', date: 'Sep 14' },
  { event: 'Intercontinental Cup #10', winner: 'Nordvik IF', avatar: '/avatar-4.png', date: 'Sep 7' },
  { event: 'Derby Night #3', winner: 'FC Stellar', avatar: '/avatar-2.png', date: 'Aug 31' },
  { event: 'World Clubs Sprint', winner: 'Stormvogels', avatar: '/avatar-6.png', date: 'Aug 24' },
]

/* ------------------------------------------------------------------ */
/* Demo 16-seat bracket (events.md §1 — Bracket modal)                 */
/* ------------------------------------------------------------------ */

/** rounds[0] = Round of 16 pairings, …, rounds[4] = champion (1 club). */
export function demoBracket(): string[][] {
  const seeds = AI_CLUBS.slice(0, 16).map((c) => c.club)
  const rounds: string[][] = [seeds]
  let current = seeds
  while (current.length > 1) {
    const next: string[] = []
    for (let i = 0; i < current.length; i += 2) {
      /* deterministic winner: stable hash of the pairing */
      const a = current[i]
      const b = current[i + 1]
      let h = 0
      for (const ch of a + b + String(rounds.length)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
      next.push(h % 2 === 0 ? a : b)
    }
    rounds.push(next)
    current = next
  }
  return rounds
}

export const BRACKET_ROUND_NAMES = ['Round of 16', 'Quarter-finals', 'Semi-finals', 'Final', 'Champion']
