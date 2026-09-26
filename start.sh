#!/bin/sh
# Supplies the two variables the server requires but that Railway does not
# provide itself:
#   APP_SECRET — signs session tokens. Generated once per deploy if absent.
#   AUTH_MODE  — "both" keeps guest entry plus Kimi sign-in when configured.
set -e

if [ -z "$APP_SECRET" ]; then
  APP_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  export APP_SECRET
  echo "APP_SECRET not set — generated an ephemeral one for this container."
  echo "Sessions will not survive a restart; set APP_SECRET in Railway to persist logins."
fi

: "${AUTH_MODE:=both}"
export AUTH_MODE
: "${VITE_AUTH_MODE:=$AUTH_MODE}"
export VITE_AUTH_MODE

# Create/refresh tables before accepting traffic (idempotent).
if [ -n "$DATABASE_URL" ]; then
  echo "Applying database schema…"
  npx drizzle-kit push --force || echo "WARN: schema push failed; starting anyway."
else
  echo "WARN: DATABASE_URL is not set — the API will fail on data queries."
fi

exec node dist/boot.js
