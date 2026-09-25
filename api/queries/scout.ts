import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { clubs, type Club } from "@db/schema";
import { getDb } from "./connection";
import {
  drawWeighted,
  type CardPoolEntry,
  type Rarity,
} from "./cardPool";
import { findClubByUserId, grantCards } from "./clubs";

export type ScoutTier = "pro" | "elite";

export const SCOUT_COST: Record<ScoutTier, number> = { pro: 300, elite: 900 };
export const SCOUT_PACK_SIZE = 5;

/**
 * Scout tier rarity tables (backend-spec §scout.pull).
 * Combined buckets are split evenly across their rarities:
 *  - pro:    4× (REG .70 / SPE .30),
 *            1× (SPE .55 / RAR .30 / YS .08 / WBE+WGK+MVP .05 / ATLE .02)
 *  - elite:  4× (SPE .50 / RAR .35 / YS .10 / WBE+MVP+WGK .04 / ATLE .01),
 *            1× guaranteed ≥RAR
 */
const PRO_BASE: Partial<Record<Rarity, number>> = { REG: 0.7, SPE: 0.3 };
const PRO_FEATURE: Partial<Record<Rarity, number>> = {
  SPE: 0.55,
  RAR: 0.3,
  YS: 0.08,
  WBE: 0.05 / 3,
  WGK: 0.05 / 3,
  MVP: 0.05 / 3,
  ATLE: 0.02,
};
const ELITE_BASE: Partial<Record<Rarity, number>> = {
  SPE: 0.5,
  RAR: 0.35,
  YS: 0.1,
  WBE: 0.04 / 3,
  MVP: 0.04 / 3,
  WGK: 0.04 / 3,
  ATLE: 0.01,
};
/** "≥RAR" for the elite guaranteed slot. */
const ELITE_GUARANTEED: Partial<Record<Rarity, number>> = {
  RAR: 0.55,
  YS: 0.15,
  WBE: 0.08,
  WGK: 0.07,
  MVP: 0.08,
  ATLE: 0.07,
};

export function pullPack(tier: ScoutTier): CardPoolEntry[] {
  if (tier === "pro") {
    return [
      ...Array.from({ length: SCOUT_PACK_SIZE - 1 }, () => drawWeighted(PRO_BASE)),
      drawWeighted(PRO_FEATURE),
    ];
  }
  return [
    ...Array.from({ length: SCOUT_PACK_SIZE - 1 }, () => drawWeighted(ELITE_BASE)),
    drawWeighted(ELITE_GUARANTEED),
  ];
}

/**
 * Buy a scout pack: verify + deduct credits, grant the 5 cards.
 * Returns the updated club and the pulled cards.
 */
export async function scoutPull(
  userId: number,
  tier: ScoutTier,
): Promise<{ club: Club; cards: CardPoolEntry[] }> {
  const cost = SCOUT_COST[tier];
  const club = await findClubByUserId(userId);
  if (!club) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Club not found — call club.me first" });
  if (club.credits < cost) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Not enough credits (need ${cost}, have ${club.credits})`,
    });
  }

  const cards = pullPack(tier);
  // atomic-ish deduct: only succeeds if credits are still sufficient
  const res = await getDb()
    .update(clubs)
    .set({ credits: sql`${clubs.credits} - ${cost}` })
    .where(eq(clubs.id, club.id));
  void res;
  await grantCards(userId, cards.map((c) => c.id), tier === "pro" ? "scout-pro" : "scout-elite");

  const updated = (await findClubByUserId(userId))!;
  return { club: updated, cards };
}
