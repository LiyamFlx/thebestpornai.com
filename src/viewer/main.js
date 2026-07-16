import { MEDIA_BASE, DATA, esc, creatorName, fmt, toast, mediaUrl, ytId } from "../shared/catalog.js";
import { ShAuth, ShAPI } from "../shared/streamhub-api.js";
import { ageGate } from "../shared/age-gate.js";
import { playerEmbed, videoCard, rowSection } from "../shared/ui.js";
import { mountDropzone } from "../upload/global-dropzone.js";
import { mergeLiveUploads } from "../upload/catalog-overlay.js";
import "../upload/upload.css";
// Keep the session alive on load (refresh the token if near expiry). The
// session persists until the user explicitly signs out — no magic-link, no
// URL-token capture, so nothing to race with ageGate/render.
if (typeof ShAuth !== "undefined") ShAuth.ensureFresh();
ageGate();

/* creatorName(), fmt(), toast() are shared — defined in catalog.js */

/* ---- Safe string transport for inline onclick attributes ----
   esc() protects HTML context only; the browser entity-decodes attribute
   values BEFORE the JS engine parses them, so esc'd quotes still break out of
   the JS string literal (XSS via manifest-supplied titles/ids). jsq() URI-
   encodes the value (incl. apostrophes, which encodeURIComponent leaves raw);
   the receiving function decodes with jsdec(). Output is [A-Za-z0-9%.\-_~]
   only — inert in both HTML-attribute and JS-string contexts. */
