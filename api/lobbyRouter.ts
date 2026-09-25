import { z } from "zod";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { currentRecords, recentRecords } from "./queries/records";
import { topClubs } from "./queries/clubs";
import { listChatMessages, postChatMessage } from "./queries/chat";

export const recordsRouter = createRouter({
  /** Current holder per category (latest row per category). */
  list: publicQuery.query(() => currentRecords()),

  /** Latest 20 record rows across all categories (ticker). */
  recent: publicQuery.query(() => recentRecords(20)),
});

export const leaderboardRouter = createRouter({
  /** Top clubs by rating. */
  top: publicQuery
    .input(
      z.object({ limit: z.number().int().min(1).max(100).default(10) }).optional(),
    )
    .query(({ input }) => topClubs(input?.limit ?? 10)),
});

export const chatRouter = createRouter({
  /** Latest 50 lobby messages, oldest first. */
  list: publicQuery.query(() => listChatMessages(50)),

  post: authedQuery
    .input(z.object({ body: z.string().trim().min(1).max(280) }))
    .mutation(async ({ ctx, input }) => {
      const message = await postChatMessage(ctx.user, input.body);
      return { message };
    }),
});
