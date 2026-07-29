/* Simple list-style pages: categories, subscriptions, profile, settings,
   live, playlists, search, and the generic grid listPage used by
   explore/trending/originals/favorites/later/history/downloads. */
import { DATA, esc, fmt } from "../../shared/catalog.js";
import { videoCard, emptyState } from "../../shared/ui.js";
import { POPULAR_TAGS } from "../../shared/taxonomy.js";
import { vstate, persistState } from "../state.js";
import { jsq } from "../util.js";
import { pubVideos, byCat } from "../catalog-queries.js";
import { pagedGrid } from "../grid-window.js";

// Horizontal category rows never need more than a screenful of cards.
const CAT_ROW_MAX = 24;

export function listPage(title, list, emptyMsg){
  return `<h2>${title}</h2><p class="sub">${list.length} item${list.length!==1?'s':''}</p>
    ${list.length?pagedGrid(list, v=>videoCard(v,{layout:'row'}), {cls:'video-list'}):`<div class="empty">${emptyMsg}</div>`}`;
}

export function renderCategories(){
  return `<h2>Categories</h2><p class="sub">Browse by topic</p>
    ${DATA.categories.map(c=>`<h3>${esc(c)}</h3><div class="row-scroll">${byCat(c).slice(0, CAT_ROW_MAX).map(v=>videoCard(v)).join("")||'<div class="small">No videos yet.</div>'}</div>`).join("")}`;
}

export function renderSubs(){
  const list = pubVideos().filter(v=>vstate.subs.includes(v.creator));
  return `<h2>Subscriptions</h2><p class="sub">Latest from creators you follow</p>
    <div class="pill-row">${DATA.creators.filter(c=>vstate.subs.includes(c.id)).map(c=>`<button class="filter-pill active" onclick="openCreator('${jsq(c.id)}')">${esc(c.name)}</button>`).join("")}</div>
    ${list.length?pagedGrid(list, v=>videoCard(v,{layout:'row'}), {cls:'video-list'}):`<div class="empty">Nothing from your subscriptions yet.</div>`}`;
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
      <label class="setting-row">
        <span>
          <span class="lbl" style="margin:0">Autoplay next video</span>
          <span class="small" style="display:block;color:var(--muted)">Automatically play the next suggested video when one ends.</span>
        </span>
        <input type="checkbox" class="switch" ${vstate.settings.autoplay ? 'checked' : ''} onchange="toggleAutoplaySetting(this.checked)"/>
      </label>
    </div>`;
}

export function renderLive(){
  return `<h2>Live</h2><p class="sub">Streams happening now</p>
    <div class="grid">${pubVideos().slice(0,3).map(v=>videoCard(v,{extra:()=>`<div class="card-actions"><span class="chip" style="color:var(--accent2);border-color:var(--accent2)">● LIVE</span><span class="chip">${fmt(v.views)} watching</span></div>`})).join("")}</div>`;
}

/* There's no real playlist data model yet (no create/name/add-to-playlist
   anywhere in the app) — these three are a placeholder grouping of whatever
   the first few public videos are. They render as real, clickable video
   cards (via videoCard(), same as every other grid) so tapping one actually
   opens and plays it instead of doing nothing. */
export function renderPlaylists(){
  const labels = ["My Mix","Chill","Tech Deep-Dives"];
  const videos = pubVideos().slice(0, labels.length);
  return `<h2>Playlists</h2><p class="sub">Your collections</p>
    ${videos.length ? `<div class="grid">
      ${videos.map((v,i)=>`
        <div>
          <div class="small" style="margin-bottom:6px;color:var(--muted)">${esc(labels[i])} · ${(i+2)} videos</div>
          ${videoCard(v)}
        </div>`).join("")}
    </div>` : `<div class="empty">No videos yet.</div>`}`;
}

/* Fuzzy multi-term search: every whitespace-separated term must match somewhere
   (title / category / categories / tags). Results are ranked — tag & category
   hits and title-start matches score highest — so the most relevant filth
   surfaces first. */
function scoreVideo(v, terms){
  const title = (v.title||"").toLowerCase();
  const cats = [(v.category||""), ...(v.categories||[])].map(x=>String(x).toLowerCase());
  const tags = (v.tags||[]).map(t=>String(t).toLowerCase());
  let score = 0;
  for(const term of terms){
    let hit = 0;
    if(tags.includes(term) || cats.includes(term)) hit = 10;          // exact tag/category
    else if(tags.some(t=>t.includes(term)) || cats.some(c=>c.includes(term))) hit = 6;
    else if(title.startsWith(term)) hit = 5;
    else if(title.includes(term)) hit = 3;
    if(!hit) return -1;   // every term must match somewhere (AND)
    score += hit;
  }
  score += (v.views||0) * 0.00001 + (v.likes||0) * 0.001;   // popularity tiebreaker
  return score;
}

export function renderSearch(){
  const raw = (vstate.searchQuery||"").trim();
  const terms = raw.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = pubVideos()
    .map(v=>({ v, s: scoreVideo(v, terms) }))
    .filter(x=>x.s >= 0)
    .sort((a,b)=>b.s - a.s);
  const vids = scored.map(x=>x.v);
  const crs  = DATA.creators.filter(c=>c.name.toLowerCase().includes(raw.toLowerCase()) || (c.handle||"").toLowerCase().includes(raw.toLowerCase()));

  // Related tags: most common tags among the results, minus the query itself, as
  // clickable refinements.
  const tagFreq = {};
  for(const v of vids.slice(0, 60)) for(const t of (v.tags||[])){
    if(t.toLowerCase()===raw.toLowerCase()) continue;
    tagFreq[t] = (tagFreq[t]||0)+1;
  }
  const related = Object.entries(tagFreq).sort((a,b)=>b[1]-a[1]).slice(0, 12).map(x=>x[0]);

  return `
    <h2>Search: "${esc(raw)}"</h2>
    <p class="sub">${vids.length} video${vids.length!==1?'s':''}</p>
    ${related.length?`<div class="pill-row related-tags">${related.map(t=>`<span class="filter-pill" onclick="searchTag('${jsq(t)}')">#${esc(t)}</span>`).join("")}</div>`:''}
    ${crs.length?`<h3>Creators</h3><div class="pill-row">${crs.map(c=>`<span class="filter-pill" onclick="openCreator('${jsq(c.id)}')">${esc(c.name)} ${c.verified?'✔️':''}</span>`).join("")}</div>`:''}
    <h3>Videos</h3>${vids.length?pagedGrid(vids, v=>videoCard(v,{layout:'row'}), {cls:'video-list'}):emptyState(`No videos found for “${raw}”.`, POPULAR_TAGS.slice(0,8))}`;
}
