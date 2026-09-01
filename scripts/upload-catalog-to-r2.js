import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET = process.env.R2_BUCKET || "streamhub-media";

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
  console.error("Missing R2 credentials in environment variables.");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

// Load catalog (full video list lives in catalog-videos.js)
const { VIDEOS: catalogVideos } = await import("../src/shared/catalog-videos.js");

const scanDirs = [
  "/Users/liyam/Thebestpornai.com/media",
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

console.log("Scanning local folders for video files...");
// Keyed by basename ONLY as a fallback index — basename collisions across
// different subfolders are real (confirmed: multiple same-named-but-
// different-content files already exist under media/, e.g. two distinct
// "cumshot1.mp4"). Matching by bare basename previously let the wrong
// file's bytes get uploaded to another catalog entry's R2 key. Primary
// match is now by the catalog's own relative path (folder + filename),
// which is unambiguous; basename is only used to report near-misses.
const localByRelPath = new Map();   // "batch-1/foo.mp4" (lowercased) -> absolute path
const localBasenames = new Map();   // basename (lowercased) -> count, for diagnostics
scanDirs.forEach((dir) => {
  const files = getFilesRecursively(dir);
  files.forEach((p) => {
    const rel = path.relative(dir, p).split(path.sep).join("/").toLowerCase().trim();
    localByRelPath.set(rel, p);
    const base = path.basename(p).toLowerCase().trim();
    localBasenames.set(base, (localBasenames.get(base) || 0) + 1);
  });
});

console.log(`Found ${localByRelPath.size} local files across scan directories.`);

// Build upload queue
const uploadQueue = [];
catalogVideos.forEach(v => {
  if (v.src && !v.src.startsWith("http")) {
    const relPath = v.src.replace(/^(\.\.\/)?media\//, "").toLowerCase().trim();
    if (localByRelPath.has(relPath)) {
      const localPath = localByRelPath.get(relPath);
      const r2Key = `media/${v.src.replace(/^(\.\.\/)?media\//, "")}`;
      uploadQueue.push({ localPath, r2Key, title: v.title });
    }
  }
});

console.log(`Matched ${uploadQueue.length} / ${catalogVideos.length} videos from catalog.`);

async function uploadFile(item) {
  const fileStream = fs.createReadStream(item.localPath);
  const size = fs.statSync(item.localPath).size;

  // Check if file already exists in R2
  if (existingR2Keys.has(item.r2Key)) {
    console.log(`⏭️ Already exists: ${item.r2Key}`);
    return;
  }

  // Fallback HEAD check if list inventory was not fully populated
  if (existingR2Keys.size === 0) {
    try {
      await s3.send(new HeadObjectCommand({
        Bucket: R2_BUCKET,
        Key: item.r2Key
      }));
      console.log(`⏭️ Already exists: ${item.r2Key}`);
      return;
    } catch (err) {
      // File doesn't exist, proceed with upload
    }
  }

  console.log(`⬆️ Uploading: "${item.title}" (${(size/1024/1024).toFixed(2)} MB) -> ${item.r2Key}`);
  try {
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: item.r2Key,
      Body: fileStream,
      ContentLength: size,
      ContentType: "video/mp4",
      CacheControl: "public, max-age=31536000, immutable"
    }));
    console.log(`✅ Uploaded: "${item.title}"`);
    existingR2Keys.add(item.r2Key);
  } catch (err) {
    console.error(`❌ Failed to upload "${item.title}":`, err.message);
  }
}

// Set-based concurrency pool (strictly enforces limit without indexOf -1 bug)
const CONCURRENCY = 3;
async function processQueue() {
  await fetchExistingKeys();

  const active = new Set();
  for (const item of uploadQueue) {
    if (active.size >= CONCURRENCY) {
      await Promise.race(active);
    }
    const p = (async () => {
      await uploadFile(item);
    })();
    active.add(p);
    p.finally(() => active.delete(p));
  }
  await Promise.all(active);
  console.log("All matching catalog videos uploaded to Cloudflare R2!");
}

processQueue().catch(console.error);
