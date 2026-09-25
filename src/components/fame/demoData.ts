/**
 * Hall of Fame demo/ambient data + deterministic presentation helpers.
 * Used when the live leaderboard / records queries return empty (fresh DB),
 * following the lobby pattern: demo data stays until the backend has rows.
 */
import { AI_CLUBS } from '@/lib/data/aiClubs'

export const RECORD_LABELS: Record<string, string> = {
  TOP_RATING: 'HIGHEST TEAM RATING',
  MOST_GOALS_MATCH: 'MOST GOALS IN A MATCH',
  BIGGEST_WIN: 'BIGGEST WIN',
  LONGEST_UNBEATEN: 'LONGEST UNBEATEN STREAK',
}

export const RECORD_CATEGORIES = [
  'TOP_RATING',
  'MOST_GOALS_MATCH',
  'BIGGEST_WIN',
  'LONGEST_UNBEATEN',
] as const

/** Deterministic 32-bit hash for stable pseudo-random presentation. */
export function hash32(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const KIT_PALETTE = [
  '#FF8A1E',
  '#3DD68C',
  '#4DD0E1',
  '#E8B84B',
  '#FF3D71',
  '#7A5CFF',
  '#FF4D4F',
  '#1E7A4C',
]

/** Deterministic kit colors for a club name (leaderboard API has no kit fields). */
export function kitColorsFor(seed: string): { primary: string; secondary: string } {
  const h = hash32(seed)
  return {
    primary: KIT_PALETTE[h % KIT_PALETTE.length],
    secondary: KIT_PALETTE[(h >> 3) % KIT_PALETTE.length],
  }
}

/** Deterministic crest avatar for a club id/name. */
export function avatarFor(seed: string | number): string {
  const n = typeof seed === 'number' ? seed : hash32(seed)
  return `/avatar-${(Math.abs(n) % 8) + 1}.png`
}

/** Deterministic last-10 rating sparkline ending at `rating`. */
export function ratingHistory(seed: string, rating: number): number[] {
  const h = hash32(seed)
  const pts: number[] = []
  let r = rating - 40 - (h % 30)
  for (let i = 0; i < 10; i++) {
    const step = ((h >> (i * 2)) % 13) - 5 // -5..+7 drift upward
    r += step
    pts.push(r)
  }
  pts[9] = rating
  return pts
}

/** Unified leaderboard row for podium/table rendering (live or demo). */
export interface LeaderRow {
  rank: number
  id: number
  name: string
  shortName: string
  rating: number
  wins: number
  draws: number
  losses: number
  unbeatenStreak: number
  avatar: string
  kitPrimary: string
  kitSecondary: string
  history: number[]
  streak: { type: 'W' | 'L'; n: number } | null
  manager?: string
  goalsFor?: number
  demo?: boolean
}

interface ApiLeaderRow {
  rank: number
  id: number
  name: string
  shortName: string
  rating: number
  wins: number
  draws: number
  losses: number
  unbeatenStreak: number
}

/** Map a live leaderboard row to the UI shape (deterministic presentation fill). */
export function toLeaderRow(row: ApiLeaderRow): LeaderRow {
  const kit = kitColorsFor(row.name)
  return {
    ...row,
    avatar: avatarFor(row.id),
    kitPrimary: kit.primary,
    kitSecondary: kit.secondary,
    history: ratingHistory(row.name, row.rating),
    streak: row.unbeatenStreak > 0 ? { type: 'W', n: row.unbeatenStreak } : null,
  }
}

/** Map a demo row to the UI shape. */
export function demoToLeaderRow(row: DemoLeaderRow): LeaderRow {
  const kit = kitColorsFor(row.name)
  return {
    ...row,
    kitPrimary: kit.primary,
    kitSecondary: kit.secondary,
    history: ratingHistory(row.name, row.rating),
  }
}

/* ------------------------------------------------------------------ */
/* Demo leaderboard (fresh-DB fallback)                                */
/* ------------------------------------------------------------------ */

export interface DemoLeaderRow {
  rank: number
  id: number
  name: string
  shortName: string
  rating: number
  wins: number
  draws: number
  losses: number
  unbeatenStreak: number
  /* demo-only enrichment */
  manager: string
  avatar: string
  goalsFor: number
  streak: { type: 'W' | 'L'; n: number }
  demo: true
}

export function demoLeaderboard(): DemoLeaderRow[] {
  return AI_CLUBS.slice(0, 28).map((c, i) => {
    const h = hash32(c.club)
    const rating = 1892 - i * 21 - (h % 9)
    const wins = 34 - Math.floor(i * 0.9) + (h % 5)
    const draws = 6 + (h % 7)
    const losses = 8 + i + (h % 4)
    const streak: { type: 'W' | 'L'; n: number } =
      (h >> 4) % 3 === 0
        ? { type: 'L', n: 1 + ((h >> 6) % 3) }
        : { type: 'W', n: 2 + ((h >> 6) % 7) }
    return {
      rank: i + 1,
      id: 9000 + i,
      name: c.club,
      shortName: c.club.replace(/[^A-Z]/gi, '').slice(0, 3).toUpperCase() || 'FC',
      rating,
      wins,
      draws,
      losses,
      unbeatenStreak: streak.type === 'W' ? streak.n : 0,
      manager: c.manager,
      avatar: c.avatar,
      goalsFor: wins * 2 + draws + (h % 18),
      streak,
      demo: true,
    }
  })
}

/* ------------------------------------------------------------------ */
/* Demo record book (fresh-DB fallback)                                */
/* ------------------------------------------------------------------ */

export interface DemoRecordRow {
  id: number
  category: string
  holderClubName: string
  value: number
  detail: string
  createdAt: Date
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

export function demoRecords(): DemoRecordRow[] {
  return [
    {
      id: 101,
      category: 'TOP_RATING',
      holderClubName: 'CalcioNova',
      value: 1892,
      detail: 'peak after a 14-match unbeaten run',
      createdAt: daysAgo(2),
    },
    {
      id: 102,
      category: 'MOST_GOALS_MATCH',
      holderClubName: 'FC Stellar',
      value: 9,
      detail: '9–2 vs Dynamo Verge',
      createdAt: daysAgo(6),
    },
    {
      id: 103,
      category: 'BIGGEST_WIN',
      holderClubName: 'Leone Dorato',
      value: 8,
      detail: '8–0 vs Highvale Town',
      createdAt: daysAgo(11),
    },
    {
      id: 104,
      category: 'LONGEST_UNBEATEN',
      holderClubName: 'Nordvik IF',
      value: 22,
      detail: '22 matches without defeat',
      createdAt: daysAgo(19),
    },
  ]
}

export function demoTicker(): DemoRecordRow[] {
  return [
    {
      id: 201,
      category: 'MOST_GOALS_MATCH',
      holderClubName: 'CalcioNova',
      value: 9,
      detail: '9–1 vs AFC Kilmaine',
      createdAt: daysAgo(0),
    },
    ...demoRecords(),
    {
      id: 205,
      category: 'LONGEST_UNBEATEN',
      holderClubName: 'Torenstad FC',
      value: 18,
      detail: 'run ended by Kaiserwald XI',
      createdAt: daysAgo(23),
    },
    {
      id: 206,
      category: 'TOP_RATING',
      holderClubName: 'Porto Azul',
      value: 1874,
      detail: 'brief stay at the summit',
      createdAt: daysAgo(31),
    },
  ]
}
