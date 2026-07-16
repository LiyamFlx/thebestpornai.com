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

const localMediaDir = "/Users/liyam/Thebestpornai.com/platform/media";
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

const localFiles = getFilesRecursively(localMediaDir);

console.log("=== Catalog Samples (first 10) ===");
catalogVideos.slice(0, 10).forEach(v => console.log(`ID ${v.id}: src="${v.src}"`));

console.log("\n=== Disk Samples (first 15) ===");
localFiles.slice(0, 15).forEach(f => console.log(path.relative(localMediaDir, f)));
