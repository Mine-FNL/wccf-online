import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { listMatchesByUser, reportMatch } from "./queries/matches";
import { scoutPull } from "./queries/scout";

const timelineEventSchema = z.object({
  min: z.number().min(0).max(130),
  type: z.string().max(20),
  team: z.string().max(10).optional(),
  player: z.string().max(60).optional(),
  detail: z.string().max(120).optional(),
});

export const matchRouter = createRouter({
  /**
   * Report a completed cabinet match. The server updates W/D/L, goals,
   * streak, ELO rating (K=32 vs opponentRating), pays out credits, grants a
   * weighted reward card, and checks the online records.
   */
  report: authedQuery
    .input(
      z.object({
        cabinetId: z.string().trim().min(1).max(30),
        cabinetVersion: z.string().trim().min(1).max(20),
        opponentName: z.string().trim().min(1).max(60),
        opponentRating: z.number().int().min(100).max(4000),
        scoreFor: z.number().int().min(0).max(12),
        scoreAgainst: z.number().int().min(0).max(12),
        timeline: z.array(timelineEventSchema).max(60).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { club, rewardCardId, recordsBroken } = await reportMatch(
        ctx.user.id,
        input,
      );
      return { club, rewardCardId, recordsBroken };
    }),

  /**
   * Recent match history for the signed-in user (Theatre page), newest first.
   */
  history: authedQuery
    .input(
      z
        .object({ limit: z.number().int().min(1).max(50).default(20) })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const list = await listMatchesByUser(ctx.user.id, input?.limit ?? 20);
      return { matches: list };
    }),
});

export const scoutRouter = createRouter({
  /**
   * Buy a 5-card scout pack. pro = 300 credits, elite = 900 credits
   * (rarity tables in api/queries/scout.ts).
   */
  pull: authedQuery
    .input(z.object({ tier: z.enum(["pro", "elite"]) }))
    .mutation(async ({ ctx, input }) => {
      const { club, cards } = await scoutPull(ctx.user.id, input.tier);
      return { club, cards };
    }),
});
