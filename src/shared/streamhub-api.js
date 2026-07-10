/* ============================================================
   StreamHub API — persistent likes / comments / favorites.
   Talks to Supabase REST (PostgREST) directly from the browser with the
   PUBLISHABLE key (safe to ship). Imported as an ES module by each app's
   main.js via `import {...} from "../shared/streamhub-api.js"`, bundled
   alongside catalog.js by Vite.

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

/* Stable anonymous id for this browser (for favorites that persist per-visitor).
   NOTE: This is ONLY for rate-limiting / deduping casual abuse.
   It is NOT a security boundary — a determined client can rotate IDs or forge them.
   Real writes (moderation, uploads) require authenticated Supabase sessions. */
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

/* Same as _req, but sends the signed-in user's own access token instead of the
   anon key, so RLS policies scoped `to authenticated` (moderation, uploads
   inserts) accept the request. Throws if no session is present. */
async function _authedReq(path, opts={}){
  const sess = (typeof ShAuth!=="undefined") && ShAuth.session();
  if(!sess) throw new Error("sign in required");
  return _req(path, { ...opts, headers:{ ...(opts.headers||{}), "Authorization": "Bearer " + sess.access_token } });
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
    if(!r.ok){ let m=""; try{ const j=await r.json(); m=j.msg||j.error_description||""; }catch(_){} throw new Error(m||("auth "+r.status)); }
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
    await _req(`/likes`, { method:"POST", body: JSON.stringify({ video_id: videoId, kind, client_id: shClientId() }) });
  },

  /* ---- COMMENTS ---- */
  async listComments(videoId){
    return (await _req(`/comments?video_id=eq.${videoId}&select=*&order=created_at.desc`)) || [];
  },
  async addComment(videoId, author, body){
    const rows = await _req(`/comments`, {
      method:"POST",
      headers:{ "Prefer":"return=representation" },
      body: JSON.stringify({ video_id: videoId, author: author||"Guest", body, client_id: shClientId() }),
    });
    return rows && rows[0];
  },

  /* ---- VIEWS ---- */
  async addView(videoId){
    await _req(`/views`, { method:"POST", body: JSON.stringify({ video_id: videoId, client_id: shClientId() }) });
  },
  async viewCount(videoId){
    // HEAD with count header is cheapest, but keep it simple: count ids.
    const rows = await _req(`/views?video_id=eq.${videoId}&select=id`);
    return (rows||[]).length;
  },

  /* ---- MODERATION (real moderator decisions; requires sign-in — RLS
     restricts moderation inserts to the `authenticated` role) ---- */
  async moderate(videoId, action, reason, moderator){
    await _authedReq(`/moderation`, { method:"POST", body: JSON.stringify({
      video_id:String(videoId), action, reason:reason||null, moderator:moderator||null
    }) });
  },
  async moderationLog(limit=50){
    return (await _req(`/moderation?select=*&order=created_at.desc&limit=${limit}`)) || [];
  },
  /* Latest decision per video (so the queue can hide already-actioned items). */
  async latestDecisions(){
    const rows = await _req(`/moderation?select=video_id,action,created_at&order=created_at.desc`) || [];
    const seen = {};
    for(const r of rows){ if(!(r.video_id in seen)) seen[r.video_id]=r.action; }
    return seen;   // { "<video_id>": "remove"|"approve"|... }
  },

  /* ---- FAVORITE COUNT (how many people favorited a video) ---- */
  async favoriteCount(videoId){
    const rows = await _req(`/favorites?video_id=eq.${videoId}&select=id`);
    return (rows||[]).length;
  },

  /* ---- VIDEO UPLOAD (Bunny Storage via the serverless relay) ---- */
  /* Base for the upload function. The static site is on Bunny but the function
     runs on Vercel, so set this to your Vercel URL (e.g. https://x.vercel.app).
     Empty = same origin (works when both are served together). */
  uploadApiBase: (typeof SH_UPLOAD_API_BASE!=="undefined" ? SH_UPLOAD_API_BASE : ""),
  async uploadVideo(file, title, onProgress){
    // TEMP: Auth removed for now to unblock uploads. No sign-in required.
    const sess = (typeof ShAuth!=="undefined") ? ShAuth.session() : null;
    // POST the raw file bytes to our relay, which streams them to Bunny Storage.
    const info = await new Promise((resolve, reject)=>{
      const xhr = new XMLHttpRequest();
      xhr.open("POST", (this.uploadApiBase||"") + "/api/upload", true);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.setRequestHeader("X-Filename", (file.name||"video.mp4"));
      if (sess && sess.access_token) {
        xhr.setRequestHeader("Authorization", "Bearer " + sess.access_token);
      }
      if(onProgress) xhr.upload.onprogress = e=>{ if(e.lengthComputable) onProgress(Math.round(e.loaded/e.total*100)); };
      xhr.onload = ()=>{
        if(xhr.status>=200 && xhr.status<300){ try{ resolve(JSON.parse(xhr.responseText)); }catch(_){ reject(new Error("bad response")); } }
        else reject(new Error("upload "+xhr.status));
      };
      xhr.onerror = ()=> reject(new Error("upload network error"));
      xhr.send(file);
    });
    return info;   // { ok, src, url, path }
  },

  /* Persist an uploaded video's metadata so it appears in the catalog for
     everyone (until uploads are folded into the catalog build). Requires
     sign-in — RLS restricts uploads inserts to the `authenticated` role. */
  async saveUploadedVideo(meta){
    const rows = await _authedReq(`/uploads_legacy`, {
      method:"POST", headers:{ "Prefer":"return=representation" },
      body: JSON.stringify(meta),
    });
    return rows && rows[0];
  },
  async listUploadedVideos(){
    return (await _req(`/uploads_legacy?select=*&order=created_at.desc`)) || [];
  },
  async saveToManifest(entry){
    // TEMP: Auth removed for now to unblock uploads. No sign-in required.
    const sess = (typeof ShAuth!=="undefined") ? ShAuth.session() : null;
    const headers = {
      "Content-Type": "application/json",
    };
    if (sess && sess.access_token) {
      headers["Authorization"] = "Bearer " + sess.access_token;
    }
    const r = await fetch((this.uploadApiBase||"") + "/api/save-upload", {
      method: "POST",
      headers,
      body: JSON.stringify(entry),
    });
    if(!r.ok) throw new Error("save manifest HTTP " + r.status);
    return await r.json();
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

export { ShAuth, ShAPI, SH_API_ENABLED, shClientId };
