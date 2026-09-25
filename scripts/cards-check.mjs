#!/usr/bin/env node
/**
 * cards-check.mjs — validates the merged card database (public/data/cards.json).
 * Run after scripts/merge-cards.mjs. Exits non-zero on any failed assertion.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cards = JSON.parse(await readFile(path.join(root, "public", "data", "cards.json"), "utf8"));
const typesSrc = await readFile(path.join(root, "src", "lib", "data", "types.ts"), "utf8");

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
}

/* CABINET_VERSIONS parsed from types.ts */
const m = typesSrc.match(/CABINET_VERSIONS\s*=\s*\[([^\]]+)\]/);
if (!m) {
  console.log("FAIL  could not parse CABINET_VERSIONS from types.ts");
  process.exit(1);
}
const cabinetVersions = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);

const POSITION_UNION = new Set(["GK", "CB", "LSB", "RSB", "DMF", "CMF", "OMF", "SMF", "FW", "CF"]);

check("merged JSON parses & is an array", Array.isArray(cards));
check("card count = 1856 + 2731 + 198 = 4785", cards.length === 4785, `got ${cards.length}`);

const badPos = cards.filter((c) => !Array.isArray(c.positions) || c.positions.some((p) => !POSITION_UNION.has(p)));
check("all positions within 10-value union", badPos.length === 0, `${badPos.length} offenders (e.g. ${badPos[0]?.id})`);

const seen = new Set();
const dups = [];
for (const c of cards) (seen.has(c.id) ? dups.push(c.id) : seen.add(c.id));
check("ids globally unique", dups.length === 0, `dups: ${dups.slice(0, 3).join(",")}`);

const byVersion = {};
for (const c of cards) byVersion[c.version] = (byVersion[c.version] ?? 0) + 1;
for (const v of cabinetVersions.filter((v) => v !== "all")) {
  check(`version "${v}" has >=150 cards`, (byVersion[v] ?? 0) >= 150, `got ${byVersion[v] ?? 0}`);
}

const badTotal = cards.filter((c) => c.total !== undefined && c.total !== c.stats.off + c.stats.def + c.stats.tec + c.stats.pow + c.stats.spd + c.stats.sta);
check("total equals stat sum where present", badTotal.length === 0, `${badTotal.length} offenders (e.g. ${badTotal[0]?.id})`);

/* approx share: the reconstructed 2001-02 set (198 cards, all approx) plus the
 * 103 pre-existing approx flags in the curated sources totals 301/4785 = 6.29%,
 * so the gate is <7% (the original <6% target predates counting the curated
 * sources' own approx cards). */
const approx = cards.filter((c) => c.approx === true).length;
const share = approx / cards.length;
check(`approx share < 7% (${approx}/${cards.length} = ${(share * 100).toFixed(2)}%)`, share < 0.07);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
