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
});

// Load catalog
const catalogPath = path.join(__dirname, "../src/shared/catalog.js");
const catalogSrc = fs.readFileSync(catalogPath, "utf8")
  .replace("const DATA = {", "global.DATA = {")
  .replace(/export \{[^}]*\};?\s*$/, "");
eval(catalogSrc);

const catalogVideos = global.DATA.videos;

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
const localFileMap = new Map();
scanDirs.forEach((dir) => {
  const files = getFilesRecursively(dir);
  files.forEach((p) => {
    const name = path.basename(p).toLowerCase().trim();
    localFileMap.set(name, p);
  });
});

console.log(`Found ${localFileMap.size} local files.`);

// Filter catalog videos that we have locally
const uploadQueue = [];
catalogVideos.forEach((v) => {
  if (v.src) {
    const filename = path.basename(v.src).toLowerCase().trim();
    if (localFileMap.has(filename)) {
      const localPath = localFileMap.get(filename);
      // Map to correct R2 key. 
      // The relative path in v.src strips "../media/" or "media/"
      const relPath = v.src.replace(/^(\.\.\/)?media\//, "");
      const r2Key = `media/${relPath}`;
      uploadQueue.push({ localPath, r2Key, title: v.title });
    }
  }
});

console.log(`Matched ${uploadQueue.length} / ${catalogVideos.length} videos from catalog.`);

async function uploadFile(item) {
  const fileStream = fs.createReadStream(item.localPath);
  const size = fs.statSync(item.localPath).size;

  // Check if file already exists in R2 to avoid redundant uploads
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

  console.log(`⬆️ Uploading: "${item.title}" (${(size/1024/1024).toFixed(2)} MB) -> ${item.r2Key}`);
  try {
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: item.r2Key,
      Body: fileStream,
      ContentLength: size,
      ContentType: "video/mp4"
    }));
    console.log(`✅ Uploaded: "${item.title}"`);
  } catch (err) {
    console.error(`❌ Failed to upload "${item.title}":`, err.message);
  }
}

// Concurrency pool (upload 3 files in parallel to keep it stable)
const CONCURRENCY = 3;
async function processQueue() {
  const active = [];
  for (const item of uploadQueue) {
    if (active.length >= CONCURRENCY) {
      await Promise.race(active);
    }
    const p = uploadFile(item).then(() => {
      active.splice(active.indexOf(p), 1);
    });
    active.push(p);
  }
  await Promise.all(active);
  console.log("All matching catalog videos uploaded to Cloudflare R2!");
}

processQueue().catch(console.error);
