#!/usr/bin/env node
/**
 * 🚀 publish-folder.js — one command to publish a whole folder of videos.
 *
 * Drop videos in a folder under ./media/, then run:
 *   node scripts/publish-folder.js "media/my-batch" --category "AI" --tags "Big Ass,POV"
 *
 * It does EVERYTHING in one pass, idempotently:
 *   1. Scans the folder recursively for video files.
 *   2. Skips anything already in catalog.js OR already on R2 (HEAD check).
 *   3. Uploads missing files to R2 media/… IN PARALLEL BATCHES (fast for 1000s).
 *   4. Generates catalog entries (ffprobe duration, smart tags, movie/scene
 *      structure) — reusing the same rules as gen-catalog-from-local.js.
 *   5. Inserts the new entries directly into src/shared/catalog.js (auto — no
 *      manual paste). A .bak of catalog.js is written first.
 *
 * Then just: git add -A && git commit && git push  → live.
 *
 * Flags:
 *   --category "AI"        primary category for the batch (default "Amateur")
 *   --tags "Big Ass,POV"   extra tags applied to every entry
 *   --creator c1           force a creator id (default: round-robin c1..c4)
 *   --concurrency 8        parallel uploads (default 8)
 *   --limit N              only process the first N new files (safe batching)
 *   --no-posters           skip JPEG poster generation (default: posters on)
 *   --dry-run              scan + report only, upload nothing, edit nothing
 *
 * Requires R2_* env vars (from .env) and ffprobe on PATH (optional; falls back
 * to 0:00 duration if missing). ffmpeg optional for posters.
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath, pathToFileURL } from "url";
import "dotenv/config";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { posterPaths, generatePoster, hasFfmpeg } from "./lib/posters.js";
import { parseStructure } from "./lib/parse-structure.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
// Video entries live in catalog-videos.js (code-split out of catalog.js so the
// ~1.9 MB payload no longer blocks first paint). Insert/verify against it.
const CATALOG_PATH = path.join(REPO, "src/shared/catalog-videos.js");
const VIDEO_EXT = new Set([".mp4", ".mov", ".webm", ".m4v"]);
const PUBLIC_BASE = "https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev";

// ---------- args ----------
const args = process.argv.slice(2);
const folderArg = args.find(a => !a.startsWith("--"));
if (!folderArg) {
  console.error('Usage: node scripts/publish-folder.js "media/<folder>" [--category AI] [--tags "a,b"] [--creator c1] [--concurrency 8] [--limit N] [--dry-run] [--no-posters]');
  process.exit(1);
}
const opt = (name, def) => { const i = args.indexOf("--" + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def; };
const splitList = s => (s || "").split(",").map(t => t.trim()).filter(Boolean);
const category = opt("category", "Amateur");
const extraTags = splitList(opt("tags", ""));
// Per-video variety pools (optional). --categories rotates a category per video;
// --tag-pool draws a varied random tag set per video (on top of --tags).
const categoryPool = splitList(opt("categories", ""));
const tagPool = splitList(opt("tag-pool", ""));
const tagsPerVideo = parseInt(opt("tags-per-video", "5"), 10) || 5;
const creatorOverride = opt("creator", null);
const concurrency = parseInt(opt("concurrency", "8"), 10) || 8;
const limit = parseInt(opt("limit", "0"), 10) || 0;
const dryRun = args.includes("--dry-run");
const noPosters = args.includes("--no-posters");
// Generate a JPEG poster per video (cheap card thumbnail instead of a <video>).
// Needs ffmpeg; if absent we publish without posters rather than failing.
const postersEnabled = !noPosters && (dryRun || hasFfmpeg());
if (!noPosters && !dryRun && !hasFfmpeg()) {
  console.warn("⚠ ffmpeg not found — publishing without poster thumbnails (videos still work).");
}

const folder = path.isAbsolute(folderArg) ? folderArg : path.join(REPO, folderArg);
if (!fs.existsSync(folder)) { console.error(`❌ Folder not found: ${folder}`); process.exit(1); }

// ---------- R2 client ----------
const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET = "streamhub-media" } = process.env;
if (!dryRun && (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT)) {
  console.error("❌ Missing R2 credentials in .env"); process.exit(1);
}
const s3 = new S3Client({
  region: "auto", endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  forcePathStyle: true,
});

// ---------- entry-generation helpers (same rules as gen-catalog-from-local.js) ----------
function getDuration(fp) {
  try {
    const out = execSync(`ffprobe -v quiet -print_format json -show_format "${fp}"`, { encoding: "utf8" });
    const secs = parseFloat(JSON.parse(out).format?.duration || 0);
    return `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
  } catch { return "0:00"; }
}
function titleFromFile(f) {
  return path.basename(f, path.extname(f)).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, c => c.toUpperCase());
}
// Deterministic per-file seed so a given filename always yields the same
// "random" variety (re-runs are stable; no Math.random noise in the catalog).
function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}
// Small seeded PRNG (mulberry32) for stable per-video shuffling.
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededPick(arr, r) { return arr[Math.floor(r() * arr.length)]; }
function seededSample(arr, n, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

// Category for a video: rotate from --categories pool if given, else --category.
function categoryFor(filename, r) {
  return categoryPool.length ? seededPick(categoryPool, r) : category;
}

// Tags for a video: filename-derived signals + explicit --tags + a varied sample
// from --tag-pool, deduped. Deterministic per filename.
function tagsFor(title, cat, r) {
  const t = title.toLowerCase();
  const derived = ["Hardcore", cat];
  if (t.includes("ass")) derived.push("Big Ass", "PAWG");
  if (t.includes("teen") || /\b18\b/.test(t)) derived.push("18+");
  if (t.includes("milf")) derived.push("MILF");
  if (t.includes("blow") || t.includes("suck")) derived.push("Blowjob", "Deepthroat");
  const pooled = tagPool.length ? seededSample(tagPool, tagsPerVideo, r) : [];
  return [...new Set([...derived, ...extraTags, ...pooled])].slice(0, 8);
}

// Templated, keyword-rich description for SEO + the watch page + JSON-LD.
function describeFor(title, cat, tags, creator) {
  const tagPhrase = tags.filter(t => t !== "Hardcore" && t !== cat).slice(0, 3).join(", ");
  return `Watch ${title} — a hot ${cat} scene${tagPhrase ? ` featuring ${tagPhrase}` : ""} on thebestpornai. `
       + `Stream this and more AI-generated & community adult videos in stunning quality.`;
}

// ---------- read catalog + build "already published" index ----------
const catalogText = fs.readFileSync(CATALOG_PATH, "utf8");
const publishedSrcs = new Set([...catalogText.matchAll(/src:\s*"([^"]+)"/g)].map(m => m[1]));
const maxId = Math.max(0, ...[...catalogText.matchAll(/\bid:\s*(\d+)/g)].map(m => +m[1]));
// Baseline video count, captured by actually importing the pre-write module —
// used post-write to confirm the array grew by exactly the right amount.
const originalVideoCount = (await import(pathToFileURL(CATALOG_PATH).href + "?verify=" + Date.now())).VIDEOS.length;

// ---------- scan folder ----------
function walk(dir) {
  let out = [];
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    if (fs.statSync(fp).isDirectory()) out = out.concat(walk(fp));
    else if (VIDEO_EXT.has(path.extname(fp).toLowerCase())) out.push(fp);
  }
  return out;
}
const files = walk(folder).sort((a, b) => a.localeCompare(b));
console.log(`🔎 Found ${files.length} video files under ${path.relative(REPO, folder)}`);

// Build the R2 key + relative src for a local file (relative to media/).
function srcFor(fp) {
  const rel = path.relative(path.join(REPO, "media"), fp).split(path.sep).join("/");
  return { src: `../media/${rel}`, key: `media/${rel}`, publicUrl: `${PUBLIC_BASE}/media/${rel.split("/").map(encodeURIComponent).join("/")}` };
}

// Skip files already in the catalog by full src path (never basename-only).
const fresh = files.filter(fp => !publishedSrcs.has(srcFor(fp).src));
const already = files.length - fresh.length;
let todo = limit > 0 ? fresh.slice(0, limit) : fresh;
console.log(`   ${already} already in catalog, ${fresh.length} new${limit && fresh.length > limit ? ` (processing first ${todo.length} via --limit)` : ""}.`);
if (!todo.length) { console.log("✅ Nothing new to publish."); process.exit(0); }

const creators = ["c1", "c2", "c3", "c4"];
const today = new Date().toISOString().slice(0, 10);

async function existsOnR2(key) {
  try { await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })); return true; }
  catch { return false; }
}

// ---------- upload (parallel batches) + build entries ----------
// IDs are assigned AFTER the parallel pass (sorted by file order) so concurrent
// workers never interleave nextId++ and file order always matches id order.
const CONTENT_TYPES = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".m4v": "video/x-m4v" };
const newEntries = [];
let uploaded = 0, skipped = 0, failed = 0, postersMade = 0;

async function processOne(fp, i) {
  const { src, key } = srcFor(fp);
  try {
    if (!dryRun) {
      if (await existsOnR2(key)) { skipped++; }
      else {
        await s3.send(new PutObjectCommand({
          Bucket: R2_BUCKET, Key: key,
          Body: fs.createReadStream(fp),
          ContentLength: fs.statSync(fp).size,
          ContentType: CONTENT_TYPES[path.extname(fp).toLowerCase()] || "application/octet-stream",
        }));
        uploaded++;
      }
    }
    // Poster thumbnail — best-effort; a video without one still renders (the
    // client falls back to a lazy <video> thumb). Never fails the publish.
    let thumb;
    if (postersEnabled && !dryRun) {
      try {
        const pp = posterPaths(src);
        const outJpg = path.join(REPO, "media", "thumbs", pp.relJpg);
        if (!fs.existsSync(outJpg) || fs.statSync(outJpg).size === 0) generatePoster(fp, outJpg, { width: 480, seek: 1 });
        if (!(await existsOnR2(pp.key))) {
          await s3.send(new PutObjectCommand({
            Bucket: R2_BUCKET, Key: pp.key,
            Body: fs.createReadStream(outJpg),
            ContentLength: fs.statSync(outJpg).size,
            ContentType: "image/jpeg",
          }));
        }
        thumb = pp.thumb;
        postersMade++;
      } catch (e) { /* poster optional — leave thumb undefined */ }
    }

    const title = titleFromFile(fp);
    const st = parseStructure(fp);
    // Per-video variety, seeded by filename so re-runs are stable.
    const r = rng(seedFrom(path.basename(fp)));
    const cat = categoryFor(fp, r);
    const tags = tagsFor(title, cat, r);
    const creator = creatorOverride || creators[i % creators.length];
    // id filled in after sort — see assignIds below
    const entry = {
      id: 0, title, creator,
      type: "ugc", category: cat, categories: [cat, ...tags.filter(t => t !== cat && t !== "Hardcore").slice(0, 2)],
      desc: describeFor(title, cat, tags, creator),
      views: 0, likes: 0, dislikes: 0, comments: 0, favorites: 0,
      duration: getDuration(fp), uploaded: today, src, tags,
      ...(thumb ? { thumb } : {}),
      status: "published", flagged: false,
      ...(st.movieTitle ? { movieTitle: st.movieTitle } : {}),
      ...(st.level ? { level: st.level } : {}),
      ...(st.sceneNumber ? { sceneNumber: st.sceneNumber } : {}),
      ...(st.clipNumber ? { clipNumber: st.clipNumber } : {}),
      ...(st.actName ? { actName: st.actName } : {}),
    };
    newEntries.push({ i, entry });
  } catch (e) {
    failed++; console.error(`   ✗ ${path.basename(fp)}: ${e.message}`);
  }
}

