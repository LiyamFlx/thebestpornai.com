// src/upload/catalog-overlay.js
// Fetches DB-published (status='live') uploads and merges them into the seed
// DATA.videos at runtime, so new uploads appear without a rebuild/redeploy.
// Best-effort: any failure leaves the seed catalog intact.
import { DATA } from "../shared/catalog.js";

const REST = "https://dabfxysxcngijcxxekzc.supabase.co/rest/v1";
const ANON = "sb_publishable_moBiV9AidT0XkL-L6wilYw_Jfn25YDr";

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
    src: "../media/" + r.bunny_path,
    tags: r.tags || [],
    status: "published",
    flagged: false,
    _fromUpload: true,
    _bunnyPath: r.bunny_path,
  };
}

export async function mergeLiveUploads() {
  try {
    const rows = await fetch(
      `${REST}/uploads?status=eq.live&select=*&order=published_at.desc&limit=500`,
      { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } },
    ).then((r) => r.json());
    if (!Array.isArray(rows)) return;
    const have = new Set(DATA.videos.map((v) => v._bunnyPath).filter(Boolean));
    for (const r of rows) {
      if (!have.has(r.bunny_path)) DATA.videos.push(rowToVideo(r));
    }
  } catch (_) {
    /* best-effort: catalog still works from seed */
  }
}