const jsq = s => encodeURIComponent(String(s)).replace(/'/g, "%27");
const jsdec = s => { try { return decodeURIComponent(s); } catch(_) { return String(s); } };

/* Public-catalog filter: private videos must never surface in feeds, search,
   trending, suggestions, or keyboard nav (previously only the creator page
   filtered them). */
const visible = v => v && v.status !== "private";
const pubVideos = () => DATA.videos.filter(visible);

/* toast() is shared — defined in catalog.js */

/* ===================== VIEWER APP ===================== */
let vstate = {
  page:"home", current:null, creatorId:null,
  favorites:[], later:[], history:[], downloads:[],
  subs:["c1","c2"],
  homeFilter:"all",   // "all" | "movies" | "scenes" | "clips"
  homeSort:"none",    // "none" | "latest" | "likes" | "views"
  commentPage: 1,     // comments paginated at COMMENTS_PER_PAGE
  commentSort: "new", // owned by state, not read back from the DOM mid-render
  searchQuery: "",    // search is a real page in the render pipeline now
  live: {},           // id -> {like, dislike} counts layered over seed values
  limit: 36,          // simple grid pagination / load more
  flags: { globalUpload: true },  // feature flag: site-wide drag-drop upload
  pendingUploads: [], // uploader-only overlay of in-flight/own uploads
};
const COMMENTS_PER_PAGE = 20;
const HISTORY_MAX = 50;
function setHomeFilter(f){ vstate.homeFilter = f; render(); }
function setHomeSort(s){ vstate.homeSort = s; render(); }

function pushHistory(id){
  if(vstate.history.includes(id)) return;
  vstate.history.unshift(id);
  if(vstate.history.length > HISTORY_MAX) vstate.history.length = HISTORY_MAX;
}

function go(p){ vstate.page=p; setHash(p==="home"?"":p); render(); }
function focusSearch(){
  const i=document.getElementById("searchInput");
  if(i){ i.scrollIntoView({block:"start",behavior:"smooth"}); i.focus(); }
}
function openVideo(id){
  id = +id;
  vstate.current = DATA.videos.find(v=>v.id===id);
  if(!vstate.current) return;
  pushHistory(id);
  vstate.commentPage = 1;
  vstate.page="watch"; setHash("video/"+id); render();
  hydrateWatch(id);   // fetch real counts/comments and patch them in (non-blocking)
}

/* Views already recorded this session — openVideo can fire repeatedly for the
   same video (back/forward, related-row loops) and must not inflate counts. */
const _viewed = new Set();

/* Pull persisted likes/comments from Supabase and patch the already-rendered
   watch page. Best-effort: any failure leaves the seeded values in place.
   Also records the view here so it fires on BOTH the click path (openVideo) and
   the direct-link/refresh path (applyHash -> render -> pending hydrate). */
async function hydrateWatch(id){
  if(typeof ShAPI==="undefined" || !ShAPI.enabled) return;
  if(!_viewed.has(id)){ _viewed.add(id); _persist(()=> ShAPI.addView(id)); }
  try {
    const [counts, comments, views, favCount] = await Promise.all([
      ShAPI.likeCounts(id), ShAPI.listComments(id), ShAPI.viewCount(id), ShAPI.favoriteCount(id)
    ]);
    if(vstate.current && vstate.current.id===id && onWatch()){
      const v = vstate.current;
      // Server counts become the authoritative overlay; they already include
      // any votes we persisted earlier, so we never mutate the seed values
      // (previously v.likes++ plus counts.like double-counted own likes).
      vstate.live[id] = { like: counts.like||0, dislike: counts.dislike||0 };
      const likeNum=document.getElementById("likeNum"), disNum=document.getElementById("disNum");
      if(likeNum) likeNum.textContent = fmt(v.likes + vstate.live[id].like);
      if(disNum)  disNum.textContent  = fmt(v.dislikes + vstate.live[id].dislike);
      // Views (seed + real) in the sub line.
      const subEl=document.getElementById("watchSub");
      if(subEl) subEl.innerHTML = "👁 " + fmt(v.views + (views||0)) + " views <span class='dot-sep'>•</span> " + esc(v.uploaded);
      // Favorites count chip.
      const favCountEl=document.getElementById("favCount");
      if(favCountEl) favCountEl.textContent = favCount ? (" ("+fmt(favCount)+")") : "";
      if(comments && comments.length){
        // Merge persisted comments into DATA.comments (avoid dupes) and re-render the list region.
        for(const c of comments){
          const key = "db"+c.id;
          if(!DATA.comments.some(m=>m.id===key))
            DATA.comments.push({ id:key, video:id, user:c.author, text:c.body, time:"", ts: Date.parse(c.created_at)||0 });
        }
        if(vstate.current && vstate.current.id===id && onWatch()) patchComments(v);
      }
    }
  } catch(_){ /* offline / API down -> keep seeded values */ }
}
/* ---- URL hash routing: shareable/bookmarkable per-video URLs ---- */
let _suppressHash=false;
let _pendingHydrate=null;   // video id to hydrate after the next render (direct-link/refresh path)
function setHash(h){ _suppressHash=true; location.hash = h?("#"+h):""; setTimeout(()=>_suppressHash=false,0); }
function applyHash(){
  const h=(location.hash||"").replace(/^#/,"");
  const m=h.match(/^video\/(\d+)$/);
  if(m){
    const vid=DATA.videos.find(v=>v.id===+m[1]);
    if(vid){ vstate.current=vid; pushHistory(vid.id); vstate.page="watch"; _pendingHydrate=vid.id; return; }
  }
  const mm=h.match(/^movie\/(.+)$/);
  if(mm){ vstate.currentMovieTitle=jsdec(mm[1]); vstate.page="movie"; return; }
  const mc=h.match(/^creator\/(.+)$/);
  if(mc){ vstate.creatorId=jsdec(mc[1]); vstate.page="creator"; return; }
  vstate.page = h || "home";
}
window.addEventListener("hashchange",()=>{ if(_suppressHash) return; applyHash(); render(); });
/* These actions update one on-screen control. When we're on the watch page we
   patch just that button — a full render() would rebuild #view (player + layout)
   and reset the scroll position AND restart playback, causing a visible "jump".
   We only fall back to render() when the relevant control isn't on screen
   (e.g. favoriting from a grid card), so list pages that depend on the state
   still refresh. */
function onWatch(){ return vstate.page==="watch"; }

/* Fire-and-forget persistence: never let an API failure break the UI. The
   optimistic in-memory update has already been applied by the caller, so if
   Supabase is down we simply keep that (today's fallback behavior).
   RETURNS the in-flight promise (always resolves) so callers like the vote
   lock can actually await completion — previously it returned undefined and
   the lock released synchronously, making it a no-op. */
function _persist(promiseFn){
  try {
    if(typeof ShAPI!=="undefined" && ShAPI.enabled)
      return Promise.resolve(promiseFn()).catch(()=>{});
  } catch(_){}
  return Promise.resolve();
}

function toggleFav(id){
  id = +id;
  const on = vstate.favorites.includes(id);
  on ? vstate.favorites=vstate.favorites.filter(x=>x!==id) : vstate.favorites.push(id);
  toast(!on?"Added to Favorites":"Removed from Favorites");
  _persist(()=> on ? ShAPI.removeFavorite(id) : ShAPI.addFavorite(id));
  const btn=document.getElementById("btnFav");
  if(onWatch() && btn) btn.classList.toggle("on", !on); else render();
}
function toggleLater(id){
  id = +id;
  const on = vstate.later.includes(id);
  on ? vstate.later=vstate.later.filter(x=>x!==id) : vstate.later.push(id);
  toast(!on?"Saved to Watch Later":"Removed");
  const btn=document.getElementById("btnLater");
  if(onWatch() && btn) btn.classList.toggle("on", !on); else render();
}
function download(id){ id=+id; if(!vstate.downloads.includes(id))vstate.downloads.push(id); toast("Download started (simulated)"); }
let _voting = new Set();

/* Single vote path for like/dislike. Optimistic delta lives in vstate.live
   (never mutates seed v.likes — see hydrateWatch). The _voting lock now holds
   until the persist promise settles, because _persist returns it. */
function vote(id, kind){
  id = +id;                            // coerce: onclick passes number literal, but be safe
  const key = String(id);             // single lock per video — prevents simultaneous like+dislike
  if (_voting.has(key)) return;
  _voting.add(key);
  const v=DATA.videos.find(x=>x.id===id); if(!v){ _voting.delete(key); return; }
  const L = vstate.live[id] = vstate.live[id] || {like:0, dislike:0};
  L[kind]++; toast(kind==="like"?"Liked":"Disliked");
  _persist(()=> ShAPI.addLike(id, kind)).finally(()=> _voting.delete(key));
  const num=document.getElementById(kind==="like"?"likeNum":"disNum");
  const base = kind==="like" ? v.likes : v.dislikes;
  if(onWatch() && num) num.textContent=fmt(base + L[kind]); else render();
}
const likeVideo    = id => vote(id, "like");
const dislikeVideo = id => vote(id, "dislike");

function subscribe(cid){
  cid = jsdec(cid);
  const on = vstate.subs.includes(cid);
  on ? vstate.subs=vstate.subs.filter(x=>x!==cid) : vstate.subs.push(cid);
  const subbed = !on;
  // On the watch page patch the button in place — full render restarts the player.
  const btn = onWatch() ? document.querySelector(".subscribe-btn") : null;
  if(btn){
    btn.classList.toggle("ghost", subbed);
    btn.textContent = subbed ? "Subscribed" : "＋ Subscribe";
  } else render();
}
const COMMENT_MAX_LEN = 2000;

function addComment(id){
  id = +id;
  const box=document.getElementById("cbox"); if(!box) return;
  const t=(box.value||"").trim(); if(!t)return;
  if (t.length > COMMENT_MAX_LEN) {
    toast(`Comment too long (max ${COMMENT_MAX_LEN} characters)`);
    return;
  }
  DATA.comments.push({id:"m"+Date.now(),video:id,user:DATA.user.name,text:t,time:"now",ts:Date.now()});
  box.value = "";
  _persist(()=> ShAPI.addComment(id, DATA.user.name, t));
  // Patch the comment region only — render() would tear down the player mid-playback.
  if(onWatch() && vstate.current && vstate.current.id===id) patchComments(vstate.current);
  else render();
}

const trending = ()=> pubVideos().sort((a,b)=> (b.likes*1.2+b.views*0.01) - (a.likes*1.2+a.views*0.01));
const byCat = (c)=> pubVideos().filter(v=>v.category===c);

/* ---- Movie / Scene / Clip / Act structure ----
   Optional fields on video objects (movieTitle, level, sceneNumber,
   clipNumber, actName) group related uploads without touching the flat
   clips that make up the rest of the catalog. See CLAUDE.md for the
   filename convention these fields are derived from. */
const movies = () => {
  const titles = [...new Set(pubVideos().filter(v=>v.movieTitle).map(v=>v.movieTitle))];
  return titles.map(t => {
    const scenes = pubVideos().filter(v=>v.movieTitle===t && v.level==="scene")
              .sort((a,b)=>a.sceneNumber-b.sceneNumber);
    return {
      title: t,
      // Prefer the full movie file; otherwise fall back to the lowest-numbered
      // scene (scenes is already sorted ascending, so [0] is Scene-01), NOT
      // whichever scene .find() happens to hit first in array order.
      poster: pubVideos().find(v=>v.movieTitle===t && v.level==="movie") || scenes[0],
      scenes,
    };
  }).filter(m=>m.poster);
};
const scenesFor = (movieTitle) => pubVideos().filter(v=>v.movieTitle===movieTitle && v.level==="scene").sort((a,b)=>a.sceneNumber-b.sceneNumber);
const clipsFor = (movieTitle, sceneNumber) => pubVideos().filter(v=>v.movieTitle===movieTitle && v.level==="clip" && v.sceneNumber===sceneNumber).sort((a,b)=>a.clipNumber-b.clipNumber);
/* An "Act" is either an explicit level:"act" compilation entry, or any tag
   shared by 2+ clips of the same movie (a lone tag on one clip is just
   descriptive metadata, not a cross-cutting grouping worth its own row). */
const actNames = () => {
  const names = new Set(pubVideos().filter(v=>v.level==="act" && v.actName).map(v=>v.actName));
  const byMovie = {};
  for(const v of pubVideos()){
    if(v.level!=="clip" || !v.movieTitle) continue;
    byMovie[v.movieTitle] = byMovie[v.movieTitle] || {};
    for(const t of (v.tags||[])) byMovie[v.movieTitle][t] = (byMovie[v.movieTitle][t]||0) + 1;
  }
  for(const movieTitle in byMovie){
    for(const tag in byMovie[movieTitle]){
      if(byMovie[movieTitle][tag] >= 2) names.add(tag);
    }
  }
  return [...names];
};
const clipsByAct = (actName) => pubVideos().filter(v=>v.level==="clip" && (v.tags||[]).includes(actName));
const highlights = () => pubVideos().filter(v=>v.level==="highlight");

function homeFilterBar(){
  const filters = [["all","All"],["movies","Movies"],["scenes","Scenes"],["clips","Clips"]];
  const sorts = [["none","Default"],["latest","Latest"],["likes","Most Liked"],["views","Most Viewed"]];
  return `<div class="pill-row home-filter-bar">
    ${filters.map(([key,label])=>`<button class="filter-pill ${vstate.homeFilter===key?'active':''}" onclick="setHomeFilter('${key}')">${label}</button>`).join("")}
  </div>
  <div class="pill-row home-sort-bar">
    ${sorts.map(([key,label])=>`<button class="filter-pill ${vstate.homeSort===key?'active':''}" onclick="setHomeSort('${key}')">${label}</button>`).join("")}
  </div>`;
}

function sortedVideos(sort){
  const vids = pubVideos().slice();
  if(sort==="latest") return vids.sort((a,b)=>b.uploaded.localeCompare(a.uploaded));
  if(sort==="likes") return vids.sort((a,b)=>b.likes-a.likes);
  if(sort==="views") return vids.sort((a,b)=>b.views-a.views);
  return vids;
}

const HERO_VIDEO_ID = 470; // pinned homepage hero — update this id to change it
function renderHome(){
  const hero = pubVideos().find(v=>v.id===HERO_VIDEO_ID) || pubVideos().find(v=>v.type==="original") || pubVideos()[0];
  if(!hero) return `<div class="empty">No videos available yet.</div>`;
  const top = trending();   // compute once; reused by the two rows below
  const filter = vstate.homeFilter;
  const sort = vstate.homeSort;

  // A non-default sort takes priority over the Movies/Scenes/Clips filter and
  // replaces the usual row set with one flat grid, same pattern as those filters.
  if(sort!=="none"){
    const label = sort==="latest" ? "Latest" : sort==="likes" ? "Most Liked" : "Most Viewed";
    const all = sortedVideos(sort).slice(0, vstate.limit);
    return `
      ${homeFilterBar()}
      ${all.length ? `<h3>${label}</h3><div class="grid">${all.map(v=>videoCard(v)).join("")}</div>` : `<div class="empty">No videos yet.</div>`}
      ${pubVideos().length > vstate.limit ? `<button class="btn ghost" style="margin:16px auto;display:block" onclick="loadMore()">Load more videos</button>` : ''}
    `;
  }

  // Movies/Scenes/Clips filters replace the usual row set with a focused view;
  // "all" (the default) keeps today's full homepage layout unchanged.
  if(filter==="movies"){
    const allMovies = movies();
    return `
      ${homeFilterBar()}
      ${allMovies.length
        ? `<h3>Movies</h3><div class="row-scroll">${allMovies.map(m=>videoCard(m.poster, {onClick:`openMovie('${jsq(m.title)}')`})).join("")}</div>`
        : `<div class="empty">No movies yet.</div>`}
    `;
  }
  if(filter==="scenes"){
    const allScenes = pubVideos().filter(v=>v.level==="scene");
    return `${homeFilterBar()}${allScenes.length ? rowSection("Scenes", allScenes) : `<div class="empty">No scenes yet.</div>`}`;
  }
  if(filter==="clips"){
    const allClips = pubVideos().filter(v=>v.level==="clip");
    return `${homeFilterBar()}${allClips.length ? rowSection("Clips", allClips) : `<div class="empty">No clips yet.</div>`}`;
  }

  return `
    ${homeFilterBar()}
    <div class="hero">
      ${hero.src && !ytId(hero.src) ? `<video src="${mediaUrl(hero.src)}" muted autoplay loop playsinline></video>` : ``}
      <div class="hero-body">
        <span class="tag">HOUSE ORIGINAL</span>
        <h1>${esc(hero.title)}</h1>
        <p class="sub">${esc(creatorName(hero.creator))} • ${fmt(hero.views)} views</p>
        <button class="btn" onclick="openVideo(${hero.id})">▶ Play</button>
        <button class="btn ghost" onclick="toggleLater(${hero.id})">+ Watch Later</button>
      </div>
    </div>
    ${vstate.history.length ? rowSection("Continue Watching", vstate.history.map(id=>DATA.videos.find(v=>v.id===id)).filter(Boolean)) : ""}
    ${rowSection("Recommended For You", (()=>{ const nw=top.filter(v=>!vstate.history.includes(v.id)); return nw.length>=6?nw.slice(0, vstate.limit):top.slice(0, vstate.limit); })())}
    ${rowSection("Trending Now", pubVideos().sort((a,b)=>b.views-a.views).slice(0, vstate.limit))}
    ${rowSection("House Originals", pubVideos().filter(v=>v.type==="original").slice(0, vstate.limit))}
    ${(() => {
      const allMovies = movies();
      if(!allMovies.length) return "";
      return `<h3>Movies</h3><div class="row-scroll">${allMovies.map(m=>videoCard(m.poster, {onClick:`openMovie('${jsq(m.title)}')`})).join("")}</div>`;
    })()}
    ${rowSection("Highlights", highlights())}
    ${actNames().map(a=>rowSection("Act: "+esc(a), clipsByAct(a))).join("")}
    ${DATA.categories.map(c=>rowSection(c, byCat(c))).join("")}
    ${rowSection("Recently Uploaded", pubVideos().sort((a,b)=>b.uploaded.localeCompare(a.uploaded)).slice(0, vstate.limit))}
    ${pubVideos().length > vstate.limit ? `<button class="btn ghost" style="margin:16px auto;display:block" onclick="loadMore()">Load more videos</button>` : ''}
  `;
}

function loadMore(){
  vstate.limit = (vstate.limit || 36) + 24;
  render();
}

/* Basic structured data for SEO / AI Overviews (VideoObject on watch, Collection on home).
   Injected dynamically so it reflects current video or page state. */
function addStructuredData(){
  // Remove previous injected schema
  document.querySelectorAll('script[data-structured]').forEach(s => s.remove());

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-structured', 'true');

  let json = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "thebestpornai",
    "url": "https://www.thebestpornai.com/"
  };

  if (vstate.page === "watch" && vstate.current) {
    const v = vstate.current;
    json = {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      "name": v.title,
      "description": `${v.title} by ${creatorName(v.creator)}`,
      "thumbnailUrl": v.thumb ? mediaUrl(v.thumb) : undefined,
      "uploadDate": v.uploaded,
      "duration": v.duration ? `PT${v.duration.replace(':', 'M')}S` : undefined,
      "contentUrl": v.src ? mediaUrl(v.src) : undefined,
      "interactionStatistic": [
        { "@type": "InteractionCounter", "interactionType": "https://schema.org/LikeAction", "userInteractionCount": v.likes },
        { "@type": "InteractionCounter", "interactionType": "https://schema.org/ViewAction", "userInteractionCount": v.views }
      ]
    };
  }

  script.textContent = JSON.stringify(json);
  document.head.appendChild(script);
}

function renderMovieDetail(){
  const title = vstate.currentMovieTitle;
  const scenes = scenesFor(title);
  if(!title || !scenes.length) return `<div class="empty">Movie not found.</div>`;

  const movieEntry = pubVideos().find(v=>v.movieTitle===title && v.level==="movie") || scenes[0];
  const allClips = scenes.flatMap(scene => clipsFor(title, scene.sceneNumber));
  const clipList = allClips.length ? allClips : scenes;
  // Acts present in this movie only (not the whole-site actNames()), so the
  // badge reflects what's actually in this movie's clips.
  const movieActs = new Set();
  for(const c of allClips) for(const t of (c.tags||[])) movieActs.add(t);
  const badgeFor = (v) => {
    const t = (v.tags||[]).find(t=>movieActs.has(t));
    return t || null;
  };

  const related = trending().filter(v=>v.movieTitle!==title).slice(0,8);
  const primaryCategory = movieEntry.category;
  const similar = primaryCategory ? byCat(primaryCategory).filter(v=>v.movieTitle!==title).slice(0,8) : [];
  const more = pubVideos().filter(v=>v.movieTitle!==title).sort((a,b)=>b.uploaded.localeCompare(a.uploaded)).slice(0,10);

  return `
    <div class="movie-detail">
      <div class="movie-hero">
        ${movieEntry.src && !ytId(movieEntry.src) ? `<video src="${mediaUrl(movieEntry.src)}" muted autoplay loop playsinline></video>` : ``}
        <div class="movie-hero-topnav">
          <button class="icon-btn movie-back" onclick="go('home')" aria-label="Back">←</button>
          <button class="icon-btn movie-menu" onclick="go('categories')" aria-label="Menu">☰</button>
        </div>
        <div class="movie-hero-body">
          <h1 class="movie-title">${esc(title)}</h1>
          <div class="movie-cta-row">
            <button class="btn" onclick="openVideo(${movieEntry.id})">▶ Play</button>
            <button class="btn ghost" onclick="toggleLater(${movieEntry.id})">+ Watch Later</button>
          </div>
        </div>
      </div>
      <div class="movie-factstrip">
        <span class="pill-tag">18+</span>
        <span>${clipList.length} Clip${clipList.length===1?"":"s"}</span>
        ${[...movieActs].map(a=>`<span class="fact-tag">${esc(a)}</span>`).join("")}
      </div>
      ${rowSection("Clips", clipList, {badge: badgeFor})}
      ${rowSection("Related", related)}
      ${similar.length ? rowSection("Similar — "+esc(primaryCategory), similar) : ""}
      ${rowSection("More Like This", more)}
    </div>
  `;
}
function openMovie(title){
  title = jsdec(title);   // arrives URI-encoded from inline onclick (see jsq)
  vstate.currentMovieTitle = title;
  vstate.page = "movie";
  setHash("movie/"+encodeURIComponent(title));
  render();
}

function renderCommentList(v){
  const cms = DATA.comments.filter(m=>m.video===v.id);
  if(!cms.length) return `<div class="comments-empty"><div class="ce-icon">💬</div><div class="ce-title">No comments yet.</div><div class="small">Be the first to share your thoughts!</div></div>`;
  const sorted = sortComments(cms);
  const shown = sorted.slice(0, vstate.commentPage * COMMENTS_PER_PAGE);
  const hasMore = sorted.length > shown.length;
  return shown.map(m=>`<div class="comment"><div class="avatar avatar-sm">${esc((m.user||'?')[0])}</div><div style="flex:1;min-width:0"><div><b>${esc(m.user)}</b> <span class="small">${esc(m.time)}</span></div><div class="comment-text">${esc(m.text)}</div></div></div>`).join("")
    + (hasMore ? `<button class="btn ghost sm" style="width:100%;margin-top:10px" onclick="loadMoreComments()">Load more comments (${sorted.length - shown.length} remaining)</button>` : '');
}

/* Re-render just the comment region of the watch page (list + count bubble).
   Used by addComment / sort / pagination / hydrate so the <video> element and
   scroll position survive. */
function patchComments(v){
  const cl = document.getElementById("commentList");
  if(cl) cl.innerHTML = renderCommentList(v);
  const cc = document.getElementById("cCount");
  if(cc) cc.textContent = DATA.comments.filter(m=>m.video===v.id).length;
}

function renderWatch(){
  const v = vstate.current || pubVideos()[0];
  if(!v) return `<div class="empty">No video selected.</div>`;
  const c = DATA.creators.find(x=>x.id===v.creator) || { name:"Unknown", id:"", verified:false, subs:0 };
  const subbed = vstate.subs.includes(v.creator);
  const cms = DATA.comments.filter(m=>m.video===v.id);
  const live = vstate.live[v.id] || {like:0, dislike:0};
  const related = trending().filter(u=>u.id!==v.id).slice(0,6);
  const suggestedCard = u=>`
    <div class="card" style="display:flex;gap:10px;margin-bottom:10px;padding:8px" onclick="openVideo(${u.id})">
      <div class="video-thumb ${u.type==='original'?'original':''}" style="width:120px;height:68px;margin:0;flex:none">
        ${u.src && !ytId(u.src) ? `<video class="thumb-video lazy" data-src="${mediaUrl(u.src)}#t=1" muted preload="none"></video>` : ``}
      </div>
      <div><div class="title">${esc(u.title)}</div><div class="meta">${esc(creatorName(u.creator))}</div><div class="small">${fmt(u.views)} views</div></div>
    </div>`;
  return `
    <div class="watch">
      ${playerEmbed(v)}
      <div class="watch-body">
      <div>
        <h2 class="watch-title">${esc(v.title)}</h2>
        <p class="sub watch-sub" id="watchSub"><span class="ic-eye">👁</span> ${fmt(v.views)} views <span class="dot-sep">•</span> ${esc(v.uploaded)}</p>
        ${(v.categories?.length || v.category || v.tags?.length) ? `<div class="video-tags">
          ${[v.category,...(v.categories||[])].filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,5).map(c=>`<span class="vtag vtag-cat" onclick="go('categories')">${esc(c)}</span>`).join("")}
          ${(v.tags||[]).slice(0,8).map(t=>`<span class="vtag vtag-tag">#${esc(t)}</span>`).join("")}
        </div>` : ''}

        <div class="watch-actions">
          <div class="vote-pill">
            <button id="btnLike" class="vote-btn" onclick="likeVideo(${v.id})"><span class="ic">👍</span> <span id="likeNum">${fmt(v.likes + live.like)}</span></button>
            <span class="vote-div"></span>
            <button id="btnDislike" class="vote-btn" onclick="dislikeVideo(${v.id})"><span class="ic">👎</span> <span id="disNum">${fmt(v.dislikes + live.dislike)}</span></button>
          </div>
          <button id="btnFav" class="act-btn ${vstate.favorites.includes(v.id)?'on':''}" onclick="toggleFav(${v.id})"><span class="ic">♥</span> Favorite<span id="favCount"></span></button>
          <button id="btnLater" class="act-btn ${vstate.later.includes(v.id)?'on':''}" onclick="toggleLater(${v.id})"><span class="ic">🔖</span> Save</button>
          <button class="act-btn" onclick="shareVideo(${v.id})"><span class="ic">↗</span> Share</button>
          <button class="act-btn act-more" onclick="toast('Report submitted (simulated)')" title="More" aria-label="More">···</button>
        </div>

        <div class="creator-card">
          <div class="avatar avatar-lg">${esc((c.name||"?")[0])}</div>
          <div style="flex:1;min-width:0">
            <div class="creator-name"><span class="creator-link" onclick="openCreator('${jsq(c.id)}')">${esc(c.name)}</span> ${c.verified?'<span class="verified" title="Verified">✓</span>':''}</div>
            <div class="small">${fmt(c.subs)} subscribers</div>
          </div>
          <button class="btn subscribe-btn ${subbed?'ghost':''}" onclick="subscribe('${jsq(c.id)}')">${subbed?'Subscribed':'＋ Subscribe'}</button>
        </div>

        <div class="comments-card">
          <div class="comments-top">
            <div class="comments-title">Comments <span class="count-bubble" id="cCount">${cms.length}</span></div>
            <select class="sort-select" id="cSort" onchange="setCommentSort(this.value)">
              <option value="new" ${vstate.commentSort==='new'?'selected':''}>Newest first</option>
              <option value="old" ${vstate.commentSort==='old'?'selected':''}>Oldest first</option>
            </select>
          </div>
          <div class="comment-form">
            <div class="avatar avatar-sm">${esc((DATA.user.name||'?')[0])}</div>
            <input class="fld" id="cbox" placeholder="Add a comment…" onkeydown="if(event.key==='Enter')addComment(${v.id})"/>
            <button class="btn" onclick="addComment(${v.id})">Comment</button>
          </div>
          <div class="comment-list" id="commentList">
            ${renderCommentList(v)}
          </div>
        </div>

        <div class="related-below">
          <h3>Related Videos</h3>
          <div class="grid">${related.map(u=>videoCard(u)).join("")}</div>
        </div>
      </div>
      <div class="watch-side">
        <h3 style="margin-top:0">Suggested Videos</h3>
        ${related.map(suggestedCard).join("")}
      </div>
      </div>
    </div>`;
}

