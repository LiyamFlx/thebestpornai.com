/* ============================================================
   StreamHub API — persistent likes / comments / favorites.
   Talks to Supabase REST (PostgREST) directly from the browser with the
   PUBLISHABLE key (safe to ship). Loaded at runtime via
   <script src="../streamhub-api.js?v=N"></script> AFTER catalog.js.

   Design: every call is best-effort. If Supabase is unreachable or returns an
   error, the helpers reject/return a sentinel and the page falls back to its
   in-memory behavior — the site must never break because the API is down.
   ============================================================ */

const SUPABASE_URL = "https://dabfxysxcngijcxxekzc.supabase.co";
/* Publishable (client) key — public by design, like an API endpoint. NOT a secret. */
const SUPABASE_KEY = "sb_publishable_moBiV9AidT0XkL-L6wilYw_Jfn25YDr";

const _REST = SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";
const _HEADERS = {
  "apikey": SUPABASE_KEY,
  "Authorization": "Bearer " + SUPABASE_KEY,
  "Content-Type": "application/json",
};

/* Stable anonymous id for this browser (for favorites that persist per-visitor). */
function shClientId(){
  let id = localStorage.getItem("sh_client_id");
  if(!id){ id = "c_" + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("sh_client_id", id); }
  return id;
}

/* Low-level fetch with a short timeout so a hung request can't freeze the UI. */
async function _req(path, opts={}){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), 6000);
  try {
    const r = await fetch(_REST + path, { ...opts, headers:{ ..._HEADERS, ...(opts.headers||{}) }, signal: ctrl.signal });
    if(!r.ok) throw new Error("supabase " + r.status);
    const txt = await r.text();
    return txt ? JSON.parse(txt) : null;
  } finally { clearTimeout(t); }
}

/* Is the API configured/available? (cheap guard the pages can check.) */
const SH_API_ENABLED = !!(SUPABASE_URL && SUPABASE_KEY);

const ShAPI = {
  enabled: SH_API_ENABLED,
  clientId: shClientId,

  /* ---- LIKES (count rows; concurrency-safe) ---- */
  async likeCounts(videoId){
    const rows = await _req(`/likes?video_id=eq.${videoId}&select=kind`);
    let like=0, dislike=0;
    for(const r of rows||[]){ r.kind==="dislike" ? dislike++ : like++; }
    return { like, dislike };
  },
  async addLike(videoId, kind="like"){
    await _req(`/likes`, { method:"POST", body: JSON.stringify({ video_id: videoId, kind }) });
  },

  /* ---- COMMENTS ---- */
  async listComments(videoId){
    return (await _req(`/comments?video_id=eq.${videoId}&select=*&order=created_at.desc`)) || [];
  },
  async addComment(videoId, author, body){
    const rows = await _req(`/comments`, {
      method:"POST",
      headers:{ "Prefer":"return=representation" },
      body: JSON.stringify({ video_id: videoId, author: author||"Guest", body }),
    });
    return rows && rows[0];
  },

  /* ---- FAVORITES (per-browser via client_id) ---- */
  async myFavorites(){
    const rows = await _req(`/favorites?client_id=eq.${encodeURIComponent(shClientId())}&select=video_id`);
    return (rows||[]).map(r=>r.video_id);
  },
  async addFavorite(videoId){
    await _req(`/favorites`, { method:"POST", body: JSON.stringify({ video_id: videoId, client_id: shClientId() }) });
  },
  async removeFavorite(videoId){
    await _req(`/favorites?video_id=eq.${videoId}&client_id=eq.${encodeURIComponent(shClientId())}`, { method:"DELETE" });
  },
};
