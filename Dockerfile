# WCCF Online — production image.
#
# The repo stores its binary/large assets base64-encoded under assets-b64/, so
# the build restores them first (cards.json, cabinet art, package-lock.json).
# The game itself is a self-contained React + Hono process; the only external
# dependency is MySQL (DATABASE_URL).

FROM node:22-slim AS build
WORKDIR /app

# Restore assets before installing: package-lock.json lives in assets-b64/.
COPY . .
RUN node scripts/restore-assets.mjs

# Install from the restored lockfile, then build client + server bundle.
RUN npm ci --no-audit --no-fund
RUN npm run build

# ---- runtime ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Only what the server needs at runtime: the built output, the restored assets
# it serves, and production dependencies.
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/db ./db
COPY --from=build /app/drizzle.config.ts ./
COPY --from=build /app/start.sh ./start.sh
RUN chmod +x ./start.sh

# Railway injects PORT; 3000 is only the local default.
EXPOSE 3000

CMD ["./start.sh"]
