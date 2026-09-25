/** Unified club card shape for the directory (real DB clubs + house sims). */
export interface DisplayClub {
  key: string
  kind: 'real' | 'sim'
  name: string
  shortName: string
  kitPrimary: string
  kitSecondary: string
  rating: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  avatar: string
  /** real clubs only */
  createdAt?: Date
  /** sim clubs only */
  manager?: string
  online?: boolean
}
