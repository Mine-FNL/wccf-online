import { desc, eq, like, sql } from "drizzle-orm";
import { clubs, cardsOwned, type Club, type CardOwned } from "@db/schema";
import { getDb } from "./connection";
import { dealStarterSquad } from "./cardPool";

export const STARTER_CREDITS = 500;
export const STARTER_RATING = 1500;

export async function findClubByUserId(userId: number): Promise<Club | undefined> {
  return getDb().query.clubs.findFirst({ where: eq(clubs.userId, userId) });
}

/** Grant cards to a user (insert one cardsOwned row per copy). */
export async function grantCards(
  userId: number,
  cardIds: string[],
  source: "starter" | "reward" | "scout-pro" | "scout-elite",
) {
  if (cardIds.length === 0) return;
  await getDb()
    .insert(cardsOwned)
    .values(cardIds.map((cardId) => ({ userId, cardId, source })));
}

export async function listOwnedCards(userId: number): Promise<CardOwned[]> {
  return getDb()
    .select()
    .from(cardsOwned)
    .where(eq(cardsOwned.userId, userId));
}

/** Owned cards grouped with counts. */
export async function collectionWithCounts(userId: number) {
  const rows = await getDb()
    .select({
      cardId: cardsOwned.cardId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(cardsOwned)
    .where(eq(cardsOwned.userId, userId))
    .groupBy(cardsOwned.cardId)
    .orderBy(cardsOwned.cardId);
  return rows;
}

/**
 * Get the user's club; on first access create it and deal the 18-card
 * starter squad (see cardPool.dealStarterSquad). Returns club + collection.
 */
export async function getOrCreateClub(userId: number) {
  const db = getDb();
  const existing = await findClubByUserId(userId);
  if (existing) {
    const collection = await listOwnedCards(userId);
    return { club: existing, collection, created: false };
  }

  const [{ id }] = await db
    .insert(clubs)
    .values({
      userId,
      rating: STARTER_RATING,
      credits: STARTER_CREDITS,
      trainingJson: { off: 0, def: 0, pas: 0, pos: 0, spe: 0, pow: 0 },
      lineupJson: Array.from({ length: 11 }, (_, slot) => ({
        slot,
        cardId: null,
        kp: false,
      })),
    })
    .$returningId();

  const squad = dealStarterSquad();
  await grantCards(userId, squad.map((c) => c.id), "starter");

  const club = (await db.query.clubs.findFirst({ where: eq(clubs.id, id) }))!;
  const collection = await listOwnedCards(userId);
  return { club, collection, created: true };
}

export type ClubUpdate = Partial<
  Pick<
    Club,
    | "name"
    | "shortName"
    | "kitPrimary"
    | "kitSecondary"
    | "formation"
    | "lineupJson"
    | "trainingJson"
  >
>;

export async function updateClub(userId: number, patch: ClubUpdate) {
  const db = getDb();
  await db.update(clubs).set(patch).where(eq(clubs.userId, userId));
  return findClubByUserId(userId);
}

/** Paginated club directory, ordered by rating desc. */
export async function listClubs(q: string | undefined, limit: number, offset: number) {
  const db = getDb();
  const base = db
    .select({
      id: clubs.id,
      name: clubs.name,
      shortName: clubs.shortName,
      kitPrimary: clubs.kitPrimary,
      kitSecondary: clubs.kitSecondary,
      rating: clubs.rating,
      wins: clubs.wins,
      draws: clubs.draws,
      losses: clubs.losses,
      goalsFor: clubs.goalsFor,
      goalsAgainst: clubs.goalsAgainst,
      createdAt: clubs.createdAt,
    })
    .from(clubs)
    .$dynamic();
  const filtered = q ? base.where(like(clubs.name, `%${q}%`)) : base;
  return filtered
    .orderBy(desc(clubs.rating), desc(clubs.id))
    .limit(limit)
    .offset(offset);
}

/** Top clubs by rating (leaderboard). */
export async function topClubs(limit: number) {
  const rows = await getDb()
    .select({
      id: clubs.id,
      name: clubs.name,
      shortName: clubs.shortName,
      rating: clubs.rating,
      wins: clubs.wins,
      draws: clubs.draws,
      losses: clubs.losses,
      unbeatenStreak: clubs.unbeatenStreak,
    })
    .from(clubs)
    .orderBy(desc(clubs.rating), desc(clubs.id))
    .limit(limit);
  return rows.map((row, i) => ({ rank: i + 1, ...row }));
}
