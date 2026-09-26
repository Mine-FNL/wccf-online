import { createHash } from "node:crypto";
import type { Context } from "hono";

/**
 * Guest identities — pure helpers, no database imports, so they are testable
 * without a live MySQL connection.
 */

export const MAX_NAME = 24;
export const MIN_NAME = 2;

/** Strip control characters / markup-ish noise; collapse whitespace. */
export function sanitiseName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME);
}

/**
 * A guest is identified by their display name. We derive a stable, namespaced
 * unionId from it so that:
 *   - returning with the same name restores the same club;
 *   - a guest can never collide with a real provider's unionId (the "guest:"
 *     prefix makes that impossible);
 *   - no personal data beyond the chosen name is stored.
 */
export function guestUnionId(name: string): string {
  const normalised = name.trim().toLowerCase().replace(/\s+/g, " ");
  const digest = createHash("sha256").update(normalised).digest("hex");
  return `guest:${digest.slice(0, 32)}`;
}

/** Marks the response as a guest session so the UI can label it. */
export function markGuest(c: Context): void {
  c.header("X-WCCF-Mode", "guest");
}
