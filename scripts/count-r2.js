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
  console.log("Fetching all keys from R2 bucket...");
  const r2Keys = await getAllR2Keys();
  console.log(`R2 Bucket has ${r2Keys.size} files.`);

  // Load catalog
  const catalogPath = path.join(__dirname, "../src/shared/catalog.js");
  const catalogSrc = fs.readFileSync(catalogPath, "utf8")
    .replace("const DATA = {", "global.DATA = {")
    .replace(/export \{[^}]*\};?\s*$/, "");
  eval(catalogSrc);

  const catalogVideos = global.DATA.videos;
  console.log(`Catalog has ${catalogVideos.length} videos.`);

  let missingInR2 = [];
  catalogVideos.forEach((v) => {
    if (v.src) {
      // e.g. "../media/foo.mp4"
      const relPath = v.src.replace(/^(\.\.\/)?media\//, "");
      const r2Key = `media/${relPath}`; // wait, let's see how they are structured in R2.
      // S3 listing output showed: "media/new balk uplode/Amazing Hot AI girl1.mp4"
      // So key prefix is "media/"
      if (!r2Keys.has(r2Key)) {
        missingInR2.push({ id: v.id, src: v.src, key: r2Key });
      }
    }
  });

  console.log(`Missing in R2: ${missingInR2.length} / ${catalogVideos.length}`);
  if (missingInR2.length > 0) {
    console.log("First 10 missing keys:");
    missingInR2.slice(0, 10).forEach((m) => console.log(` - ID ${m.id}: ${m.key} (src: ${m.src})`));
  }
}

main().catch(console.error);
