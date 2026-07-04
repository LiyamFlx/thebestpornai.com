import { MEDIA_BASE, DATA, esc, creatorName, fmt, toast, mediaUrl } from "../shared/catalog.js";
import { ShAuth, ShAPI } from "../shared/streamhub-api.js";
import { ageGate } from "../shared/age-gate.js";
ageGate();

/* creatorName(), fmt(), toast() are shared — defined in catalog.js */
function ytId(url){ if(!url) return null; const m=url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/); return m?m[1]:null; }

function playerEmbed(v){
  const yt = ytId(v.src);
  if(yt) return `<iframe class="player" src="https://www.youtube.com/embed/${yt}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  if(v.src) return `<video class="player" src="${mediaUrl(v.src)}" controls></video>`;
  return `<div class="player">VIDEO STREAM — ${esc(v.title)}</div>`;
}

function videoCard(v, opts={}){
  const thumb = v.thumb
    ? `<img class="thumb-video" src="${v.thumb}" alt=""/>`
    : (v.src && !ytId(v.src)
        ? `<video class="thumb-video lazy" data-src="${mediaUrl(v.src)}#t=1" muted preload="none" playsinline></video>` : ``);
  return `
    <div class="card" onclick="${opts.onClick || `openVideo(${v.id})`}">
      <div class="video-thumb ${v.type==='original'?'original':''}">
        ${thumb}
        ${v.duration?`<span class="dur-badge">${esc(v.duration)}</span>`:``}
        ${v.src?`<span class="play-badge">▶</span>`:``}
      </div>
      <div class="title">${esc(v.title)}</div>
      <div class="meta">${esc(creatorName(v.creator))} • ${fmt(v.views)} views</div>
      ${opts.extra ? opts.extra(v) : ``}
    </div>`;
}

/* toast() is shared — defined in catalog.js */

/* ===================== VIEWER APP ===================== */
let vstate = {
  page:"home", current:null,
  favorites:[], later:[], history:[], downloads:[],
  subs:["c1","c2"],
};

function go(p){ vstate.page=p; setHash(p==="home"?"":p); render(); }
function focusSearch(){
  const i=document.getElementById("searchInput");
  if(i){ i.scrollIntoView({block:"start",behavior:"smooth"}); i.focus(); }
}
function openVideo(id){
  vstate.current = DATA.videos.find(v=>v.id===id);
  if(!vstate.current) return;
  if(!vstate.history.includes(id)) vstate.history.unshift(id);
  vstate.page="watch"; setHash("video/"+id); render();
  hydrateWatch(id);   // fetch real counts/comments and patch them in (non-blocking)
}

/* Pull persisted likes/comments from Supabase and patch the already-rendered
   watch page. Best-effort: any failure leaves the seeded values in place.
   Also records the view here so it fires on BOTH the click path (openVideo) and
   the direct-link/refresh path (applyHash -> render -> pending hydrate). */
async function hydrateWatch(id){
  if(typeof ShAPI==="undefined" || !ShAPI.enabled) return;
  _persist(()=> ShAPI.addView(id));   // record a real view (fire-and-forget)
  try {
    const [counts, comments, views, favCount] = await Promise.all([
      ShAPI.likeCounts(id), ShAPI.listComments(id), ShAPI.viewCount(id), ShAPI.favoriteCount(id)
    ]);
    if(vstate.current && vstate.current.id===id && onWatch()){
      const v = vstate.current;
      // Show seeded baseline + real persisted events, so counts are realistic AND grow.
      const likeNum=document.getElementById("likeNum"), disNum=document.getElementById("disNum");
      if(likeNum) likeNum.textContent = fmt(v.likes + (counts.like||0));
      if(disNum)  disNum.textContent  = fmt(v.dislikes + (counts.dislike||0));
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
        if(vstate.current && vstate.current.id===id && onWatch()) render();
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
    if(vid){ vstate.current=vid; if(!vstate.history.includes(vid.id)) vstate.history.unshift(vid.id); vstate.page="watch"; _pendingHydrate=vid.id; return; }
  }
  vstate.page = h || "home";
}
window.addEventListener("hashchange",()=>{ if(_suppressHash) return; applyHash(); render(); });
/* These actions update one on-screen control. When we're on the watch page we
   patch just that button — a full render() would rebuild #view (player + layout)
   and reset the scroll position, causing a visible "jump". We only fall back to
   render() when the relevant button isn't on screen (e.g. favoriting from a grid
   card), so list pages that depend on the state still refresh. */
function onWatch(){ return vstate.page==="watch"; }

/* Fire-and-forget persistence: never let an API failure break the UI. The
   optimistic in-memory update has already been applied by the caller, so if
   Supabase is down we simply keep that (today's fallback behavior). */
function _persist(promiseFn){
  try { if(typeof ShAPI!=="undefined" && ShAPI.enabled) Promise.resolve(promiseFn()).catch(()=>{}); } catch(_){}
}

function toggleFav(id){
  const on = vstate.favorites.includes(id);
  on ? vstate.favorites=vstate.favorites.filter(x=>x!==id) : vstate.favorites.push(id);
  toast(!on?"Added to Favorites":"Removed from Favorites");
  _persist(()=> on ? ShAPI.removeFavorite(id) : ShAPI.addFavorite(id));
  const btn=document.getElementById("btnFav");
  if(onWatch() && btn) btn.classList.toggle("on", !on); else render();
}
function toggleLater(id){
  const on = vstate.later.includes(id);
  on ? vstate.later=vstate.later.filter(x=>x!==id) : vstate.later.push(id);
  toast(!on?"Saved to Watch Later":"Removed");
  const btn=document.getElementById("btnLater");
  if(onWatch() && btn) btn.classList.toggle("on", !on); else render();
}
function download(id){ if(!vstate.downloads.includes(id))vstate.downloads.push(id); toast("Download started (simulated)"); }
let _voting = new Set();

function likeVideo(id){
  const key=id+":like";
  if (_voting.has(key)) return;
  _voting.add(key);
  const v=DATA.videos.find(x=>x.id===id); if(!v){ _voting.delete(key); return; }
  v.likes++; toast("Liked");
  Promise.resolve(_persist(()=> ShAPI.addLike(id,"like"))).finally(()=> _voting.delete(key));
  const num=document.getElementById("likeNum");
  if(onWatch() && num) num.textContent=fmt(v.likes); else render();
}
function dislikeVideo(id){
  const key=id+":dislike";
  if (_voting.has(key)) return;
  _voting.add(key);
  const v=DATA.videos.find(x=>x.id===id); if(!v){ _voting.delete(key); return; }
  v.dislikes++; toast("Disliked");
  Promise.resolve(_persist(()=> ShAPI.addLike(id,"dislike"))).finally(()=> _voting.delete(key));
  const num=document.getElementById("disNum");
  if(onWatch() && num) num.textContent=fmt(v.dislikes); else render();
}
function subscribe(cid){ vstate.subs.includes(cid)?vstate.subs=vstate.subs.filter(x=>x!==cid):vstate.subs.push(cid); render(); }
const COMMENT_MAX_LEN = 2000;

function addComment(id){
  const box=document.getElementById("cbox"); const t=(box.value||"").trim(); if(!t)return;
  if (t.length > COMMENT_MAX_LEN) {
    toast(`Comment too long (max ${COMMENT_MAX_LEN} characters)`);
    return;
  }
  DATA.comments.push({id:"m"+Date.now(),video:id,user:DATA.user.name,text:t,time:"now",ts:Date.now()});
  box.value = "";
  _persist(()=> ShAPI.addComment(id, DATA.user.name, t));
  render();
}

const trending = ()=> [...DATA.videos].sort((a,b)=> (b.likes*1.2+b.views*0.01) - (a.likes*1.2+a.views*0.01));
const byCat = (c)=> DATA.videos.filter(v=>v.category===c);

function rowSection(title, list){
  if(!list.length) return "";
  return `<h3>${title}</h3><div class="row-scroll">${list.map(v=>videoCard(v)).join("")}</div>`;
}

const HERO_VIDEO_ID = 470; // pinned homepage hero — update this id to change it
function renderHome(){
  const hero = DATA.videos.find(v=>v.id===HERO_VIDEO_ID) || DATA.videos.find(v=>v.type==="original") || DATA.videos[0];
  if(!hero) return `<div class="empty">No videos available yet.</div>`;
  const top = trending();   // compute once; reused by the two rows below
  return `
    <div class="hero">
      <video src="${mediaUrl(hero.src)}" muted autoplay loop playsinline></video>
      <div class="hero-body">
        <span class="tag">HOUSE ORIGINAL</span>
        <h1>${esc(hero.title)}</h1>
        <p class="sub">${esc(creatorName(hero.creator))} • ${fmt(hero.views)} views</p>
        <button class="btn" onclick="openVideo(${hero.id})">▶ Play</button>
        <button class="btn ghost" onclick="toggleLater(${hero.id})">+ Watch Later</button>
      </div>
    </div>
    ${vstate.history.length ? rowSection("Continue Watching", vstate.history.map(id=>DATA.videos.find(v=>v.id===id)).filter(Boolean)) : ""}
    ${rowSection("Recommended For You", top.slice(0,6))}
    ${rowSection("Trending Now", top.slice(0,6))}
    ${rowSection("House Originals", DATA.videos.filter(v=>v.type==="original"))}
    ${DATA.categories.map(c=>rowSection(c, byCat(c))).join("")}
    ${rowSection("Recently Uploaded", [...DATA.videos].sort((a,b)=>b.uploaded.localeCompare(a.uploaded)).slice(0,6))}
  `;
}

function renderWatch(){
  const v = vstate.current || DATA.videos[0];
  if(!v) return `<div class="empty">No video selected.</div>`;
  const c = DATA.creators.find(x=>x.id===v.creator) || { name:"Unknown", id:"", verified:false, subs:0 };
  const subbed = vstate.subs.includes(v.creator);
  const cms = DATA.comments.filter(m=>m.video===v.id);
  const related = trending().filter(u=>u.id!==v.id).slice(0,6);
  const suggestedCard = u=>`
    <div class="card" style="display:flex;gap:10px;margin-bottom:10px;padding:8px" onclick="openVideo(${u.id})">
      <div class="video-thumb ${u.type==='original'?'original':''}" style="width:120px;height:68px;margin:0;flex:none">
        <video class="thumb-video lazy" data-src="${mediaUrl(u.src)}#t=1" muted preload="none"></video>
      </div>
      <div><div class="title">${esc(u.title)}</div><div class="meta">${esc(creatorName(u.creator))}</div><div class="small">${fmt(u.views)} views</div></div>
    </div>`;
  return `
    <div class="watch">
      <div>
        ${playerEmbed(v)}
        <h2 class="watch-title">${esc(v.title)}</h2>
        <p class="sub watch-sub" id="watchSub"><span class="ic-eye">👁</span> ${fmt(v.views)} views <span class="dot-sep">•</span> ${esc(v.uploaded)}</p>

        <div class="watch-actions">
          <div class="vote-pill">
            <button id="btnLike" class="vote-btn" onclick="likeVideo(${v.id})"><span class="ic">👍</span> <span id="likeNum">${fmt(v.likes)}</span></button>
            <span class="vote-div"></span>
            <button id="btnDislike" class="vote-btn" onclick="dislikeVideo(${v.id})"><span class="ic">👎</span> <span id="disNum">${v.dislikes}</span></button>
          </div>
          <button id="btnFav" class="act-btn ${vstate.favorites.includes(v.id)?'on':''}" onclick="toggleFav(${v.id})"><span class="ic">♥</span> Favorite</button>
          <button id="btnLater" class="act-btn ${vstate.later.includes(v.id)?'on':''}" onclick="toggleLater(${v.id})"><span class="ic">🔖</span> Save</button>
          <button class="act-btn" onclick="shareVideo(${v.id})"><span class="ic">↗</span> Share</button>
          <button class="act-btn act-more" onclick="toast('Report submitted (simulated)')" title="More" aria-label="More">···</button>
        </div>

        <div class="creator-card">
          <div class="avatar avatar-lg">${esc((c.name||"?")[0])}</div>
          <div style="flex:1;min-width:0">
            <div class="creator-name">${esc(c.name)} ${c.verified?'<span class="verified" title="Verified">✓</span>':''}</div>
            <div class="small">${fmt(c.subs)} subscribers</div>
          </div>
          <button class="btn subscribe-btn ${subbed?'ghost':''}" onclick="subscribe('${esc(c.id)}')">${subbed?'Subscribed':'＋ Subscribe'}</button>
        </div>

        <div class="comments-card">
          <div class="comments-top">
            <div class="comments-title">Comments <span class="count-bubble">${cms.length}</span></div>
            <select class="sort-select" id="cSort" onchange="render()">
              <option value="new">Newest first</option>
              <option value="old">Oldest first</option>
            </select>
          </div>
          <div class="comment-form">
            <div class="avatar avatar-sm">${esc((DATA.user.name||'?')[0])}</div>
            <input class="fld" id="cbox" placeholder="Add a comment…" onkeydown="if(event.key==='Enter')addComment(${v.id})"/>
            <button class="btn" onclick="addComment(${v.id})">Comment</button>
          </div>
          <div class="comment-list">
            ${cms.length
              ? sortComments(cms).map(m=>`<div class="comment"><div class="avatar avatar-sm">${esc((m.user||'?')[0])}</div><div style="flex:1;min-width:0"><div><b>${esc(m.user)}</b> <span class="small">${esc(m.time)}</span></div><div class="comment-text">${esc(m.text)}</div></div></div>`).join("")
              : `<div class="comments-empty"><div class="ce-icon">💬</div><div class="ce-title">No comments yet.</div><div class="small">Be the first to share your thoughts!</div></div>`}
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
    </div>`;
}

/* Sort comments by real timestamp. DB comments carry `ts` parsed from
   created_at; locally-added comments stamp `ts` with Date.now() at creation.
   Legacy seeded comments have no ts at all — they sort as oldest (0). */
function sortComments(cms){
  const order = (document.getElementById("cSort")||{}).value || "new";
  const key = m => m.ts || 0;
  const sorted = [...cms].sort((a,b)=> key(b)-key(a));   // newest first
  return order==="old" ? sorted.reverse() : sorted;
}
function shareVideo(id){
  const url = location.href.split("#")[0] + "#video/" + id;
  if(navigator.clipboard) navigator.clipboard.writeText(url).then(()=>toast("Link copied"),()=>toast("Link: "+url));
  else toast("Link: "+url);
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
  const list = DATA.videos.filter(v=>vstate.subs.includes(v.creator));
  return `<h2>Subscriptions</h2><p class="sub">Latest from creators you follow</p>
    <div class="pill-row">${DATA.creators.filter(c=>vstate.subs.includes(c.id)).map(c=>`<span class="filter-pill active">${esc(c.name)}</span>`).join("")}</div>
    <div class="grid">${list.map(v=>videoCard(v)).join("")}</div>`;
}
function renderProfile(){
  return `<h2>Your Profile</h2>
    <div class="panel" style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
      <div class="avatar" style="width:60px;height:60px;font-size:24px">A</div>
      <div><h3 style="margin:0">${esc(DATA.user.name)}</h3><div class="small">${esc(DATA.user.handle)} • ${vstate.subs.length} subscriptions</div></div>
    </div>
    <div class="metrics">
      <div class="metric"><div class="label">Favorites</div><div class="value">${vstate.favorites.length}</div></div>
      <div class="metric"><div class="label">Watch Later</div><div class="value">${vstate.later.length}</div></div>
      <div class="metric"><div class="label">History</div><div class="value">${vstate.history.length}</div></div>
      <div class="metric"><div class="label">Downloads</div><div class="value">${vstate.downloads.length}</div></div>
    </div>
    <h3>Achievements</h3>
    <div class="pill-row"><span class="filter-pill">🏆 Early Adopter</span><span class="filter-pill">🔥 7-Day Streak</span><span class="filter-pill">⭐ Super Fan</span></div>`;
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
    <div class="grid">${DATA.videos.slice(0,3).map(v=>videoCard(v,{extra:()=>`<div class="card-actions"><span class="chip" style="color:var(--accent2);border-color:var(--accent2)">● LIVE</span><span class="chip">${fmt(v.views)} watching</span></div>`})).join("")}</div>`;
}
function renderPlaylists(){
  return `<h2>Playlists</h2><p class="sub">Your collections</p>
    <div class="grid">
      ${["My Mix","Chill","Tech Deep-Dives"].map((p,i)=>{
        const pv = DATA.videos[i];
        const thumb = pv ? `<video class="thumb-video lazy" data-src="${mediaUrl(pv.src)}#t=1" muted preload="none"></video>` : ``;
        return `<div class="card"><div class="video-thumb">${thumb}</div>
        <div class="title">${esc(p)}</div><div class="meta">${(i+2)} videos</div></div>`;
      }).join("")}
    </div>`;
}

