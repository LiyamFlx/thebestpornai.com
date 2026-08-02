#!/usr/bin/env node
/**
 * 🖼️  gen-posters.js — backfill JPEG poster thumbnails for the catalog.
 *
 *   node scripts/gen-posters.js [--dry-run] [--concurrency 4] [--limit N] [--force]
 *
 * For every catalog entry that has no `thumb` yet, this:
 *   1. Finds the source video on disk (same scan dirs as upload-catalog-to-r2).
 *   2. Grabs a single frame with ffmpeg → media/thumbs/<rel>.jpg  (local).
 *   3. Uploads it to R2 under media/thumbs/<rel>.jpg (skips if already there).
 *   4. Writes `thumb:"../media/thumbs/<rel>.jpg"` onto that entry in
 *      catalog-videos.js (a .bak is written first).
 *
 * Idempotent: entries that already have a `thumb`, local .jpg files that already
 * exist, and posters already on R2 are all skipped. Re-run any time; only the
 * missing posters are produced. Requires R2_* env vars and ffmpeg on PATH.
 *
 * Flags:
 *   --dry-run        report what would be done; no ffmpeg, no upload, no edit
 *   --concurrency N  parallel workers (default 4)
 *   --limit N        only process the first N missing-poster entries
 *   --force          regenerate local .jpg and re-upload even if present
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { posterPaths, generatePoster, hasFfmpeg } from "./lib/posters.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const CATALOG_PATH = path.join(REPO, "src/shared/catalog-videos.js");

const args = process.argv.slice(2);
const has = (f) => args.includes("--" + f);
const opt = (name, def) => { const i = args.indexOf("--" + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def; };
const dryRun = has("dry-run");
const force = has("force");
const concurrency = Math.max(1, parseInt(opt("concurrency", "4"), 10) || 4);
const limit = parseInt(opt("limit", "0"), 10) || 0;

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET = process.env.R2_BUCKET || "streamhub-media";

if (!dryRun && (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT)) {
  console.error("Missing R2 credentials (set R2_* env vars, or use --dry-run).");
  process.exit(1);
}
if (!dryRun && !hasFfmpeg()) {
  console.error("ffmpeg not found on PATH — required to grab poster frames.");
  process.exit(1);
}

const s3 = dryRun ? null : new S3Client({
  region: "auto", endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  forcePathStyle: true,
});

// ---------- locate source videos on disk ----------
const scanDirs = [
  path.join(REPO, "media"),
  "/Users/liyam/Thebestpornai.com/media",
  "/Users/liyam/Downloads/Bunny uploud",
  "/Users/liyam/Downloads/Upload Bunny",
  "/Users/liyam/Downloads/to uplode",
  "/Users/liyam/Downloads/new bunny uplode",
];
function walk(dir) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    let st; try { st = fs.statSync(fp); } catch { continue; }
    if (st.isDirectory()) out = out.concat(walk(fp));
    else out.push(fp);
  }
  return out;
}
console.log("Scanning local folders for source videos…");
// Prefer full relative path under media/ — basename collisions across folders
// are real (see CLAUDE.md / .video-import.md). Basename is a last-resort fallback.
const localByRel = new Map();
const localByName = new Map();
const mediaRoot = path.join(REPO, "media");
for (const dir of scanDirs) for (const fp of walk(dir)) {
  const base = path.basename(fp).toLowerCase().trim();
  if (!localByName.has(base)) localByName.set(base, fp);
  try {
    const rel = path.relative(mediaRoot, fp).split(path.sep).join("/");
    if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
      localByRel.set(rel.toLowerCase(), fp);
    }
  } catch { /* not under media root */ }
}
console.log(`Found ${localByName.size} basenames, ${localByRel.size} media-relative paths.`);

const { VIDEOS } = await import("../src/shared/catalog-videos.js");
let missing = VIDEOS.filter(v => v.src && !v.thumb);
if (limit) missing = missing.slice(0, limit);
console.log(`${VIDEOS.length} entries; ${missing.length} missing a poster${limit ? ` (limited to ${limit})` : ""}.`);

