import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { VIDEOS as catalogVideos } from "../src/shared/catalog-videos.js";
console.log(`Catalog has ${catalogVideos.length} videos.`);

// Consolidate all standard scan directories
const scanDirs = [
  path.join(__dirname, "../media")
].filter((dir, index, self) => fs.existsSync(dir) && self.indexOf(dir) === index);

function getFilesRecursively(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(filePath));
    } else {
      results.push(filePath);
    }
  });
  return results;
}

// NOTE: keyed by basename only, so two different files sharing a name
// (confirmed to exist, e.g. distinct "cumshot1.mp4" in separate media/
// subfolders) will report the catalog entry as "found" even if the actual
// file backing that specific src is missing — a false negative. This script
// only writes a diagnostic report (missing-videos.json), never mutates the
// catalog or uploads anything, so the risk here is a misleading report, not
// data corruption. Treat "Matched" counts as an upper bound, not exact.
const localFileMap = new Map();
scanDirs.forEach((dir) => {
  console.log(`Scanning ${dir}...`);
  const files = getFilesRecursively(dir);
  files.forEach((p) => {
    const name = path.basename(p).toLowerCase().trim();
    localFileMap.set(name, p);
    // Also store decoded version just in case
    localFileMap.set(decodeURIComponent(name), p);
  });
});

console.log(`Total unique local files indexed: ${localFileMap.size}`);

let foundCount = 0;
let missing = [];
catalogVideos.forEach((v) => {
  if (v.src) {
    const filename = path.basename(v.src).toLowerCase().trim();
    const decodedName = decodeURIComponent(filename);
    if (localFileMap.has(filename) || localFileMap.has(decodedName)) {
      foundCount++;
    } else {
      missing.push(v);
    }
  }
});

console.log(`\nResults:`);
console.log(`Matched: ${foundCount} / ${catalogVideos.length}`);
console.log(`Missing: ${missing.length} / ${catalogVideos.length}`);

if (missing.length > 0) {
  const missingLogPath = path.join(__dirname, "../missing-videos.json");
  fs.writeFileSync(missingLogPath, JSON.stringify(missing, null, 2));
  console.log(`\nWritten list of missing videos to: ${missingLogPath}`);
  console.log("\nFirst 15 missing videos:");
  missing.slice(0, 15).forEach((m) => console.log(`- ID ${m.id}: src="${m.src}" (title: ${m.title})`));
}
