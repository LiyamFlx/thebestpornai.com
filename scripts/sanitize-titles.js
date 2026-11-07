#!/usr/bin/env node
/**
 * sanitize-titles.js — Clean, keyword-enrich, and deduplicate catalog titles.
 *
 * 1. Replaces raw hexadecimal UUID titles with keyword-rich titles.
 * 2. Replaces generic/single-word titles (e.g. "Sexy", "All") with descriptive ones.
 * 3. Appends "— Part N" to duplicate titles so 100% of video titles are unique.
 *
 * Run: node scripts/sanitize-titles.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, "../src/shared/catalog-videos.js");

const raw = fs.readFileSync(CATALOG_PATH, "utf8");

// Import current VIDEOS
const { VIDEOS } = await import(CATALOG_PATH);

console.log(`Original catalog entries: ${VIDEOS.length}`);

const uuidRegex = /^[0-9a-f]{8}[\s-][0-9a-f]{4}/i;
const imagineHexRegex = /^imagine\s+[0-9a-f]{8}/i;

let uuidFixed = 0;
let genericFixed = 0;

for (const v of VIDEOS) {
  let t = v.title.trim();
  if (uuidRegex.test(t)) {
    v.title = `AI Hardcore 4K Scene #${v.id}`;
    uuidFixed++;
  } else if (imagineHexRegex.test(t)) {
    v.title = `AI Fantasy 4K Scene #${v.id}`;
    genericFixed++;
  } else if (t.toLowerCase() === "sexy" && (v.tags || []).includes("Lesbian")) {
    v.title = `Sexy AI Lesbian Scene #${v.id}`;
    genericFixed++;
  } else if (t.toLowerCase() === "blond" || t.toLowerCase() === "blonde") {
    v.title = `Blonde AI 4K Scene #${v.id}`;
    genericFixed++;
  }
}

// Second pass: Deduplicate remaining identical titles
const seen = new Map();
let dupsFixed = 0;

for (const v of VIDEOS) {
  const lower = v.title.trim().toLowerCase();
  if (seen.has(lower)) {
    const count = seen.get(lower) + 1;
    seen.set(lower, count);
    v.title = `${v.title.trim()} — Part ${count}`;
    dupsFixed++;
  } else {
    seen.set(lower, 1);
  }
}

console.log(`✔ Fixed ${uuidFixed} UUID titles`);
console.log(`✔ Fixed ${genericFixed} generic/short titles`);
console.log(`✔ Deduplicated ${dupsFixed} duplicate titles`);

// Serialize back into src/shared/catalog-videos.js
const header = `/* Full video catalog — optimized payload.
   Dynamic import()ed by catalog.js so it does not block first paint.
   Default fields (views:0, likes:0, status:"published") are omitted to reduce bundle size.
   Tooling (publish-folder.js / gen-posters.js) appends new entries to this array.
   NOTE: keep this a plain data module (no imports) so it code-splits cleanly. */
export const VIDEOS = [
`;

const lines = VIDEOS.map((v) => {
  // Format as clean single-line JSON without extra quotes on standard keys
  return "    " + JSON.stringify(v)
    .replace(/"id":/g, 'id:')
    .replace(/"title":/g, 'title:')
    .replace(/"creator":/g, 'creator:')
    .replace(/"type":/g, 'type:')
    .replace(/"category":/g, 'category:')
    .replace(/"categories":/g, 'categories:')
    .replace(/"views":/g, 'views:')
    .replace(/"likes":/g, 'likes:')
    .replace(/"dislikes":/g, 'dislikes:')
    .replace(/"comments":/g, 'comments:')
    .replace(/"duration":/g, 'duration:')
    .replace(/"uploaded":/g, 'uploaded:')
    .replace(/"tags":/g, 'tags:')
    .replace(/"thumb":/g, 'thumb:')
    .replace(/"src":/g, 'src:')
    .replace(/"orientation":/g, 'orientation:')
    .replace(/"level":/g, 'level:')
    .replace(/"actName":/g, 'actName:')
    .replace(/"flagged":/g, 'flagged:')
    .replace(/"status":/g, 'status:') + ",";
});

const footer = `
];
`;

fs.writeFileSync(CATALOG_PATH, header + lines.join("\n") + footer, "utf8");
console.log(`✔ Written updated catalog to ${CATALOG_PATH}`);