function localForSrc(src) {
  const rel = String(src || "").replace(/^(\.\.\/)?media\//, "").toLowerCase();
  if (rel && localByRel.has(rel)) return localByRel.get(rel);
  return localByName.get(path.basename(src || "").toLowerCase().trim()) || null;
}

async function existsOnR2(key) {
  try { await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })); return true; }
  catch { return false; }
}

const generated = new Map();   // catalog src -> thumb path (to write back)
let made = 0, uploaded = 0, skippedNoLocal = 0, failed = 0, existed = 0;

async function processOne(v) {
  const localPath = localForSrc(v.src);
  if (!localPath) { skippedNoLocal++; return; }
  const { thumb, key, relJpg } = posterPaths(v.src);
  const outJpg = path.join(REPO, "media", "thumbs", relJpg);
  try {
    if (dryRun) { generated.set(v.src, thumb); made++; return; }

    if (force || !fs.existsSync(outJpg) || fs.statSync(outJpg).size === 0) {
      generatePoster(localPath, outJpg, { width: 480, seek: 1 });
      made++;
    } else { existed++; }

    if (force || !(await existsOnR2(key))) {
      await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET, Key: key,
        Body: fs.createReadStream(outJpg),
        ContentLength: fs.statSync(outJpg).size,
        ContentType: "image/jpeg",
      }));
      uploaded++;
    }
    generated.set(v.src, thumb);
  } catch (e) {
    failed++; console.error(`   ✗ ${path.basename(v.src)}: ${e.message}`);
  }
}

for (let i = 0; i < missing.length; i += concurrency) {
  const batch = missing.slice(i, i + concurrency);
  await Promise.all(batch.map(processOne));
  process.stdout.write(`\r   ▸ ${Math.min(i + concurrency, missing.length)}/${missing.length}  (made ${made}, uploaded ${uploaded}, reused ${existed}, no-local ${skippedNoLocal}, failed ${failed})   `);
}
console.log("");

if (!generated.size) {
  console.log("No posters to write back to the catalog.");
  if (skippedNoLocal) console.log(`(${skippedNoLocal} entries had no matching local source video — nothing to grab a frame from.)`);
  process.exit(0);
}

if (dryRun) {
  console.log(`\n[dry-run] would set \`thumb\` on ${generated.size} entries. No files written.`);
  const sample = [...generated.entries()].slice(0, 3).map(([s, t]) => `  ${s}\n    → ${t}`);
  console.log(sample.join("\n"), generated.size > 3 ? `\n  … +${generated.size - 3} more` : "");
  process.exit(0);
}

// ---------- write `thumb` back into catalog-videos.js (line-based) ----------
fs.copyFileSync(CATALOG_PATH, CATALOG_PATH + ".bak");
const lines = fs.readFileSync(CATALOG_PATH, "utf8").split("\n");
let written = 0;
const out = lines.map(line => {
  if (!/\bid:\s*\d+/.test(line) || /\bthumb\s*:/.test(line)) return line;      // not an entry, or already has a thumb
  const m = line.match(/\bsrc\s*:\s*"([^"]+)"/);
  if (!m) return line;
  const thumb = generated.get(m[1]);
  if (!thumb) return line;
  written++;
  // Insert `thumb:"…",` immediately before the `src:` token, matching the
  // surrounding spacing style (compact `src:"…"` vs spaced `src: "…"`).
  return line.replace(/(\bsrc\s*:)/, `thumb:${JSON.stringify(thumb)}, $1`);
});
fs.writeFileSync(CATALOG_PATH, out.join("\n"));
console.log(`✅ Wrote \`thumb\` onto ${written} catalog entries (backup: catalog-videos.js.bak).`);
console.log(`   made ${made} posters, uploaded ${uploaded}, reused ${existed}, no local source ${skippedNoLocal}, failed ${failed}.`);
console.log(`   Next: npm run build && git add -A && git commit -m "add poster thumbnails" && git push`);