async function run() {
  for (let start = 0; start < todo.length; start += concurrency) {
    const batch = todo.slice(start, start + concurrency);
    await Promise.all(batch.map((fp, j) => processOne(fp, start + j)));
    process.stdout.write(`\r   ⬆ ${Math.min(start + concurrency, todo.length)}/${todo.length}  (uploaded ${uploaded}, skipped ${skipped}, failed ${failed})   `);
  }
  console.log("");

  // Preserve original file order, then mint sequential ids past current max.
  newEntries.sort((a, b) => a.i - b.i);
  let nextId = maxId + 1;
  if (!Number.isFinite(nextId) || nextId < 1) nextId = 1;
  const entries = newEntries.map(x => {
    x.entry.id = nextId++;
    return x.entry;
  });
  if (!entries.length) {
    console.log(failed ? `Nothing to insert (${failed} failed).` : "Nothing to insert.");
    if (failed) process.exit(1);
    return;
  }

  // ---------- validate entries BEFORE touching catalog.js ----------
  // Catches the two failure modes that have actually happened in production:
  // batch entries silently missing required fields, and duplicate/malformed
  // ids that later corrupt the array structure.
  const seenIds = new Set();
  const badEntries = [];
  for (const e of entries) {
    const problems = [];
    if (!Number.isInteger(e.id) || e.id <= 0) problems.push("id is not a positive integer");
    if (seenIds.has(e.id)) problems.push(`duplicate id ${e.id} within this batch`);
    seenIds.add(e.id);
    if (!e.title || typeof e.title !== "string") problems.push("missing/invalid title");
    if (!e.src || typeof e.src !== "string" || !e.src.startsWith("../media/")) problems.push(`src must start with "../media/" (got ${JSON.stringify(e.src)})`);
    if (!e.category || typeof e.category !== "string") problems.push("missing/invalid category");
    if (!e.status) problems.push("missing status");
    if (problems.length) badEntries.push({ title: e.title, problems });
  }
  if (badEntries.length) {
    console.error(`❌ ${badEntries.length} generated entries failed validation — aborting (no changes made):`);
    for (const b of badEntries) console.error(`   - ${b.title || "(untitled)"}: ${b.problems.join("; ")}`);
    process.exit(1);
  }

  if (dryRun) {
    console.log(`\n[dry-run] would insert ${entries.length} entries (ids ${entries[0].id}–${entries[entries.length - 1].id}). No upload, no file change.`);
    console.log(JSON.stringify(entries.slice(0, 2), null, 2), entries.length > 2 ? `\n… +${entries.length - 2} more` : "");
    return;
  }

  // ---------- insert into catalog.js before the videos-array close ----------
  fs.writeFileSync(CATALOG_PATH + ".bak", catalogText);   // safety backup
  const lines = catalogText.split("\n");
  // find the `export const VIDEOS = [` line, then its closing "];"
  const startIdx = lines.findIndex(l => /export\s+const\s+VIDEOS\s*=\s*\[/.test(l));
  let closeIdx = -1;
  for (let k = startIdx + 1; k < lines.length; k++) { if (/^\s*\];?\s*$/.test(lines[k])) { closeIdx = k; break; } }
  if (startIdx < 0 || closeIdx < 0) { console.error("❌ Could not locate VIDEOS array in catalog-videos.js — aborting (no changes)."); process.exit(1); }

  const fmt = e => "    " + JSON.stringify(e).replace(/"([a-zA-Z_]\w*)":/g, "$1:") + ",";
  const block = entries.map(fmt);
  lines.splice(closeIdx, 0, ...block);
  fs.writeFileSync(CATALOG_PATH, lines.join("\n"));

  // ---------- verify the write actually produced a valid, complete catalog ----------
  // Root-caused two prior incidents (entries landing outside the videos array,
  // 805 corrupted paths): re-import the file we just wrote and confirm the
  // array grew by exactly the right amount with every new id present and
  // correctly shaped. If not, restore the pre-write backup immediately.
  let verifyOk = false;
  let verifyError = "";
  try {
    const mod = await import(pathToFileURL(CATALOG_PATH).href + "?verify=" + Date.now());
    const videos = mod.VIDEOS;
    if (!Array.isArray(videos)) throw new Error("VIDEOS is not an array after write");
    const expectedCount = originalVideoCount + entries.length;
    if (videos.length !== expectedCount) throw new Error(`expected ${expectedCount} videos, found ${videos.length}`);
    for (const e of entries) {
      const v = videos.find(x => x.id === e.id);
      if (!v) throw new Error(`id ${e.id} missing from parsed catalog after write`);
      if (v.src !== e.src) throw new Error(`id ${e.id} src mismatch after write`);
    }
    verifyOk = true;
  } catch (e) {
    verifyError = e.message;
  }
  if (!verifyOk) {
    fs.copyFileSync(CATALOG_PATH + ".bak", CATALOG_PATH);
    console.error(`\n❌ Post-write verification failed: ${verifyError}`);
    console.error(`   catalog.js has been restored from the pre-write backup — no changes were kept.`);
    console.error(`   The media files ARE already uploaded to R2 (safe to re-run once the generator issue is fixed).`);
    process.exit(1);
  }

  console.log(`\n✅ Published ${entries.length} videos.`);
  console.log(`   Uploaded ${uploaded} to R2, skipped ${skipped} already there, ${failed} failed, posters ${postersMade}.`);
  console.log(`   Inserted ids ${entries[0].id}–${entries[entries.length - 1].id} into catalog-videos.js (backup: .bak).`);
  console.log(`\nSmoke:\n   npm run publish:doctor\n   npm run build\n   git add -A && git commit -m "publish ${entries.length} videos" && git push`);
  if (failed) {
    console.warn(`\n⚠ ${failed} file(s) failed during upload/process — re-run is safe (skips catalog/R2 hits).`);
    process.exitCode = 1;
  }
}

run().catch(e => { console.error("Fatal:", e); process.exit(1); });
