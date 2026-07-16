#!/usr/bin/env node
/**
 * Generate catalog.js video entries from a local media subfolder.
 *
 * Unlike add-bunny-folder.js (which listed Bunny storage), this reads the LOCAL
 * files under ./media/<folder> — the source of truth now that we've migrated off
 * the suspended Bunny to Cloudflare R2. The `src` it emits is the same
 * "../media/<folder>/<file>" shape the viewer already understands; mediaUrl()
 * rewrites that against MEDIA_BASE (the R2 domain) at render time.
 *
 * Usage:
 *   node scripts/gen-catalog-from-local.js "new balk uplode" --category "AI" --start-id 900
 *
 * Prints a ready-to-paste JS array. Does NOT modify catalog.js (paste manually,
 * or pipe — kept non-destructive after the earlier add-bunny-folder patch incident).
 */
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const folder = args[0];
if (!folder) { console.error("usage: gen-catalog-from-local.js <folder> [--category X] [--start-id N]"); process.exit(1); }

let category = "AI";
let startId = 900;
for (let i = 1; i < args.length; i++) {
  if (args[i] === "--category" && args[i + 1]) category = args[++i];
  if (args[i] === "--start-id" && args[i + 1]) startId = parseInt(args[++i], 10);
}

const VIDEO_EXT = new Set([".mp4", ".mov", ".webm", ".m4v"]);
const dir = path.join(process.cwd(), "media", folder);
if (!fs.existsSync(dir)) { console.error("no such folder: " + dir); process.exit(1); }

const files = fs.readdirSync(dir)
  .filter(f => VIDEO_EXT.has(path.extname(f).toLowerCase()))
  .sort();

const creators = ["c1", "c2", "c3", "c4"];
const today = new Date().toISOString().slice(0, 10);

function titleFromFile(f) {
  return path.basename(f, path.extname(f))
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

const entries = files.map((f, i) => {
  const id = startId + i;
  const creator = creators[i % creators.length];
  const src = `../media/${folder}/${f}`;
  return `    { id:${id}, title:${JSON.stringify(titleFromFile(f))}, creator:"${creator}", type:"ugc", category:${JSON.stringify(category)}, categories:[${JSON.stringify(category)}], views:0, likes:0, dislikes:0, comments:0, favorites:0, duration:"", uploaded:"${today}", src:${JSON.stringify(src)}, tags:[${JSON.stringify(category)}], status:"published", flagged:false },`;
});

console.error(`# ${entries.length} entries generated from "${folder}" (ids ${startId}-${startId + entries.length - 1}), category "${category}"`);
console.log(entries.join("\n"));
