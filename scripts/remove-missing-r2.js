import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

async function getAllR2Keys() {
  let keys = new Set();
  let continuationToken = undefined;
  do {
    const data = await client.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET,
        ContinuationToken: continuationToken,
      })
    );
    if (data.Contents) {
      data.Contents.forEach((c) => keys.add(c.Key));
    }
    continuationToken = data.NextContinuationToken;
  } while (continuationToken);
  return keys;
}

async function main() {
  console.log("1. Fetching all keys from Cloudflare R2...");
  const r2Keys = await getAllR2Keys();
  console.log(`   Found ${r2Keys.size} files in R2 bucket.`);

  // Load catalog data
  const { DATA } = await import("../src/shared/catalog.js");
  
  // Find which catalog entries are missing in R2
  const missingIds = new Set();
  const missingEntries = [];

  DATA.videos.forEach((v) => {
    if (v.src) {
      const relPath = v.src.replace(/^(\.\.\/)?media\//, "");
      const r2Key = `media/${relPath}`;
      if (!r2Keys.has(r2Key)) {
        missingIds.add(v.id);
        missingEntries.push(v);
      }
    }
  });

  console.log(`2. Identified ${missingIds.size} broken videos missing from R2.`);
  if (missingIds.size === 0) {
    console.log("   No missing videos found. Catalog is clean!");
    return;
  }

  // Read catalog.js and filter out the missing IDs
  const catalogPath = path.join(__dirname, "../src/shared/catalog.js");
  const catalogLines = fs.readFileSync(catalogPath, "utf8").split("\n");
  
  let removedCount = 0;
  const newLines = [];

  catalogLines.forEach((line) => {
    // Match line that contains id:XXX
    const match = line.match(/^\s*\{\s*id\s*:\s*(\d+)/);
    if (match) {
      const id = parseInt(match[1], 10);
      if (missingIds.has(id)) {
        removedCount++;
        return; // skip this line
      }
    }
    newLines.push(line);
  });

  // Write new catalog.js
  fs.writeFileSync(catalogPath, newLines.join("\n"), "utf8");
  console.log(`3. Successfully removed ${removedCount} broken entries from catalog.js.`);
  
  // Save log of removed items
  const logPath = path.join(__dirname, "../removed-videos-log.json");
  fs.writeFileSync(logPath, JSON.stringify(missingEntries, null, 2), "utf8");
  console.log(`   Log of removed videos saved to: ${logPath}`);
}

main().catch(console.error);
