#!/usr/bin/env node
/**
 * Restores binary/large assets that are stored base64-encoded under
 * `assets-b64/` (the initial GitHub upload channel was text-only).
 *
 * Layout:   assets-b64/<original path>.b64.part-000, .part-001, ...
 *           assets-b64/<original path>.gz.b64.part-000 ... (gzip-compressed text)
 *
 * Usage:    node scripts/restore-assets.mjs
 * Re-runs are idempotent. Requires Node 18+.
 */
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { gunzipSync } from "node:zlib";

const SRC = new URL("../assets-b64/", import.meta.url).pathname;
const DEST = new URL("../", import.meta.url).pathname;

/** Recursively collect files under dir. */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const files = walk(SRC).filter((f) => /\.part-\d+$/.test(f));
if (files.length === 0) {
  console.log("No asset chunks found under assets-b64/ — nothing to do.");
  process.exit(0);
}

// Group chunk files by their target: strip ".part-NNN"
const groups = new Map();
for (const f of files) {
  const key = f.replace(/\.part-\d+$/, "");
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(f);
}

let restored = 0;
for (const [key, parts] of groups) {
  parts.sort();
  const b64 = parts
    .map((p) => readFileSync(p, "utf8").replace(/\s+/g, ""))
    .join("");
  let buf = Buffer.from(b64, "base64");
  let rel = key.slice(SRC.length); // e.g. "public/hero-lobby-bg.png.b64"
  rel = rel.replace(/\.b64$/, "");
  if (rel.endsWith(".gz")) {
    buf = gunzipSync(buf);
    rel = rel.replace(/\.gz$/, "");
  }
  const dest = join(DEST, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  console.log(`restored ${rel} (${buf.length} bytes, ${parts.length} parts)`);
  restored++;
}
console.log(`\nDone — ${restored} assets restored.`);