/* Sort comments by real timestamp. DB comments carry `ts` parsed from
   created_at; locally-added comments stamp `ts` with Date.now() at creation.
   Legacy seeded comments have no ts at all — they sort as oldest (0).
   Sort order lives in vstate.commentSort — reading the <select> back from
   the DOM mid-render raced against the rebuild and reset the selection. */
function sortComments(cms){
  const key = m => m.ts || 0;
  const sorted = [...cms].sort((a,b)=> key(b)-key(a));   // newest first
  return vstate.commentSort==="old" ? sorted.reverse() : sorted;
}
function setCommentSort(val){
  vstate.commentSort = val==="old" ? "old" : "new";
  vstate.commentPage = 1;
  if(onWatch() && vstate.current) patchComments(vstate.current); else render();
}
function shareVideo(id){
  const url = location.href.split("#")[0] + "#video/" + id;
  if(navigator.clipboard) navigator.clipboard.writeText(url).then(()=>toast("Link copied"),()=>toast("Link: "+url));
  else toast("Link: "+url);
}

function openCreator(cid){
  cid = jsdec(cid);   // arrives URI-encoded from inline onclick (see jsq)
  vstate.creatorId = cid;
  vstate.page = "creator";
  setHash("creator/"+encodeURIComponent(cid));
  render();
}

