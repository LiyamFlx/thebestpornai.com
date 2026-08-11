#!/usr/bin/env node
/**
 * publish-doctor.js — smoke-check catalog publish health (no network required).
 *
 *   npm run publish:doctor
 *   node scripts/publish-doctor.js
 *
 * Validates VIDEOS: unique positive integer ids, src shape, status, duplicate
 * srcs, poster coverage. Exit 1 on structural problems that would break the
 * viewer or a deploy; posters missing is a warning only.
 */
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = path.join(__dirname, "../src/shared/catalog-videos.js");

const { VIDEOS } = await import(pathToFileURL(CATALOG).href + "?t=" + Date.now());

if (!Array.isArray(VIDEOS) || !VIDEOS.length) {
  console.error("❌ VIDEOS is empty or not an array");
  process.exit(1);
}

const errors = [];
const warnings = [];
const ids = new Set();
const srcs = new Set();
let missingThumb = 0;
let maxId = 0;

for (const v of VIDEOS) {
  const label = v?.title || v?.id || "(unknown)";
  if (!Number.isInteger(v.id) || v.id <= 0 || !Number.isFinite(v.id)) {
    errors.push(`bad id on “${label}”: ${JSON.stringify(v.id)}`);
  } else {
    if (ids.has(v.id)) errors.push(`duplicate id ${v.id} (“${label}”)`);
    ids.add(v.id);
    if (v.id > maxId) maxId = v.id;
  }
  if (!v.src || typeof v.src !== "string" || !v.src.startsWith("../media/")) {
    errors.push(`id ${v.id}: src must start with "../media/" (got ${JSON.stringify(v.src)})`);
  } else if (srcs.has(v.src)) {
    // Historical catalog has many basename-level re-publishes; warn, don't fail CI.
    // New publishes should avoid this (publish-folder skips existing src).
    warnings.push(`duplicate src ${v.src} (id ${v.id})`);
  } else {
    srcs.add(v.src);
  }
  const status = v.status || "published";
  if (!["published", "private", "pending"].includes(status)) errors.push(`id ${v.id}: invalid status "${status}"`);
  if (!v.title) warnings.push(`id ${v.id}: empty title`);
  if (v.src && !v.thumb) missingThumb++;
}

const withThumb = VIDEOS.length - missingThumb;
const thumbPct = ((withThumb / VIDEOS.length) * 100).toFixed(1);

console.log("🩺 Publish doctor — catalog-videos.js");
console.log(`   entries:     ${VIDEOS.length}`);
console.log(`   unique ids:  ${ids.size} (max ${maxId})`);
console.log(`   posters:     ${withThumb}/${VIDEOS.length} (${thumbPct}%)`);
if (missingThumb) {
  warnings.push(`${missingThumb} entries missing thumb — run: npm run posters -- --dry-run`);
}

const dupSrcWarnings = warnings.filter(w => w.startsWith("duplicate src"));
const otherWarnings = warnings.filter(w => !w.startsWith("duplicate src"));
if (dupSrcWarnings.length) {
  console.log(`\n⚠ ${dupSrcWarnings.length} duplicate src path(s) (legacy; new publishes skip existing src).`);
}
if (otherWarnings.length) {
  console.log(`\n⚠ ${otherWarnings.length} other warning(s):`);
  for (const w of otherWarnings.slice(0, 20)) console.log(`   - ${w}`);
  if (otherWarnings.length > 20) console.log(`   … +${otherWarnings.length - 20} more`);
}

if (errors.length) {
  console.error(`\n❌ ${errors.length} error(s):`);
  for (const e of errors.slice(0, 40)) console.error(`   - ${e}`);
  if (errors.length > 40) console.error(`   … +${errors.length - 40} more`);
  process.exit(1);
}

console.log("\n✅ Catalog structure looks healthy.");
console.log(`
Operator checklist (batch publish):
  1. Drop files under media/<batch>/  (never commit .mp4)
  2. npm run publish -- "media/<batch>" --category "X" --tags "a,b" --dry-run
  3. npm run publish -- "media/<batch>" --category "X" --tags "a,b" [--limit 50]
  4. npm run publish:doctor
  5. npm run posters -- --dry-run   # if many missing thumbs
  6. npm run build && git add -A && git commit && git push
`);
