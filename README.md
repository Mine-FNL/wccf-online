# WCCF Online

A faithful online recreation of Sega's **World Club Champion Football (WCCF)** — the
collectible-card football manager that ran in arcades from **2002 (Serie A debut) to
2021 (Footista finale)** — in the spirit of
[play.johnreevesiii.com](https://play.johnreevesiii.com) (Derby Owners Club Online).

Insert a coin, sit at a cabinet, arrange your cards on the flat panel, play the match,
and win a reward card after every session.

## What's inside

- **4,785 real cards** across 9 versions (WCCF 2002-03 through Footista 2021) with real
  positions, ratings and special traits (`public/data/cards.json`)
- **8 era-accurate cabinets**, each with the original button layout and trim art —
  from the 2002 Serie A machine to the 2019 Footista cabinet
- **Original match engine**: interactive stepper (`src/engine2/`) recreating the real
  WCCF gameplay — offense/defense flow, buttons during play (shoot/pass/pressure),
  cards as the players on the pitch
- **Flat-panel arrangement editor** — drag your cards exactly like the real machine's
  touch panel; formation, set-piece taker, captain
- **Reward card after every session**, drawn from the full card pool
- **Accounts + shared Hall of Fame** — cloud save, persistent squads, global legends
- Online lobby with cabinet occupancy, just like the arcade row

## Getting started

```bash
npm install
node scripts/restore-assets.mjs   # restore binary assets (images + card DB) from assets-b64/
cp .env.example .env              # set DATABASE_URL (MySQL)
npm run db:push                   # create tables
npm run dev                       # http://localhost:5173
```

Production:

```bash
npm run build
npm start                         # serves frontend + API on $PORT
```

## Repo layout

| Path | What |
|---|---|
| `src/` | React frontend — lobby, consoles, arrangement panel, match stepper |
| `src/engine2/` | Faithful WCCF match engine (interactive, button-driven) |
| `api/` | Hono + tRPC server (auth, saves, hall of fame, reward cards) |
| `db/` | Drizzle ORM schema + migrations (MySQL) |
| `contracts/` | Shared client/server contracts incl. the reward card pool |
| `public/` | Cabinet art + `data/cards.json` (restored by script) |
| `scripts/restore-assets.mjs` | Decodes `assets-b64/` back into the binary assets |

Binary assets (images, the 4,785-card database, `package-lock.json`) are stored
base64-encoded under `assets-b64/` and restored by `node scripts/restore-assets.mjs`.

## Tech stack

React 19 · TypeScript · Vite 7 · Tailwind + shadcn/ui · Hono · tRPC · Drizzle ORM ·
MySQL · Node 20

## Disclaimer

Fan-made preservation project. WCCF, Footista and all card data are properties of
Sega. Not affiliated with or endorsed by Sega.
