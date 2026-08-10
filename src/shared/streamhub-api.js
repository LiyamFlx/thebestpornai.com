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
  if(!_REST || !SUPABASE_KEY) return null;
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), 6000);
  try {
    const r = await fetch(_REST + path, { ...opts, headers:{ ..._HEADERS, ...(opts.headers||{}) }, signal: ctrl.signal }).catch(()=>null);
    if(!r || !r.ok) return null;
    const txt = await r.text().catch(()=>null);
    return txt ? JSON.parse(txt) : null;
  } catch(_) {
    return null;
  } finally { clearTimeout(t); }
}

/* Exact row count via PostgREST's Prefer: count=exact + a HEAD request —
   returns just the count from the Content-Range response header, never the
   matching rows themselves. Used instead of `select=id` + rows.length so
   like/view counts stay O(1) response size as engagement grows; a plain
   select can silently undercount once a video's row count exceeds
   PostgREST's/Supabase's default row cap. */
async function _count(path){
  if(!_REST || !SUPABASE_KEY) return 0;
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), 6000);
  try {
    const r = await fetch(_REST + path, {
      method: "HEAD",
      headers: { ..._HEADERS, "Prefer": "count=exact" },
      signal: ctrl.signal,
    }).catch(()=>null);
    if(!r || !r.ok) return 0;
    // Content-Range: "0-24/137" (or "*/137" for a HEAD with no range) — total
    // is always the part after the slash.
    const range = r.headers.get("content-range") || "";
    const total = Number(range.split("/")[1]);
    return Number.isFinite(total) ? total : 0;
  } catch(_) {
    return 0;
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
    const [like, dislike] = await Promise.all([
      _count(`/likes?video_id=eq.${videoId}&kind=eq.like&select=id`),
      _count(`/likes?video_id=eq.${videoId}&kind=eq.dislike&select=id`),
    ]);
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

  /* ---- VIEWS ----
     Deduped to one insert per (video, client) per UTC day.
     Server RLS historically rejected re-inserts with 401 (PostgREST maps
     RLS failures that way) — noisy in DevTools on every refresh. We:
       1) skip the POST if this browser already recorded today (localStorage),
       2) send Prefer: resolution=ignore-duplicates for multi-tab races once
          the unique-day index migration is applied (schema-views-upsert.sql).
  */
  async addView(videoId){
    const id = Number(videoId);
    if(!Number.isFinite(id)) return;
    const day = new Date().toISOString().slice(0, 10); // UTC day key
    const lsKey = "sh_viewed_" + day;
    let seen = [];
    try {
      const raw = JSON.parse(localStorage.getItem(lsKey) || "[]");
      if(Array.isArray(raw)) seen = raw;
    } catch(_){}
    if(seen.includes(id)) return; // already posted today — avoid 401 spam
    seen.push(id);
    if(seen.length > 800) seen = seen.slice(-800);
    try { localStorage.setItem(lsKey, JSON.stringify(seen)); } catch(_){}

    await _req(`/views`, {
      method: "POST",
      headers: { "Prefer": "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ video_id: id, client_id: shClientId() }),
    });
  },
  async viewCount(videoId){
    return _count(`/views?video_id=eq.${videoId}&select=id`);
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
    return _count(`/favorites?video_id=eq.${videoId}&select=id`);
  },

  /* ---- VIDEO UPLOAD (direct-to-R2 via presigned PUT) ----
     No sign-in required. The browser asks our /api/presign endpoint for a
     short-lived signed URL, then PUTs the file bytes STRAIGHT to Cloudflare R2 —
     no serverless relay in the byte path, so there's no Vercel body-size wall,
     real upload progress, and multiple uploads can run in parallel.
     Same-origin (`/api/...`) — the site and functions are both on Vercel now. */
  uploadApiBase: (typeof SH_UPLOAD_API_BASE!=="undefined" ? SH_UPLOAD_API_BASE : ""),

  /* Shared fetch wrapper for the upload pipeline's own /api/* calls (attest,
     verify-upload, save-upload) — NOT the R2 PUT itself, which has its own
     progress/error handling and must never be silently retried mid-transfer.
     By the time these run the file is already safely on R2, so a transient
     network hiccup on the follow-up call shouldn't force a full re-upload:
     one retry after a short backoff, plus a generous timeout since
     verify-upload streams the file back from R2 to hash it server-side and
     can legitimately take a while for a large real video. */
  async _uploadApiFetch(pathSuffix, body, { timeoutMs = 90000 } = {}){
    const attempt = async ()=>{
      const ctrl = new AbortController();
      const t = setTimeout(()=>ctrl.abort(), timeoutMs);
      try {
        return await fetch((this.uploadApiBase||"") + pathSuffix, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
      } finally { clearTimeout(t); }
    };
    try {
      return await attempt();
    } catch(e){
      // Network-level failure (abort/timeout/DNS) — retry once. A real HTTP
      // error response (4xx/5xx) still reaches the caller on the first try,
      // since fetch() only throws for network failures, not error statuses;
      // callers already handle non-ok statuses themselves.
      await new Promise(r=>setTimeout(r, 1500));
      return await attempt();
    }
  },

  /* Consent/rights attestation — MUST be called (and its returned token
     supplied to verifyUpload) before an upload is accepted at all.
     `statements` should reflect what the consent UI actually showed/checked
     (age confirmation, content-rights confirmation, etc.) — kept as the
     legal record in upload_attestations. Cached in-memory per session so a
     multi-file batch upload only attests once. */
  _attestToken: null, _attestClientId: null,
  async attestUpload(statements){
    const clientId = shClientId();
    const r = await this._uploadApiFetch("/api/attest", { clientId, confirmed: true, statements }, { timeoutMs: 15000 });
    if(!r.ok){
      let msg = "attest " + r.status;
      try { const j = await r.json(); if(j.error) msg = j.error; } catch(_){}
      throw new Error(msg);
    }
    const { token } = await r.json();
    this._attestToken = token; this._attestClientId = clientId;
    return token;
  },

  /* Server-verified compliance gate: real SHA-256 of the uploaded bytes,
     banned/duplicate-hash check, CSAM interception (publishes instantly
     unless an actual vendor flag comes back — see api/verify-upload.js).
     Must be called after uploadVideo() and before saveToManifest() —
     saveToManifest now requires the uploadId this returns. Throws if
     attestUpload() hasn't been called yet in this session. */
  async verifyUpload({ path, title, width, height, durationS }){
    if(!this._attestToken || this._attestClientId !== shClientId()){
      throw new Error("call attestUpload() before verifyUpload()");
    }
    // Timeout must exceed the server's own maxDuration (300s in
    // api/verify-upload.js, since it streams+hashes the full file from R2
    // and retries once on failure) — otherwise the client gives up and
    // retries a request the server was still legitimately working on.
    const r = await this._uploadApiFetch("/api/verify-upload", {
      clientId: this._attestClientId, path, attestToken: this._attestToken,
      title, width, height, durationS,
    }, { timeoutMs: 320000 });
    const j = await r.json().catch(()=>({}));
    if(!r.ok || j.ok === false){
      throw new Error(j.reason || j.error || ("verify-upload " + r.status));
    }
    return j;   // { ok:true, uploadId, status: 'live'|'held', sha256 }
  },

  async uploadVideo(file, title, onProgress){
    // 1. Ask the server to sign a one-time PUT URL for this file.
    const presignRes = await this._uploadApiFetch("/api/presign", { filename: file.name || "video.mp4", size: file.size }, { timeoutMs: 15000 });
    if(!presignRes.ok){
      let msg = "presign " + presignRes.status;
      try { const j = await presignRes.json(); if(j.error) msg = j.error; } catch(_){}
      throw new Error(msg);
    }
    const { putUrl, contentType, src, url, path } = await presignRes.json();

    // 2. PUT the raw bytes directly to R2 with progress. Without xhr.timeout a
    // genuinely stalled transfer (connection silently dies mid-upload, no
    // error, no more progress events) hangs forever — neither onload nor
    // onerror ever fires on their own.
    await new Promise((resolve, reject)=>{
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", putUrl, true);
      xhr.timeout = 20 * 60 * 1000;   // 20 min ceiling for very large files on slow connections
      xhr.setRequestHeader("Content-Type", contentType || "application/octet-stream");
      if(onProgress) xhr.upload.onprogress = e=>{ if(e.lengthComputable) onProgress(Math.round(e.loaded/e.total*100)); };
      xhr.onload = ()=> (xhr.status>=200 && xhr.status<300) ? resolve() : reject(new Error("upload "+xhr.status));
      xhr.onerror = ()=> reject(new Error("upload network error"));
      xhr.ontimeout = ()=> reject(new Error("upload timed out — check your connection and try again"));
      xhr.send(file);
    });
    return { ok:true, src, url, path };
  },

  /* Publish the uploaded video's metadata to the shared R2 manifest so it
     appears in every visitor's feed. No sign-in required (open uploads). */
  async saveToManifest(entry){
    // Longer timeout + retry: this does a read-modify-write of the whole R2
    // manifest with optimistic-concurrency retries server-side, which can
    // legitimately take a few seconds under contention.
    const r = await this._uploadApiFetch("/api/save-upload", entry, { timeoutMs: 30000 });
    if(!r.ok){
      let msg = "save manifest HTTP " + r.status;
      try { const j = await r.json(); if(j.error) msg = j.error; } catch(_){}
      throw new Error(msg);
    }
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
