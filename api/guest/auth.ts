import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "../lib/cookies";
import { signSessionToken } from "../kimi/session";
import { guestUnionId, markGuest, MIN_NAME, sanitiseName } from "./identity";
import { upsertGuestUser } from "../queries/users";

/**
 * Name-only sign-in.
 *
 * Mirrors the arcade-lobby pattern (play.johnreevesiii.com): a visitor picks a
 * display name and is immediately playing. No external identity provider, no
 * password. The name is normalised into a stable per-name identity so a player
 * who returns with the same name gets their club back.
 */
export function createGuestLoginHandler() {
  return async (c: Context) => {
    let raw: unknown;
    try {
      const body = (await c.req.json()) as { name?: unknown };
      raw = body?.name;
    } catch {
      return c.json({ error: "Expected a JSON body with a name" }, 400);
    }

    if (typeof raw !== "string") {
      return c.json({ error: "Name must be a string" }, 400);
    }

    const name = sanitiseName(raw);
    if (name.length < MIN_NAME) {
      return c.json(
        { error: `Name must be at least ${MIN_NAME} characters` },
        400,
      );
    }

    const unionId = guestUnionId(name);
    await upsertGuestUser({ unionId, name });

    const token = await signSessionToken({ unionId, clientId: "guest" });
    const cookieOpts = getSessionCookieOptions(c.req.raw.headers);
    setCookie(c, Session.cookieName, token, {
      ...cookieOpts,
      maxAge: Session.maxAgeMs / 1000,
    });
    markGuest(c);

    return c.json({ ok: true, name, unionId, mode: "guest" });
  };
}
