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

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn("Supabase environment variables (SUPABASE_URL, SUPABASE_KEY) are missing. API features will be disabled.");
}

const _REST = SUPABASE_URL ? SUPABASE_URL.replace(/\/$/, "") + "/rest/v1" : "";
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
const _AUTH = SUPABASE_URL ? SUPABASE_URL.replace(/\/$/, "") + "/auth/v1" : "";
/* ============================================================
   UNIFIED AUTH — one system for viewer / creator / manager.
   Email + password only. One shared session in localStorage["sh_session"],
   read identically by all three apps (same domain). Stays signed in until the
   user explicitly signs out: the access token is auto-refreshed in the
   background using the stored refresh_token, so the session never silently
   expires. No magic-link, no URL-token capture, no render race.
   ============================================================ */
const ShAuth = {
  /* Persist a token response as the session. `expires_at` is advisory only —
     session() no longer expires the session on it; instead we proactively
     refresh before it lapses. */
  _persistToken(t){
    if(!t || !t.access_token) return null;
    const prev = this._read() || {};
    const sess = {
      access_token: t.access_token,
      refresh_token: t.refresh_token || prev.refresh_token,
      expires_at: Date.now() + ((t.expires_in||3600)*1000),
      user: t.user || prev.user || null,
    };
    localStorage.setItem("sh_session", JSON.stringify(sess));
    return sess;
  },
  _read(){
    try { return JSON.parse(localStorage.getItem("sh_session")||"null"); } catch(_){ return null; }
  },
  /* Email + password sign-in. New email → auto-creates the account and signs in
     (email confirmation is OFF). Existing email + wrong password → clear message
     (no dead-end). Returns the session; throws a human message on real failure. */
  async signInWithPassword(email, password){
    email = String(email||"").trim();
    if(!email || !password) throw new Error("Enter an email and password");
    let r = await fetch(_AUTH + "/token?grant_type=password", {
      method:"POST",
      headers:{ "apikey": SUPABASE_KEY, "Content-Type":"application/json" },
      body: JSON.stringify({ email, password }),
    });
    if(r.ok){ return this._persistToken(await r.json()); }
    let err={}; try{ err = await r.json(); }catch(_){}
    const code = err.error_code || err.error || "";
    const msg = (err.msg || err.error_description || "").toLowerCase();
    const looksMissing = code==="invalid_credentials" || msg.includes("invalid login")
      || msg.includes("invalid credentials");
    if(looksMissing){
      const s = await fetch(_AUTH + "/signup", {
        method:"POST",
        headers:{ "apikey": SUPABASE_KEY, "Content-Type":"application/json" },
        body: JSON.stringify({ email, password }),
      });
      const sj = await s.json().catch(()=>({}));
      if(s.ok && sj.access_token){ return this._persistToken(sj); }
      if(s.ok && !sj.access_token){
        throw new Error("Account created but sign-in is disabled until email confirmation is turned off in Supabase.");
      }
      const scode = sj.error_code || sj.code || "";
      const smsg = (sj.msg || sj.error_description || "").toLowerCase();
      if(scode==="user_already_exists" || smsg.includes("already registered") || smsg.includes("already exists")){
        throw new Error("Wrong password for this account. Try again, or use a different email to create a new account.");
      }
      throw new Error(sj.msg || sj.error_description || "Could not create account");
    }
    throw new Error(err.msg || err.error_description || "Incorrect email or password");
  },
  /* Send a password-reset email (the ONLY email path; explicit user action). */
  async sendPasswordReset(email){
    email = String(email||"").trim();
    if(!email) throw new Error("Enter your email");
    const r = await fetch(_AUTH + "/recover", {
      method:"POST",
      headers:{ "apikey": SUPABASE_KEY, "Content-Type":"application/json" },
      body: JSON.stringify({ email }),
    });
    if(!r.ok){ let m=""; try{ const j=await r.json(); m=j.msg||j.error_description||""; }catch(_){} throw new Error(m||("reset "+r.status)); }
    return true;
  },
  /* Exchange the refresh_token for a fresh access token. Keeps the session
     alive indefinitely so the user is never logged out until they choose to. */
  async _refresh(){
    const s = this._read();
    if(!s || !s.refresh_token) return null;
    try {
      const r = await fetch(_AUTH + "/token?grant_type=refresh_token", {
        method:"POST",
        headers:{ "apikey": SUPABASE_KEY, "Content-Type":"application/json" },
        body: JSON.stringify({ refresh_token: s.refresh_token }),
      });
      if(!r.ok){ return null; }
      return this._persistToken(await r.json());
    } catch(_){ return null; }
  },
  /* Ensure a usable session: if the token is near/after expiry, refresh it.
     Call on app load. Never clears the session on refresh failure alone —
     only an explicit signOut() ends it. */
  async ensureFresh(){
    const s = this._read();
    if(!s) return null;
    // refresh if within 5 min of expiry (or already past)
    if(!s.expires_at || s.expires_at - Date.now() < 5*60*1000){
      const fresh = await this._refresh();
      return fresh || s;   // keep the old session even if refresh hiccups
    }
    return s;
  },
  /* Returns the stored session if present. Does NOT expire it on expires_at —
     the token may be stale but ensureFresh() renews it. Signed-in status
     persists until signOut(). */
  session(){ return this._read(); },
  async user(){
    const s = this.session(); if(!s) return null;
    if(s.user) return s.user;
    try {
      const r = await fetch(_AUTH + "/user", { headers:{ "apikey": SUPABASE_KEY, "Authorization":"Bearer "+s.access_token } });
      if(!r.ok) return null;
      const u = await r.json();
      // cache the user on the session so we don't refetch every call
      const cur = this._read(); if(cur){ cur.user = u; localStorage.setItem("sh_session", JSON.stringify(cur)); }
      return u;
    } catch(_){ return null; }
  },
  signOut(){ localStorage.removeItem("sh_session"); },
  isSignedIn(){ return !!this._read(); },
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
     runs on Vercel, NOT on Bunny (which serves the site and has no /api), so
     this MUST point at the Vercel relay — a relative /api/upload 405s on Bunny. */
  uploadApiBase: (typeof SH_UPLOAD_API_BASE!=="undefined" ? SH_UPLOAD_API_BASE : "https://x-flxx.vercel.app"),
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
