import "dotenv/config";

/**
 * AUTH_MODE controls how players get in:
 *   "guest" — name-only entry (like play.johnreevesiii.com): anyone can play at
 *             once, no external identity provider needed.
 *   "kimi"  — Kimi OAuth only.
 *   "both"  — guest entry plus Kimi sign-in (default).
 */
const authMode = (process.env.AUTH_MODE ?? "both").toLowerCase();
const kimiEnabled = authMode === "kimi" || authMode === "both";
const guestEnabled = authMode === "guest" || authMode === "both";

function requiredWhen(cond: boolean, name: string): string {
  const value = process.env[name];
  if (cond && !value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  authMode,
  kimiEnabled,
  guestEnabled,
  appId: requiredWhen(kimiEnabled, "APP_ID"),
  // Session tokens (guest and Kimi alike) are signed with this.
  appSecret: requiredWhen(true, "APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: requiredWhen(true, "DATABASE_URL"),
  kimiAuthUrl: requiredWhen(kimiEnabled, "KIMI_AUTH_URL"),
  kimiOpenUrl: requiredWhen(kimiEnabled, "KIMI_OPEN_URL"),
  ownerUnionId: process.env.OWNER_UNION_ID ?? "",
};
