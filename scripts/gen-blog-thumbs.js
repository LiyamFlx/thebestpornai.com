#!/usr/bin/env node
/**
 * Generate small WebP thumbnail variants of blog cover images and upload
 * them to R2 alongside the full-size originals.
 *
 * Why: blog cover images are shipped as full-res JPEGs (200-420 KB) but the
 * homepage "From the Blog" row and the /blog grid only ever display them at
 * 166x104-640x400. Lighthouse flags this as the single biggest LCP cost on
 * the homepage. The post page's own hero banner (up to 1856px wide) still
 * uses the full-res original via `cover` — this script only adds a small
 * `<name>-thumb.webp` variant for card/grid contexts.
 *
 * Run:  node scripts/gen-blog-thumbs.js [--dry-run] [--force]
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET = process.env.R2_BUCKET || "streamhub-media";

const THUMB_WIDTH = 640;
const THUMB_HEIGHT = 400;
const THUMB_CACHE_CONTROL = "public, max-age=31536000, immutable";

function collectCoverPaths() {
  const paths = new Set();

  const writerPostsPath = path.join(REPO, "src", "blog", "writer-posts.json");
  if (fs.existsSync(writerPostsPath)) {
    const data = JSON.parse(fs.readFileSync(writerPostsPath, "utf8"));
    for (const e of data) if (e.cover && e.cover.includes("media/blog/")) paths.add(e.cover);
  }

  const postsJsPath = path.join(REPO, "src", "blog", "posts.js");
  if (fs.existsSync(postsJsPath)) {
    const src = fs.readFileSync(postsJsPath, "utf8");
    const re = /cover:\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(src))) {
      if (m[1].includes("media/blog/")) paths.add(m[1]);
    }
  }

  return [...paths];
}

function resolveLocalPath(coverRel) {
  // coverRel looks like "../media/blog/foo.jpg" — resolve relative to repo root's media/ dir.
  const rel = coverRel.replace(/^(\.\.\/)?media\//, "");
  return path.join(REPO, "media", rel);
}

function thumbKeyFor(coverRel) {
  const rel = coverRel.replace(/^(\.\.\/)?media\//, "");
  const ext = path.extname(rel);
  const base = rel.slice(0, -ext.length);
  return `media/${base}-thumb.webp`;
}

function thumbLocalPathFor(localPath) {
  const ext = path.extname(localPath);
  return localPath.slice(0, -ext.length) + "-thumb.webp";
}

async function objectExists(s3, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404 || err.name === "NotFound") return false;
    throw err;
  }
}

async function main() {
  const covers = collectCoverPaths();
  console.log(`Found ${covers.length} blog cover image(s) referenced in content.`);

  let s3 = null;
  if (!DRY_RUN) {
    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
      console.error("Missing R2 credentials in environment variables (needed unless --dry-run).");
      process.exit(1);
    }
    s3 = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
      forcePathStyle: true,
    });
  }

  for (const coverRel of covers) {
    const localPath = resolveLocalPath(coverRel);
    const thumbKey = thumbKeyFor(coverRel);

    if (!fs.existsSync(localPath)) {
      console.warn(`  SKIP (missing local source): ${coverRel}`);
      continue;
    }

    if (!DRY_RUN && !FORCE && (await objectExists(s3, thumbKey))) {
      console.log(`  skip (thumb already on R2): ${thumbKey}`);
      continue;
    }

    const thumbLocalPath = thumbLocalPathFor(localPath);

    if (DRY_RUN) {
      console.log(`  [dry-run] would generate + upload: ${thumbKey}`);
      continue;
    }

    execFileSync("cwebp", [
      "-resize", String(THUMB_WIDTH), String(THUMB_HEIGHT),
      "-q", "80",
      localPath,
      "-o", thumbLocalPath,
    ], { stdio: "inherit" });

    const body = fs.readFileSync(thumbLocalPath);
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: thumbKey,
      Body: body,
      ContentType: "image/webp",
      CacheControl: THUMB_CACHE_CONTROL,
    }));

    console.log(`  uploaded: ${thumbKey} (${(body.length / 1024).toFixed(1)} KB)`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
