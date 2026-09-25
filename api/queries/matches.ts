import { desc, eq } from "drizzle-orm";
import { clubs, matches, type Club, type Record } from "@db/schema";
import { getDb } from "./connection";
import { drawRewardCard, type CardPoolEntry } from "./cardPool";
import { findClubByUserId, grantCards } from "./clubs";
import { breakRecord } from "./records";

export const ELO_K = 32;
export const CREDITS_BASE = { W: 120, D: 60, L: 30 } as const;
export const CREDITS_PER_GOAL = 5;

export interface MatchReportInput {
  cabinetId: string;
  cabinetVersion: string;
  opponentName: string;
  opponentRating: number;
  scoreFor: number;
  scoreAgainst: number;
  timeline: unknown[];
}

export interface MatchReportResult {
  club: Club;
  rewardCardId: string;
  recordsBroken: Record[];
}

function eloNext(rating: number, opponentRating: number, score: 1 | 0.5 | 0) {
  const expected = 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
  return Math.round(rating + ELO_K * (score - expected));
}

/**
 * Apply a completed match to the user's club: W/D/L + goals + streak, ELO
 * rating update (K=32), credit payout, weighted reward card, record checks.
 */
export async function reportMatch(
  userId: number,
  input: MatchReportInput,
): Promise<MatchReportResult & { rewardCard: CardPoolEntry }> {
  const db = getDb();
  const club = await findClubByUserId(userId);
  if (!club) throw new Error("Club not found — call club.me first");

  const { scoreFor, scoreAgainst } = input;
  const result: "W" | "D" | "L" =
    scoreFor > scoreAgainst ? "W" : scoreFor < scoreAgainst ? "L" : "D";
  const eloScore = result === "W" ? 1 : result === "D" ? 0.5 : 0;
  const rating = eloNext(club.rating, input.opponentRating, eloScore);
  const unbeatenStreak = result === "L" ? 0 : club.unbeatenStreak + 1;
  const credits =
    club.credits + CREDITS_BASE[result] + CREDITS_PER_GOAL * scoreFor;

  const rewardCard = drawRewardCard();

  await db.transaction(async (tx) => {
    await tx
      .update(clubs)
      .set({
        rating,
        credits,
        wins: club.wins + (result === "W" ? 1 : 0),
        draws: club.draws + (result === "D" ? 1 : 0),
        losses: club.losses + (result === "L" ? 1 : 0),
        goalsFor: club.goalsFor + scoreFor,
        goalsAgainst: club.goalsAgainst + scoreAgainst,
        unbeatenStreak,
      })
      .where(eq(clubs.id, club.id));
    await tx.insert(matches).values({
      userId,
      cabinetId: input.cabinetId,
      cabinetVersion: input.cabinetVersion,
      opponentName: input.opponentName,
      scoreFor,
      scoreAgainst,
      result,
      timelineJson: input.timeline,
      rewardCardId: rewardCard.id,
    });
  });
  await grantCards(userId, [rewardCard.id], "reward");

  // Record checks — a NEW row is inserted each time a record is broken.
  const holder = { userId, clubName: club.name };
  const scoreline = `${scoreFor}–${scoreAgainst} vs ${input.opponentName}`;
  const broken = await Promise.all([
    breakRecord("MOST_GOALS_MATCH", holder, scoreFor, scoreline),
    breakRecord("BIGGEST_WIN", holder, scoreFor - scoreAgainst, scoreline),
    breakRecord(
      "LONGEST_UNBEATEN",
      holder,
      unbeatenStreak,
      `${unbeatenStreak} matches unbeaten`,
      2,
    ),
    breakRecord("TOP_RATING", holder, rating, `Rating ${rating}`),
  ]);
  const recordsBroken = broken.filter((r): r is Record => r !== null);

  const updated = (await findClubByUserId(userId))!;
  return { club: updated, rewardCardId: rewardCard.id, rewardCard, recordsBroken };
}

/** Recent matches for a user, newest first (Theatre page). */
export async function listMatchesByUser(userId: number, limit = 20) {
  const db = getDb();
  const safeLimit = Math.min(Math.max(Math.floor(limit) || 20, 1), 50);
  return db
    .select()
    .from(matches)
    .where(eq(matches.userId, userId))
    .orderBy(desc(matches.createdAt))
    .limit(safeLimit);
}