function renderCreatorPage(){
  const cid = vstate.creatorId;
  const c = DATA.creators.find(x=>x.id===cid);
  if(!c) return `<div class="empty">Creator not found.</div>`;
  const videos = DATA.videos.filter(v=>v.creator===cid && visible(v));
  const subbed = vstate.subs.includes(cid);
  const top5 = [...videos].sort((a,b)=>(b.likes*1.2+b.views*.01)-(a.likes*1.2+a.views*.01)).slice(0,5);
  return `
    <div class="creator-page">
      <div class="creator-page-banner"></div>
      <div class="creator-page-header">
        <div class="creator-page-avatar">${esc((c.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase())}</div>
        <div class="creator-page-info">
          <h2 class="creator-page-name">${esc(c.name)} ${c.verified?'<span class="verified" title="Verified">✓</span>':''}</h2>
          <div class="small" style="margin-top:4px">${c.handle?esc(c.handle)+' · ':''}${fmt(c.subs)} subscribers · ${videos.length} video${videos.length!==1?'s':''}</div>
          ${c.bio?`<p class="creator-bio">${esc(c.bio)}</p>`:''}
        </div>
        <button class="btn subscribe-btn ${subbed?'ghost':''}" onclick="subscribe('${jsq(cid)}')">${subbed?'✓ Subscribed':'＋ Subscribe'}</button>
      </div>
      ${top5.length ? `<h3 style="margin-top:28px">Top Videos</h3><div class="row-scroll">${top5.map(v=>videoCard(v)).join("")}</div>` : ''}
      <h3 style="margin-top:20px">All Videos <span class="count-bubble">${videos.length}</span></h3>
      ${videos.length
        ? `<div class="grid">${videos.map(v=>videoCard(v)).join("")}</div>`
        : `<div class="empty">No videos yet.</div>`}
    </div>`;
}

