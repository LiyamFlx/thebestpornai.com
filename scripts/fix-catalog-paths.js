import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Scan local ./media directory recursively for all video files
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

const mediaDir = path.join(__dirname, "../media");
console.log("Scanning local media directory...");
const localFiles = getFilesRecursively(mediaDir);

// Map of lowercase basename -> relative path from src/shared
const localFileMap = new Map();
localFiles.forEach((p) => {
  const base = path.basename(p).toLowerCase().trim();
  const relPath = "../media/" + path.relative(mediaDir, p);
  // Store both the direct relPath and encoded version
  localFileMap.set(base, relPath);
});
console.log(`Found ${localFileMap.size} unique local files.`);

// Read catalog.js
const catalogPath = path.join(__dirname, "../src/shared/catalog.js");
const catalogLines = fs.readFileSync(catalogPath, "utf8").split("\n");

let fixedCount = 0;
const newLines = [];

catalogLines.forEach((line) => {
  // Check if line represents a video entry
  if (line.includes("id:") && line.includes("src:")) {
    // Extract src path
    const srcMatch = line.match(/src\s*:\s*"([^"]+)"/);
    if (srcMatch) {
      const currentSrc = srcMatch[1];
      const absoluteSrcPath = path.resolve(path.dirname(catalogPath), currentSrc);
      
      // If the file does not exist at its current path
      if (!fs.existsSync(absoluteSrcPath)) {
        const filename = path.basename(currentSrc).toLowerCase().trim();
        if (localFileMap.has(filename)) {
          const correctSrc = localFileMap.get(filename);
          // Replace in line
          const newLine = line.replace(currentSrc, correctSrc);
          newLines.push(newLine);
          fixedCount++;
          console.log(`Fixing: ${currentSrc} -> ${correctSrc}`);
          return;
        }
      }
    }
  }
  newLines.push(line);
});

if (fixedCount > 0) {
  fs.writeFileSync(catalogPath, newLines.join("\n"), "utf8");
  console.log(`\n🎉 Successfully fixed ${fixedCount} broken path references in catalog.js!`);
} else {
  console.log("\nNo catalog paths could be auto-corrected using local files.");
}
