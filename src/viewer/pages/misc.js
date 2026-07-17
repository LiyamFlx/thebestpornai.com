/* Simple list-style pages: categories, subscriptions, profile, settings,
   live, playlists, search, and the generic grid listPage used by
   explore/trending/originals/favorites/later/history/downloads. */
import { DATA, esc, fmt, mediaUrl, ytId } from "../../shared/catalog.js";
import { videoCard } from "../../shared/ui.js";
import { vstate } from "../state.js";
import { jsq } from "../util.js";
import { pubVideos, byCat } from "../catalog-queries.js";

export function listPage(title, list, emptyMsg){
  return `<h2>${title}</h2><p class="sub">${list.length} item${list.length!==1?'s':''}</p>
    ${list.length?`<div class="grid">${list.map(v=>videoCard(v)).join("")}</div>`:`<div class="empty">${emptyMsg}</div>`}`;
}

export function renderCategories(){
  return `<h2>Categories</h2><p class="sub">Browse by topic</p>
    ${DATA.categories.map(c=>`<h3>${esc(c)}</h3><div class="row-scroll">${byCat(c).map(v=>videoCard(v)).join("")||'<div class="small">No videos yet.</div>'}</div>`).join("")}`;
}

export function renderSubs(){
  const list = pubVideos().filter(v=>vstate.subs.includes(v.creator));
  return `<h2>Subscriptions</h2><p class="sub">Latest from creators you follow</p>
    <div class="pill-row">${DATA.creators.filter(c=>vstate.subs.includes(c.id)).map(c=>`<span class="filter-pill active">${esc(c.name)}</span>`).join("")}</div>
    <div class="grid">${list.map(v=>videoCard(v)).join("")}</div>`;
}

export function renderProfile(){
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

export function renderSettings(){
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

export function renderLive(){
  return `<h2>Live</h2><p class="sub">Streams happening now</p>
    <div class="grid">${pubVideos().slice(0,3).map(v=>videoCard(v,{extra:()=>`<div class="card-actions"><span class="chip" style="color:var(--accent2);border-color:var(--accent2)">● LIVE</span><span class="chip">${fmt(v.views)} watching</span></div>`})).join("")}</div>`;
}

export function renderPlaylists(){
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

export function renderSearch(){
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
