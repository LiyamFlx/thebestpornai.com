// Run locally (has real network access): node scripts/check-broken-videos.mjs
// HEAD-checks every catalog video's R2 URL and prints any that 404 (or error).
import { VIDEOS } from "../src/shared/catalog-videos.js";

const MEDIA_BASE = "https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev/media";
function mediaUrl(src) {
  const rel = src.replace(/^(\.\.\/)?media\//, "");
  return MEDIA_BASE + "/" + rel.split("/").map(encodeURIComponent).join("/");
}

const CONCURRENCY = 12;
let idx = 0;
const bad = [];

async function worker() {
  while (idx < VIDEOS.length) {
    const v = VIDEOS[idx++];
    if (!v.src || /^https?:\/\//i.test(v.src)) continue;
    const url = mediaUrl(v.src);
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (!res.ok) bad.push({ id: v.id, title: v.title, status: res.status, src: v.src });
    } catch (e) {
      bad.push({ id: v.id, title: v.title, status: "ERR:" + e.message, src: v.src });
    }
  }
}

console.log(`Checking ${VIDEOS.length} catalog entries...`);
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`\nDone. ${bad.length} broken:\n`);
for (const b of bad) console.log(`${b.id}\t${b.status}\t${b.title}\t${b.src}`);

import { writeFileSync } from "fs";
writeFileSync("broken-videos.json", JSON.stringify(bad, null, 2));
console.log(`\nWrote broken-videos.json (${bad.length} entries)`);
