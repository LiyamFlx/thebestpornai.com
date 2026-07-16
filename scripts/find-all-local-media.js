import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load catalog
const catalogPath = path.join(__dirname, "../src/shared/catalog.js");
const catalogSrc = fs.readFileSync(catalogPath, "utf8")
  .replace("const DATA = {", "global.DATA = {")
  .replace(/export \{[^}]*\};?\s*$/, "");
eval(catalogSrc);

const catalogVideos = global.DATA.videos;
console.log(`Catalog has ${catalogVideos.length} videos.`);

const scanDirs = [
  "/Users/liyam/Thebestpornai.com/media",
  "/Users/liyam/Thebestpornai.com/platform/media"
];

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

const localFileMap = new Map(); // filename (lowercased, trimmed) -> path

scanDirs.forEach((dir) => {
  console.log(`Scanning ${dir}...`);
  const files = getFilesRecursively(dir);
  console.log(`Found ${files.length} files in ${dir}.`);
  files.forEach((p) => {
    const name = path.basename(p).toLowerCase().trim();
    localFileMap.set(name, p);
  });
});

console.log(`Total unique filenames indexed: ${localFileMap.size}`);

let foundCount = 0;
let missing = [];
catalogVideos.forEach((v) => {
  if (v.src) {
    const filename = path.basename(v.src).toLowerCase().trim();
    if (localFileMap.has(filename)) {
      foundCount++;
    } else {
      // Try url decoding the catalog name just in case it is encoded
      const decodedName = decodeURIComponent(filename);
      if (localFileMap.has(decodedName)) {
        foundCount++;
      } else {
        missing.push(v);
      }
    }
  }
});

console.log(`Matched: ${foundCount} / ${catalogVideos.length}`);
console.log(`Missing: ${missing.length} / ${catalogVideos.length}`);
if (missing.length > 0) {
  console.log("First 10 missing:");
  missing.slice(0, 10).forEach((v) => console.log(` - ID ${v.id}: ${v.src}`));
}