function listPage(title, list, emptyMsg){
  return `<h2>${title}</h2><p class="sub">${list.length} item${list.length!==1?'s':''}</p>
    ${list.length?`<div class="grid">${list.map(v=>videoCard(v)).join("")}</div>`:`<div class="empty">${emptyMsg}</div>`}`;
}

function renderCategories(){
  return `<h2>Categories</h2><p class="sub">Browse by topic</p>
    ${DATA.categories.map(c=>`<h3>${esc(c)}</h3><div class="row-scroll">${byCat(c).map(v=>videoCard(v)).join("")||'<div class="small">No videos yet.</div>'}</div>`).join("")}`;
}
function renderSubs(){
  const list = pubVideos().filter(v=>vstate.subs.includes(v.creator));
  return `<h2>Subscriptions</h2><p class="sub">Latest from creators you follow</p>
    <div class="pill-row">${DATA.creators.filter(c=>vstate.subs.includes(c.id)).map(c=>`<span class="filter-pill active">${esc(c.name)}</span>`).join("")}</div>
    <div class="grid">${list.map(v=>videoCard(v)).join("")}</div>`;
}
function renderProfile(){
  const initials = (DATA.user.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const subCreators = DATA.creators.filter(c=>vstate.subs.includes(c.id));
  return `<h2>Your Profile</h2>
    <div class="profile-hero panel">
      <div class="profile-avatar">${initials}</div>
      <div class="profile-info">
        <h3 style="margin:0 0 2px">${esc(DATA.user.name)}</h3>
        <div class="small">${esc(DATA.user.handle||"@viewer")}</div>
        <div class="profile-stats">
          <span>${vstate.subs.length} <b>subscriptions</b></span>
          <span>${vstate.favorites.length} <b>favorites</b></span>
          <span>${vstate.history.length} <b>watched</b></span>
        </div>
      </div>
    </div>
    <div class="metrics" style="margin-top:16px">
      <div class="metric"><div class="label">Favorites</div><div class="value">${vstate.favorites.length}</div><div onclick="go('favorites')" class="metric-link">View all →</div></div>
      <div class="metric"><div class="label">Watch Later</div><div class="value">${vstate.later.length}</div><div onclick="go('later')" class="metric-link">View all →</div></div>
      <div class="metric"><div class="label">History</div><div class="value">${vstate.history.length}</div><div onclick="go('history')" class="metric-link">View all →</div></div>
      <div class="metric"><div class="label">Downloads</div><div class="value">${vstate.downloads.length}</div><div onclick="go('downloads')" class="metric-link">View all →</div></div>
    </div>
    ${subCreators.length ? `
    <h3>Subscriptions</h3>
    <div class="sub-creator-list">
      ${subCreators.map(c=>`
        <div class="sub-creator-row" onclick="openCreator('${jsq(c.id)}')">
          <div class="avatar avatar-sm">${esc((c.name||"?")[0])}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px">${esc(c.name)} ${c.verified?'<span class="verified">✓</span>':''}</div>
            <div class="small">${fmt(c.subs)} subscribers</div>
          </div>
          <button class="btn ghost sm" onclick="event.stopPropagation();subscribe('${jsq(c.id)}')">Unsubscribe</button>
        </div>`).join("")}
    </div>` : ''}
    <h3>Achievements</h3>
    <div class="pill-row">
      <span class="filter-pill">🏆 Early Adopter</span>
      ${vstate.history.length>=7?'<span class="filter-pill">🔥 7-Day Streak</span>':''}
      ${vstate.favorites.length>=5?'<span class="filter-pill">⭐ Super Fan</span>':''}
      ${vstate.subs.length>=3?'<span class="filter-pill">📺 Social Viewer</span>':''}
    </div>`;
}
function renderSettings(){
  return `<h2>Settings</h2>
    <div class="panel" style="max-width:520px">
      <label class="lbl">Playback Quality</label>
      <select class="fld"><option>Auto</option><option>1080p</option><option>720p</option><option>480p</option></select>
      <label class="lbl">Autoplay next video</label>
      <select class="fld"><option>On</option><option>Off</option></select>
      <label class="lbl">Language</label>
      <select class="fld"><option>English</option><option>Español</option><option>Français</option></select>
      <label class="lbl">Theme</label>
      <select class="fld"><option>Dark (Red)</option></select>
      <br/><br/><button class="btn" onclick="toast('Settings saved')">Save Changes</button>
    </div>`;
}
function renderLive(){
  return `<h2>Live</h2><p class="sub">Streams happening now</p>
    <div class="grid">${pubVideos().slice(0,3).map(v=>videoCard(v,{extra:()=>`<div class="card-actions"><span class="chip" style="color:var(--accent2);border-color:var(--accent2)">● LIVE</span><span class="chip">${fmt(v.views)} watching</span></div>`})).join("")}</div>`;
}
function renderPlaylists(){
  return `<h2>Playlists</h2><p class="sub">Your collections</p>
    <div class="grid">
      ${["My Mix","Chill","Tech Deep-Dives"].map((p,i)=>{
        const pv = pubVideos()[i];
        const thumb = pv && pv.src && !ytId(pv.src) ? `<video class="thumb-video lazy" data-src="${mediaUrl(pv.src)}#t=1" muted preload="none"></video>` : ``;
        return `<div class="card"><div class="video-thumb">${thumb}</div>
        <div class="title">${esc(p)}</div><div class="meta">${(i+2)} videos</div></div>`;
      }).join("")}
    </div>`;
}

/* Search is a real page in the render pipeline (vstate.searchQuery), not a raw
   innerHTML write — previously any render() (fav toggle, hydrate fallback)
   silently wiped the results. */
let _searchTimer;
function doSearch(){
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(_doSearchNow, 220);
}
function _doSearchNow(){
  const el = document.getElementById("searchInput"); if(!el) return;
  const q = (el.value||"").trim();
  vstate.searchQuery = q;
  if(!q){ if(vstate.page==="search") vstate.page="home"; render(); return; }
  vstate.page = "search";
  render();
}
function renderSearch(){
  const q = vstate.searchQuery.toLowerCase();
  const vids = pubVideos().filter(v=>
    v.title.toLowerCase().includes(q) ||
    (v.category||"").toLowerCase().includes(q) ||
    (v.categories||[]).some(c=>c.toLowerCase().includes(q)) ||
    (v.tags||[]).some(t=>t.toLowerCase().includes(q))
  );
  const crs  = DATA.creators.filter(c=>c.name.toLowerCase().includes(q) || (c.handle||"").toLowerCase().includes(q));
  return `
    <h2>Search: "${esc(vstate.searchQuery)}"</h2>
    <div class="pill-row"><span class="filter-pill active">All</span><span class="filter-pill">Videos</span><span class="filter-pill">Creators</span><span class="filter-pill">Playlists</span></div>
    <h3>Creators</h3>${crs.length?`<div class="pill-row">${crs.map(c=>`<span class="filter-pill" onclick="openCreator('${jsq(c.id)}')">${esc(c.name)} ${c.verified?'✔️':''}</span>`).join("")}</div>`:'<div class="small">None</div>'}
    <h3>Videos</h3>${vids.length?`<div class="grid">${vids.map(v=>videoCard(v)).join("")}</div>`:'<div class="empty">No videos found.</div>'}`;
}

function render(){
  const v=document.getElementById("view"); const p=vstate.page;
  const map={
    home:renderHome, watch:renderWatch, categories:renderCategories, subscriptions:renderSubs,
    profile:renderProfile, settings:renderSettings, live:renderLive, playlists:renderPlaylists,
    movie:renderMovieDetail, creator:renderCreatorPage, search:renderSearch,
  };
  if(map[p]) v.innerHTML = map[p]();
  else if(p==="explore")   v.innerHTML = listPage("Explore", trending(), "");
  else if(p==="trending")  v.innerHTML = listPage("Trending", trending(), "");
  else if(p==="originals") v.innerHTML = listPage("House Originals", pubVideos().filter(x=>x.type==="original"), "");
  else if(p==="favorites") v.innerHTML = listPage("Favorites", DATA.videos.filter(x=>vstate.favorites.includes(x.id)), "Tap ★ on any video to save it here.");
  else if(p==="later")     v.innerHTML = listPage("Watch Later", DATA.videos.filter(x=>vstate.later.includes(x.id)), "Nothing saved yet.");
  else if(p==="history")   v.innerHTML = listPage("History", vstate.history.map(id=>DATA.videos.find(x=>x.id===id)).filter(Boolean), "No watch history yet.");
  else if(p==="downloads") v.innerHTML = listPage("Downloads", DATA.videos.filter(x=>vstate.downloads.includes(x.id)), "No downloads yet.");
  else v.innerHTML = renderHome();
  document.querySelectorAll("#nav button, #bottomNav button").forEach(b=>b.classList.toggle("active", b.dataset.page===p));
  lazyLoadThumbs();
  const activePlayer = document.querySelector("video.player");
  if(activePlayer){
    activePlayer.addEventListener("dblclick", (e) => {
      e.preventDefault();
      const rect = activePlayer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      const ratio = x / width;
      if(ratio < 0.3){
        activePlayer.currentTime = Math.max(0, activePlayer.currentTime - 10);
        toast("⏮ -10s");
      } else if(ratio > 0.7){
        // duration is NaN before metadata loads — guard or currentTime throws
        const d = activePlayer.duration;
        activePlayer.currentTime = isFinite(d)
          ? Math.min(d, activePlayer.currentTime + 10)
          : activePlayer.currentTime + 10;
        toast("⏭ +10s");
      } else {
        if(!document.fullscreenElement){
          activePlayer.requestFullscreen().catch(()=>{});
        } else {
          document.exitFullscreen().catch(()=>{});
        }
      }
    });
  }
  if(_pendingHydrate!=null){ const hid=_pendingHydrate; _pendingHydrate=null; hydrateWatch(hid); }

  // Structured data for search engines and AI (called after DOM update)
  addStructuredData();
}

/* Lazy-load video thumbnails: only fetch a thumbnail's metadata once its card
   scrolls near the viewport. Without this, ~180 <video> elements would all
   request metadata from the CDN on load and crawl the page. */
function revealThumb(el){
  if(el.dataset.src){ el.src = el.dataset.src; el.preload = "metadata"; el.removeAttribute("data-src"); }
  el.classList.remove("lazy");
}
/* Asymmetric margin: generous vertical lookahead for the scrolling grid pages,
   tighter horizontal so off-screen cards in `.row-scroll` rows aren't all
   fetched at once on the home feed. */
const _lazyObserver = ("IntersectionObserver" in window)
  ? new IntersectionObserver((entries, obs)=>{
      entries.forEach(e=>{
        if(!e.isIntersecting) return;
        revealThumb(e.target);
        obs.unobserve(e.target);
      });
    }, { rootMargin: "250px 80px" })
  : null;
function lazyLoadThumbs(){
  const els = document.querySelectorAll("video.lazy[data-src]");
  if(_lazyObserver){ els.forEach(el=>_lazyObserver.observe(el)); }
  else { els.forEach(revealThumb); }   // no IntersectionObserver: load eagerly
}
if(location.hash) applyHash();
render();
const _videoCountBadge = document.getElementById("videoCountBadge");
let _lastManifestSync = null;

function updateVideoCount(extra = '') {
  if (!_videoCountBadge) return;
  const base = fmt(DATA.videos.length) + ' videos';
  const sync = _lastManifestSync
    ? ' • synced ' + (Date.now() - _lastManifestSync < 60000 ? 'just now' : 'recently')
    : '';
  _videoCountBadge.textContent = base + sync + extra;
}

updateVideoCount();

/* Load user-uploaded videos from the Bunny manifest and prepend to feed.
   The manifest is remote input: validate shape and dedupe on BOTH src and id —
   an id collision would hijack the hero pin and every openVideo() lookup.
   Improvements: better error visibility (console only), freshness timestamp,
   minimal re-render when possible. */
(async () => {
  try {
    // Same-origin relative path: the manifest lives in the same Bunny storage the
    // HTML is served from, so a relative URL avoids the cross-origin CORS check
    // that blocks the absolute b-cdn.net form (Bunny returns no ACAO header).
    const url = '/manifest.json?t=' + Date.now();
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) {
      console.warn('[manifest] fetch failed', r.status);
      updateVideoCount(' • sync failed');
      return;
    }
    const uploads = await r.json();
    if (!Array.isArray(uploads) || !uploads.length) return;

    const existingSrc = new Set(DATA.videos.map(v => v.src));
    const existingIds = new Set(DATA.videos.map(v => v.id));
    const fresh = [];

    for (const v of uploads) {
      if (!v || typeof v !== 'object') continue;
      if (typeof v.src !== 'string' || !v.src) continue;
      if (existingSrc.has(v.src)) continue;
      const id = Number(v.id);
      if (!Number.isFinite(id) || existingIds.has(id)) continue;
      if (typeof v.title !== 'string') continue;

      fresh.push({ ...v, id });
      existingSrc.add(v.src);
      existingIds.add(id);
    }

    if (!fresh.length) {
      _lastManifestSync = Date.now();
      updateVideoCount();
      return;
    }

    DATA.videos.unshift(...fresh);
    _lastManifestSync = Date.now();

    // Avoid full re-render on initial load if possible
    if (location.hash) applyHash();
    const currentPageNeedsFull = ['home', 'explore', 'trending', 'categories'].includes(vstate.page);
    if (currentPageNeedsFull) {
      render();
    } else {
      // At minimum refresh counts and any visible grids that use pubVideos
      updateVideoCount();
    }
    updateVideoCount();
  } catch (e) {
    console.warn('[manifest] load error (non-fatal):', e?.message || e);
    updateVideoCount(' • sync error');
  }
})();