function doSearch(){
  const q=(document.getElementById("searchInput").value||"").toLowerCase();
  if(!q){ render(); return; }
  const vids = DATA.videos.filter(v=>v.title.toLowerCase().includes(q));
  const crs  = DATA.creators.filter(c=>c.name.toLowerCase().includes(q));
  document.getElementById("view").innerHTML = `
    <h2>Search: "${esc(q)}"</h2>
    <div class="pill-row"><span class="filter-pill active">All</span><span class="filter-pill">Videos</span><span class="filter-pill">Creators</span><span class="filter-pill">Playlists</span></div>
    <h3>Creators</h3>${crs.length?`<div class="pill-row">${crs.map(c=>`<span class="filter-pill">${esc(c.name)} ${c.verified?'✔️':''}</span>`).join("")}</div>`:'<div class="small">None</div>'}
    <h3>Videos</h3>${vids.length?`<div class="grid">${vids.map(v=>videoCard(v)).join("")}</div>`:'<div class="empty">No videos found.</div>'}`;
  lazyLoadThumbs();
}

function render(){
  const v=document.getElementById("view"); const p=vstate.page;
  const map={
    home:renderHome, watch:renderWatch, categories:renderCategories, subscriptions:renderSubs,
    profile:renderProfile, settings:renderSettings, live:renderLive, playlists:renderPlaylists,
  };
  if(map[p]) v.innerHTML = map[p]();
  else if(p==="explore")   v.innerHTML = listPage("Explore", trending(), "");
  else if(p==="trending")  v.innerHTML = listPage("Trending", trending(), "");
  else if(p==="originals") v.innerHTML = listPage("House Originals", DATA.videos.filter(x=>x.type==="original"), "");
  else if(p==="favorites") v.innerHTML = listPage("Favorites", DATA.videos.filter(x=>vstate.favorites.includes(x.id)), "Tap ★ on any video to save it here.");
  else if(p==="later")     v.innerHTML = listPage("Watch Later", DATA.videos.filter(x=>vstate.later.includes(x.id)), "Nothing saved yet.");
  else if(p==="history")   v.innerHTML = listPage("History", vstate.history.map(id=>DATA.videos.find(x=>x.id===id)).filter(Boolean), "No watch history yet.");
  else if(p==="downloads") v.innerHTML = listPage("Downloads", DATA.videos.filter(x=>vstate.downloads.includes(x.id)), "No downloads yet.");
  else v.innerHTML = renderHome();
  document.querySelectorAll("#nav button, #bottomNav button").forEach(b=>b.classList.toggle("active", b.dataset.page===p));
  lazyLoadThumbs();
  if(_pendingHydrate!=null){ const hid=_pendingHydrate; _pendingHydrate=null; hydrateWatch(hid); }
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

/* Restore this browser's persisted favorites (per-visitor via client_id), then
   re-render so the favorites page / heart states reflect them. Best-effort. */
(async ()=>{
  if(typeof ShAPI==="undefined" || !ShAPI.enabled) return;
  try {
    const favs = await ShAPI.myFavorites();
    if(favs && favs.length){
      for(const id of favs) if(!vstate.favorites.includes(id)) vstate.favorites.push(id);
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
