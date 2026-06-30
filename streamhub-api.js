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

/* ---------- AUTH (magic link / email OTP via Supabase GoTrue) ---------- */
const _AUTH = SUPABASE_URL.replace(/\/$/, "") + "/auth/v1";
const ShAuth = {
  /* Email the user a magic sign-in link. redirectTo brings them back here. */
  async sendMagicLink(email){
    const r = await fetch(_AUTH + "/otp", {
      method:"POST",
      headers:{ "apikey": SUPABASE_KEY, "Content-Type":"application/json" },
      body: JSON.stringify({ email, create_user:true, options:{ email_redirect_to: location.href.split("#")[0] } }),
    });
    if(!r.ok){ let m=""; try{ m=(await r.json()).msg||(await r.json()).error_description||""; }catch(_){} throw new Error(m||("auth "+r.status)); }
    return true;
  },
  /* If we returned from a magic link, the tokens are in the URL hash. Capture +
     persist them, then clean the URL. Returns the session or null. */
  captureSessionFromUrl(){
    const h = location.hash || "";
    if(h.indexOf("access_token=")===-1) return null;
    const p = new URLSearchParams(h.replace(/^#/,""));
    const at = p.get("access_token");
    if(!at) return null;
    const sess = { access_token: at, refresh_token: p.get("refresh_token"), expires_at: Date.now() + (parseInt(p.get("expires_in")||"3600",10)*1000) };
    localStorage.setItem("sh_session", JSON.stringify(sess));
    // strip the auth params from the hash so they don't linger / re-trigger
    history.replaceState(null, "", location.pathname + location.search);
    return sess;
  },
  session(){
    try { const s = JSON.parse(localStorage.getItem("sh_session")||"null"); if(s && s.expires_at>Date.now()) return s; } catch(_){}
    return null;
  },
  async user(){
    const s = this.session(); if(!s) return null;
    try {
      const r = await fetch(_AUTH + "/user", { headers:{ "apikey": SUPABASE_KEY, "Authorization":"Bearer "+s.access_token } });
      if(!r.ok) return null;
      return await r.json();
    } catch(_){ return null; }
  },
  signOut(){ localStorage.removeItem("sh_session"); },
  isSignedIn(){ return !!this.session(); },
};

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

  /* ---- VIEWS ---- */
  async addView(videoId){
    await _req(`/views`, { method:"POST", body: JSON.stringify({ video_id: videoId }) });
  },
  async viewCount(videoId){
    // HEAD with count header is cheapest, but keep it simple: count ids.
    const rows = await _req(`/views?video_id=eq.${videoId}&select=id`);
    return (rows||[]).length;
  },

  /* ---- FAVORITE COUNT (how many people favorited a video) ---- */
  async favoriteCount(videoId){
    const rows = await _req(`/favorites?video_id=eq.${videoId}&select=id`);
    return (rows||[]).length;
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
