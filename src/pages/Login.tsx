import { useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";

/** True when the build was told to offer guest entry. */
export const GUEST_ENABLED =
  (import.meta.env.VITE_AUTH_MODE ?? "both") !== "kimi";

/** True when the build was told to offer Kimi sign-in. */
export const KIMI_ENABLED =
  (import.meta.env.VITE_AUTH_MODE ?? "both") !== "guest" &&
  !!import.meta.env.VITE_KIMI_AUTH_URL;

function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL;
  const appID = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${kimiAuthUrl}/api/oauth/authorize`);
  url.searchParams.set("client_id", appID ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);

  return url.toString();
}

export default function Login() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function playAsGuest(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Pick a name of at least 2 characters");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/guest/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Sign-in failed (${res.status})`);
      }
      await utils.invalidate();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Take a seat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {GUEST_ENABLED && (
            <form onSubmit={playAsGuest} className="space-y-3">
              <label
                htmlFor="guest-name"
                className="block text-left text-[12px] font-semibold uppercase tracking-[0.06em] text-wccf-ink/70"
              >
                Your name
              </label>
              <input
                id="guest-name"
                name="name"
                type="text"
                autoComplete="nickname"
                maxLength={24}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kira"
                className="w-full rounded-btn border border-line bg-raised px-3 py-2 text-[14px] text-wccf-ink outline-none focus:border-accent"
              />
              {error && (
                <p role="alert" className="text-left text-[12px] text-red-400">
                  {error}
                </p>
              )}
              <Button className="w-full" size="lg" type="submit" disabled={busy}>
                {busy ? "Taking your seat…" : "Play now"}
              </Button>
              <p className="text-center text-[11px] text-wccf-ink/50">
                No account needed. Same name brings back your club.
              </p>
            </form>
          )}

          {GUEST_ENABLED && KIMI_ENABLED && (
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[11px] uppercase tracking-[0.08em] text-wccf-ink/40">
                or
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>
          )}

          {KIMI_ENABLED && (
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              onClick={() => {
                window.location.href = getOAuthUrl();
              }}
            >
              Sign in with Kimi
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