// Expose for manual refresh / debugging (e.g. in console: refreshManifest())
window.refreshManifest = async () => {
  _lastManifestSync = null;
  // Re-execute the loader logic by forcing a reload of the IIFE effect is complex,
  // so we do a lightweight re-fetch here for power users.
  try {
    const r = await fetch('/manifest.json?t=' + Date.now());
    if (!r.ok) throw new Error('bad status ' + r.status);
    const uploads = await r.json();
    // Minimal merge (same rules)
    const existingSrc = new Set(DATA.videos.map(v => v.src));
    const existingIds = new Set(DATA.videos.map(v => v.id));
    const fresh = (uploads || []).filter(v =>
      v && typeof v === 'object' &&
      typeof v.src === 'string' && v.src && !existingSrc.has(v.src) &&
      Number.isFinite(+v.id) && !existingIds.has(+v.id) &&
      typeof v.title === 'string'
    ).map(v => ({ ...v, id: +v.id }));

    if (fresh.length) {
      DATA.videos.unshift(...fresh);
      render();
    }
    _lastManifestSync = Date.now();
    updateVideoCount();
    console.log('[manifest] refreshed, added', fresh.length);
  } catch (e) {
    console.error('[manifest] manual refresh failed', e);
  }
};

/* Restore this browser's persisted favorites (per-visitor via client_id), then
   re-render so the favorites page / heart states reflect them. Best-effort. */
