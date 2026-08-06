#!/usr/bin/env node
/**
 * One-off backfill: set Cache-Control on blog cover images (and their
 * thumb variants) already uploaded to R2 before scripts/upload-catalog-to-r2.js,
 * scripts/gen-posters.js, and scripts/publish-folder.js started setting it on
 * new uploads. R2/S3 requires a copy-in-place (CopyObject with REPLACE
 * metadata directive) to change an existing object's headers.
 *
 * Scoped to blog cover images only — the full media/ bucket has ~9,500
 * objects and a blanket backfill is a separate, higher-risk operation from
 * fixing the homepage's blog-card LCP cost.
 *
 * Run: node scripts/backfill-blog-cache-headers.js [--dry-run]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { S3Client, CopyObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");

const R2_BUCKET = process.env.R2_BUCKET || "streamhub-media";
const CACHE_CONTROL = "public, max-age=31536000, immutable";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

function collectKeys() {
  const keys = new Set();

  const writerPostsPath = path.join(REPO, "src", "blog", "writer-posts.json");
  if (fs.existsSync(writerPostsPath)) {
    const data = JSON.parse(fs.readFileSync(writerPostsPath, "utf8"));
    for (const e of data) if (e.cover) keys.add(e.cover.replace(/^(\.\.\/)?media\//, "media/"));
  }

  const postsJsPath = path.join(REPO, "src", "blog", "posts.js");
  if (fs.existsSync(postsJsPath)) {
    const src = fs.readFileSync(postsJsPath, "utf8");
    const re = /cover:\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(src))) keys.add(m[1].replace(/^(\.\.\/)?media\//, "media/"));
  }

  // Also cover the -thumb.webp variants, and the two video thumbs refreshed
  // in this session (already cache-controlled at upload, included here for
  // idempotent re-runs).
  const withThumbs = new Set();
  for (const k of keys) {
    withThumbs.add(k);
    withThumbs.add(k.replace(/\.(jpe?g|png)$/i, "-thumb.webp"));
  }
  withThumbs.add("media/thumbs/AI Girls Orgasm/AI Girls Orgasm.jpg");
  withThumbs.add("media/thumbs/Red Velvet Beauty Teaser/Red Velvet Beauty Teaser.jpg");

  return [...withThumbs];
}

async function main() {
  const keys = collectKeys();
  console.log(`Backfilling Cache-Control on ${keys.length} object(s)...`);

  for (const key of keys) {
    let head;
    try {
      head = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    } catch (err) {
      console.warn(`  skip (not on R2): ${key}`);
      continue;
    }

    if (head.CacheControl === CACHE_CONTROL) {
      console.log(`  already set: ${key}`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry-run] would set Cache-Control on: ${key}`);
      continue;
    }

    await s3.send(new CopyObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      CopySource: `/${R2_BUCKET}/${encodeURIComponent(key).replace(/%2F/g, "/")}`,
      MetadataDirective: "REPLACE",
      ContentType: head.ContentType,
      CacheControl: CACHE_CONTROL,
    }));
    console.log(`  updated: ${key}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
