import fs from "fs";
import path from "path";
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

const scanDirs = [
  "/Users/liyam/Thebestpornai.com/media",
  "/Users/liyam/Thebestpornai.com/platform/media",
  "/Users/liyam/Downloads/Bunny uploud",
  "/Users/liyam/Downloads/Upload Bunny",
  "/Users/liyam/Downloads/to uplode",
  "/Users/liyam/Downloads/new bunny uplode"
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

const localFileMap = new Map();
scanDirs.forEach((dir) => {
  const files = getFilesRecursively(dir);
  files.forEach((p) => {
    const name = path.basename(p).toLowerCase().trim();
    localFileMap.set(name, p);
  });
});

let missing = [];
catalogVideos.forEach((v) => {
  if (v.src) {
    const filename = path.basename(v.src).toLowerCase().trim();
    if (!localFileMap.has(filename)) {
      missing.push(v);
    }
  }
});

console.log(`Missing: ${missing.length}`);
fs.writeFileSync(path.join(__dirname, "../missing-videos.json"), JSON.stringify(missing, null, 2));
console.log("Written missing-videos.json to platform directory.");
if (missing.length > 0) {
  console.log("First 15 missing videos:");
  missing.slice(0, 15).forEach((m) => console.log(`- ID ${m.id}: src="${m.src}" (title: ${m.title})`));
}
