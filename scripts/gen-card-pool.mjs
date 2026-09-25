#!/usr/bin/env node
/**
 * Generates contracts/card-pool.json from public/data/cards.json.
 *
 * The server needs card rarity/position pools (starter squad grants, match
 * rewards, scout pulls) WITHOUT bundling the whole card database into api/.
 * This script strips each card down to the fields the server needs.
 *
 * Usage: node scripts/gen-card-pool.mjs
 * Re-run whenever public/data/cards.json changes (e.g. when the real card
 * database lands at final build).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "public", "data", "cards.json");
const outDir = path.join(root, "contracts");
const dest = path.join(outDir, "card-pool.json");

const cards = JSON.parse(await readFile(src, "utf8"));

const pool = cards.map((c) => ({
  id: c.id,
  name: c.name,
  rarity: c.rarity,
  positions: c.positions,
  version: c.version,
}));

await mkdir(outDir, { recursive: true });
await writeFile(dest, JSON.stringify(pool, null, 1) + "\n", "utf8");

const byRarity = {};
for (const c of pool) byRarity[c.rarity] = (byRarity[c.rarity] ?? 0) + 1;
console.log(
  `card-pool.json: ${pool.length} cards`,
  Object.entries(byRarity)
    .map(([r, n]) => `${r}:${n}`)
    .join(" "),
);