(async ()=>{
  if(typeof ShAPI==="undefined" || !ShAPI.enabled) return;
  try {
    const favs = await ShAPI.myFavorites();
    if(favs && favs.length){
      for(const id of favs){ const nid=+id; if(!vstate.favorites.includes(nid)) vstate.favorites.push(nid); }
      render();
    }
  } catch(_){}
})();

/* ---- Attach functions invoked from inline HTML event handler attributes ---- */
window.go = go;
window.focusSearch = focusSearch;
window.openVideo = openVideo;
window.toggleFav = toggleFav;
window.toggleLater = toggleLater;
window.download = download;
window.likeVideo = likeVideo;
window.dislikeVideo = dislikeVideo;
window.subscribe = subscribe;
window.addComment = addComment;
window.shareVideo = shareVideo;
window.doSearch = doSearch;
window.render = render;
window.toast = toast;

// (Magic-link session is captured at the very top of this module, before
// ageGate, so isSignedIn() is already correct by the time we get here.)

// Inline email + password sign-in for uploads. No magic link, no confirmation
// email, no rate limits — enter email + password once and you're in. First
// time an email is used it auto-creates the account (signInWithPassword).
function promptUploadSignIn() {
  if (document.getElementById("upload-signin")) return;
  const wrap = document.createElement("div");
  wrap.id = "upload-signin";
  wrap.innerHTML = `
    <div class="usi-backdrop"></div>
    <form class="usi-box">
      <div class="usi-title">Sign in to upload</div>
      <div class="usi-sub">Enter an email and password. New here? We'll create your account automatically.</div>
      <input class="usi-email" type="email" placeholder="you@email.com" required autocomplete="email" />
      <input class="usi-pass" type="password" placeholder="Password (min 6 characters)" required minlength="6" autocomplete="current-password" />
      <button class="usi-send" type="submit">Sign in / Create account</button>
      <div class="usi-msg" aria-live="polite"></div>
      <button class="usi-close" type="button" aria-label="Close">×</button>
    </form>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.querySelector(".usi-backdrop").addEventListener("click", close);
  wrap.querySelector(".usi-close").addEventListener("click", close);
  const email = wrap.querySelector(".usi-email");
  email.focus();
  wrap.querySelector(".usi-box").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = wrap.querySelector(".usi-msg");
    const btn = wrap.querySelector(".usi-send");
    const pass = wrap.querySelector(".usi-pass");
    btn.disabled = true; msg.textContent = "Signing in…";
    try {
      await ShAuth.signInWithPassword(email.value.trim(), pass.value);
      msg.textContent = "Signed in! Drop your file to upload.";
      setTimeout(close, 900);
      toast("Signed in — drag your file to upload");
    } catch (err) {
      msg.textContent = err?.message || "Sign-in failed, try again";
      btn.disabled = false;
    }
  });
}

// Global drag-and-drop upload (behind flag; flip to true after acceptance).
if (vstate.flags.globalUpload) {
  mountDropzone({ onNeedLogin: promptUploadSignIn });
}
// Merge DB-published live uploads into the catalog on load (best-effort).
mergeLiveUploads().then(() => { if (typeof render === "function") render(); });
window.setHomeFilter = setHomeFilter;
window.setHomeSort = setHomeSort;
window.openMovie = openMovie;
window.openCreator = openCreator;
window.setCommentSort = setCommentSort;
window.loadMore = loadMore;
window.loadMoreComments = function(){
  vstate.commentPage++;
  if(onWatch() && vstate.current) patchComments(vstate.current); else render();
};

/* Keyboard navigation for watch page (Arrows) — cycles public videos only */
document.addEventListener("keydown", (e) => {
  if(document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")){
    return;
  }
  if(vstate.page !== "watch") return;

  if(e.key === "ArrowRight" || e.key === "ArrowLeft"){
    e.preventDefault();
    const list = pubVideos();
    if(!list.length) return;
    const currentIdx = list.findIndex(v => v.id === vstate.current?.id);
    if(currentIdx === -1) return;
    const step = e.key === "ArrowRight" ? 1 : -1;
    const nextIdx = (currentIdx + step + list.length) % list.length;
    openVideo(list[nextIdx].id);
  }
});