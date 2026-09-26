import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { createGuestLoginHandler } from "./guest/auth";
import { Paths } from "@contracts/constants";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// Liveness for Railway (and anything else): answers without touching the DB,
// so a healthy process is never restarted because of a slow query.
app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));

// Name-only entry, in the spirit of the arcade lobby: pick a name, take a seat.
if (env.guestEnabled) {
  app.post(Paths.guest, createGuestLoginHandler());
}

if (env.kimiEnabled) {
  app.get(Paths.oauthCallback, createOAuthCallbackHandler());
}

app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(
      `Auth mode: ${env.authMode} (guest=${env.guestEnabled}, kimi=${env.kimiEnabled})`,
    );
  });
}
