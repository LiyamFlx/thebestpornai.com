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

// Search under the main project media directory: /Users/liyam/Thebestpornai.com/media
const localMediaDir = "/Users/liyam/Thebestpornai.com/media";

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

console.log(`Scanning local media directory ${localMediaDir} recursively...`);
const allLocalFiles = getFilesRecursively(localMediaDir);
console.log(`Found ${allLocalFiles.length} local files.`);

// Map filename to absolute path
const localFileMap = new Map();
allLocalFiles.forEach((p) => {
  const name = path.basename(p);
  localFileMap.set(name, p);
});

let foundCount = 0;
let missingVideos = [];
catalogVideos.forEach((v) => {
  if (v.src) {
    const filename = path.basename(v.src);
    if (localFileMap.has(filename)) {
      foundCount++;
    } else {
      missingVideos.push(v);
    }
  }
});

console.log(`Matched locally: ${foundCount} / ${catalogVideos.length}`);
console.log(`Missing locally: ${missingVideos.length} / ${catalogVideos.length}`);
if (missingVideos.length > 0) {
  console.log("First 10 missing locally:");
  missingVideos.slice(0, 10).forEach((v) => console.log(` - ID ${v.id}: ${v.src} (${v.title})`));
}
