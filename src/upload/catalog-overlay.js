// src/upload/catalog-overlay.js
// Fetches DB-published (status='live') uploads and merges them into the seed
// DATA.videos at runtime, so new uploads appear without a rebuild/redeploy.
// Best-effort: any failure leaves the seed catalog intact.
import { DATA } from "../shared/catalog.js";

const REST = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1" : "";
const ANON = process.env.SUPABASE_KEY || "";

if (!REST || !ANON) {
  console.warn("Supabase environment variables missing in catalog-overlay.js; live upload overlay disabled (seed catalog still works).");
}

// Numeric IDs only: every UI action (openVideo, vote, addComment, router,
// favorites/watch-later dataset attrs, manifest merge) coerces or compares
// with `+id`/`Number(id)`, and onclick="openVideo(${v.id})" template strings
// require a bare numeric literal — a string id ("u_"+r.id) breaks all of
// them (ReferenceError on click, NaN lookups, dead deep-links).
//
// uploads.id is a uuid (schema-global-upload.sql), NOT the numeric bigint an
// earlier fix here mistakenly assumed (that bigint belongs to the unrelated
// upload_attempts table in schema-upload-ratelimit.sql). Number(uuidString)
// is NaN, so `LIVE_UPLOAD_ID_OFFSET + Number(r.id)` silently reintroduced
// the exact "id breaks every downstream numeric comparison" bug it was
// meant to fix. uuidToStableInt() below hashes the uuid to a deterministic
// 31-bit integer instead — same uuid always maps to the same numeric id
// (stable across sessions, since history/favorites/watch-later persist ids
// in localStorage), offset into a fixed namespace above the seed catalog's
// max id (~4131) so it can never collide with a real catalog entry.
const LIVE_UPLOAD_ID_OFFSET = 1_000_000_000;

// FNV-1a over the uuid string, folded into a positive 31-bit int (fits
// safely in a JS double / Number.isFinite check with room to spare after
// adding the offset). Collisions are astronomically unlikely for the
// realistic scale here (hundreds to low thousands of live uploads against a
// ~2^31 space) and are not security-sensitive — worst case two different
// uploads render as the same catalog id, not a privilege or data leak.
export function uuidToStableInt(uuid) {
  let h = 0x811c9dc5;
  for (let i = 0; i < uuid.length; i++) {
    h ^= uuid.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 1; // drop the sign bit -> non-negative
}

/* Normalize DB bunny_path → catalog src "../media/…". Reject garbage so we
   never inject id:NaN or src:"../undefined" into the live catalog. */
export function normalizeBunnyPath(bunnyPath) {
  if (bunnyPath == null) return null;
  let p = String(bunnyPath).trim().replace(/^\/+/, "");
  if (!p) return null;
  // Already a catalog-style path
  if (p.startsWith("../media/")) return p.slice(3); // "media/…"
  if (p.startsWith("media/")) return p;
  // Bare key under uploads or other roots — require a media-ish path
  if (!p.includes("/")) p = "media/uploads/" + p;
  else if (!p.startsWith("media/")) p = "media/" + p.replace(/^media\//, "");
  return p;
}

export function rowToVideo(r) {
  if (!r || r.id == null || r.id === "") return null;
  const key = normalizeBunnyPath(r.bunny_path);
  if (!key) return null;
  const id = LIVE_UPLOAD_ID_OFFSET + uuidToStableInt(String(r.id));
  if (!Number.isFinite(id) || id < LIVE_UPLOAD_ID_OFFSET) return null;
  return {
    id,
    title: r.title || "Untitled",
    creator: r.user_id,           // UUID; creatorName() -> "Unknown" until real creator profiles exist
    type: "ugc",
    category: (r.tags && r.tags[0]) || "Amateur",
    categories: r.tags || [],
    views: 0, likes: 0, dislikes: 0, comments: 0, favorites: 0,
    duration: r.duration_s ? `${Math.floor(r.duration_s / 60)}:${String(r.duration_s % 60).padStart(2, "0")}` : "0:00",
    uploaded: (r.published_at || r.created_at || "").slice(0, 10),
    // bunny_path already stores the full R2 key including the "media/"
    // prefix (e.g. "media/uploads/up_123.mp4" — written by api/verify-upload.js),
    // so prepending "../media/" here doubled the segment and 404'd every
    // upload that reached status='live'. Legacy column name, current R2 data.
    src: "../" + key,
    tags: r.tags || [],
    status: "published",
    flagged: false,
    orientation: r.orientation || "horizontal",
    _fromUpload: true,
    _bunnyPath: key,
  };
}

export async function mergeLiveUploads() {
  if (!REST || !ANON) return;   // API not configured: leave seed catalog intact
  try {
    const r = await fetch(
      `${REST}/uploads?status=eq.live&select=*&order=published_at.desc&limit=500`,
      { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } },
    );
    if (!r.ok) return;
    const rows = await r.json();
    if (!Array.isArray(rows)) return;
    const have = new Set(DATA.videos.map((v) => v._bunnyPath).filter(Boolean));
    // Also de-dupe against catalog src so a published seed entry isn't doubled.
    const haveSrc = new Set(DATA.videos.map((v) => v.src).filter(Boolean));
    for (const row of rows) {
      const video = rowToVideo(row);
      if (!video) continue;
      if (have.has(video._bunnyPath) || haveSrc.has(video.src)) continue;
      DATA.videos.push(video);
      have.add(video._bunnyPath);
      haveSrc.add(video.src);
    }
  } catch (_) {
    /* best-effort: catalog still works from seed */
  }
}
