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

function rowToVideo(r) {
  return {
    id: "u_" + r.id,
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
    src: "../" + r.bunny_path,
    tags: r.tags || [],
    status: "published",
    flagged: false,
    orientation: r.orientation || "horizontal",
    _fromUpload: true,
    _bunnyPath: r.bunny_path,
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
    for (const r of rows) {
      if (!have.has(r.bunny_path)) DATA.videos.push(rowToVideo(r));
    }
  } catch (_) {
    /* best-effort: catalog still works from seed */
  }
}
