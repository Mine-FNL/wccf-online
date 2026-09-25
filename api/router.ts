import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { clubRouter, cardsRouter } from "./clubRouter";
import { matchRouter, scoutRouter } from "./matchRouter";
import { recordsRouter, leaderboardRouter, chatRouter } from "./lobbyRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,

  club: clubRouter,
  cards: cardsRouter,
  match: matchRouter,
  scout: scoutRouter,
  records: recordsRouter,
  leaderboard: leaderboardRouter,
  chat: chatRouter,
});

export type AppRouter = typeof appRouter;
