#!/usr/bin/env node
// Fails the build if src/shared/catalog.js contains duplicate video ids.
// Run: node scripts/check-catalog-ids.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, "..", "src", "shared", "catalog.js");

const src = fs.readFileSync(CATALOG_PATH, "utf8");
const idRe = /id:\s*(\d+)/g;
const seen = new Map();
let m;
while ((m = idRe.exec(src))) {
  const id = Number(m[1]);
  const line = src.slice(0, m.index).split("\n").length;
  if (!seen.has(id)) seen.set(id, []);
  seen.get(id).push(line);
}

const dups = [...seen.entries()].filter(([, lines]) => lines.length > 1);

if (dups.length) {
  console.error(`catalog.js has ${dups.length} duplicate video id(s):`);
  for (const [id, lines] of dups) {
    console.error(`  id ${id} -> lines ${lines.join(", ")}`);
  }
  process.exit(1);
}

console.log(`catalog.js OK: ${seen.size} unique video ids, no duplicates.`);
