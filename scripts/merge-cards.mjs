#!/usr/bin/env node
/**
 * merge-cards.mjs — builds public/data/cards.json from the curated sources.
 *
 * Sources:
 *   1. /mnt/agents/output/card-data/cards.json      — 1,856 cards (2011-12 … 2013-14)
 *   2. /mnt/agents/output/card-data/cards-new.json  — 2,731 cards (2015-16, 2017-18, footista-2019/2020/2021)
 *   3. scripts/data/serie-a-2001-02.json            — 198 reconstructed cards (2001-02 debut)
 *
 * All cards are normalized onto the app's 10-value Position union:
 *   GK CB LSB RSB DMF CMF OMF SMF FW CF
 * Mapping (deterministic, 1:1):
 *   GK→GK  CB→CB  CF→CF  DMF→DMF  CMF→CMF  OMF→OMF  FW→FW  SMF→SMF
 *   DF→CB  MF→CMF  ST→CF  WF→SMF  SB→LSB|RSB (id char-code hash: even→LSB, odd→RSB)
 *
 * Usage: node scripts/merge-cards.mjs
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = process.env.CARD_DATA_DIR ?? "/mnt/agents/output/card-data";
const sources = [
  path.join(SRC_DIR, "cards.json"),
  path.join(SRC_DIR, "cards-new.json"),
  path.join(root, "scripts", "data", "serie-a-2001-02.json"),
];

const POSITION_UNION = new Set(["GK", "CB", "LSB", "RSB", "DMF", "CMF", "OMF", "SMF", "FW", "CF"]);
const RARITY_ENUM = new Set(["REG", "SPE", "RAR", "WBE", "WGK", "MVP", "ATLE", "YS"]);
const POS_MAP = {
  GK: "GK", CB: "CB", LSB: "LSB", RSB: "RSB", DMF: "DMF", CMF: "CMF", OMF: "OMF", SMF: "SMF", FW: "FW", CF: "CF",
  DF: "CB", MF: "CMF", ST: "CF", WF: "SMF",
};

function normalizePosition(pos, id) {
  if (pos === "SB") {
    let h = 0;
    for (const ch of id) h = (h + ch.charCodeAt(0)) | 0;
    return (h & 1) === 0 ? "LSB" : "RSB";
  }
  const mapped = POS_MAP[pos];
  if (!mapped) throw new Error(`unknown position "${pos}" on card ${id}`);
  return mapped;
}

function fail(msg) {
  console.error(`merge-cards: FAIL — ${msg}`);
  process.exit(1);
}

const merged = [];
for (const src of sources) {
  const cards = JSON.parse(await readFile(src, "utf8"));
  console.log(`loaded ${cards.length} cards from ${path.basename(src)}`);
  merged.push(...cards);
}

/* ---- normalize + validate ---- */
const ids = new Set();
for (const c of merged) {
  if (ids.has(c.id)) fail(`duplicate id ${c.id}`);
  ids.add(c.id);
  if (!Array.isArray(c.positions) || c.positions.length === 0) fail(`card ${c.id} has no positions`);
  c.positions = c.positions.map((p) => normalizePosition(p, c.id));
  for (const p of c.positions) {
    if (!POSITION_UNION.has(p)) fail(`card ${c.id} position ${p} not in union`);
  }
  const s = c.stats;
  for (const k of ["off", "def", "tec", "pow", "spd", "sta"]) {
    if (!Number.isInteger(s[k]) || s[k] < 1 || s[k] > 20) fail(`card ${c.id} stat ${k}=${s[k]} out of 1–20`);
  }
  if (!RARITY_ENUM.has(c.rarity)) fail(`card ${c.id} rarity ${c.rarity} not in enum`);
  const sum = s.off + s.def + s.tec + s.pow + s.spd + s.sta;
  if (c.total !== undefined && c.total !== sum) fail(`card ${c.id} total ${c.total} != stat sum ${sum}`);
}

const dest = path.join(root, "public", "data", "cards.json");
await mkdir(path.dirname(dest), { recursive: true });
await writeFile(dest, JSON.stringify(merged), "utf8");

const byVersion = {};
for (const c of merged) byVersion[c.version] = (byVersion[c.version] ?? 0) + 1;
console.log(`\nwrote ${merged.length} cards -> public/data/cards.json (compact)`);
for (const [v, n] of Object.entries(byVersion).sort()) console.log(`  ${v}: ${n}`);
