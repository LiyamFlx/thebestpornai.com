/* Simple list-style pages: categories, subscriptions, profile, settings,
   library hub, live/playlists (demoted), search, and generic listPage. */
import { DATA, esc, fmt, mediaUrl } from "../../shared/catalog.js";
import { videoCard, emptyState, rowSection } from "../../shared/ui.js";
import { POPULAR_TAGS, CATEGORIES } from "../../shared/taxonomy.js";
import { ShAuth } from "../../shared/streamhub-api.js";
import { vstate } from "../state.js";
import { jsq } from "../util.js";
import { pubVideos, byCat, videoById, trending, pornstars, searchCatalog, sortedVideos } from "../catalog-queries.js";
import { pagedGrid } from "../grid-window.js";
import { renderSortControl } from "./home.js";

// Horizontal category rows never need more than a screenful of cards.
const CAT_ROW_MAX = 24;
const SEARCH_HUB_TRENDING = 12;
const SEARCH_HUB_CATS = 10;

export function listPage(title, list, emptyMsg){
  return `<h2>${title}</h2><p class="sub">${list.length} item${list.length!==1?'s':''}</p>
    ${list.length
      ? pagedGrid(list, v=>videoCard(v,{layout:'row'}), {cls:'video-list'})
      : emptyState(emptyMsg || "Nothing here yet.", POPULAR_TAGS.slice(0, 8), { emoji: "📭" })}`;
}

/* ---- Library hub: Later / Favorites / History / Downloads in one place ---- */
const LIBRARY_TABS = [
  { id: "later", label: "Watch Later", empty: "Nothing saved yet. Tap Save on any video." },
  { id: "favorites", label: "Favorites", empty: "Tap ♥ on any video to save it here." },
  { id: "history", label: "History", empty: "Videos you watch show up here." },
  { id: "downloads", label: "Downloads", empty: "No downloads yet." },
];

function libraryList(tab){
  if(tab === "later") return vstate.later.map(id => videoById(id)).filter(Boolean);
  if(tab === "favorites") return vstate.favorites.map(id => videoById(id) || DATA.videos.find(x=>x.id===id)).filter(Boolean);
  if(tab === "history") return vstate.history.map(id => videoById(id) || DATA.videos.find(x=>x.id===id)).filter(Boolean);
  if(tab === "downloads") return vstate.downloads.map(id => videoById(id) || DATA.videos.find(x=>x.id===id)).filter(Boolean);
  return [];
}

export function renderLibrary(){
  const tab = LIBRARY_TABS.some(t => t.id === vstate.libraryTab) ? vstate.libraryTab : "later";
  const meta = LIBRARY_TABS.find(t => t.id === tab) || LIBRARY_TABS[0];
  const list = libraryList(tab);
  return `
    <div class="library-page">
      <h2>Library</h2>
      <p class="sub">Your saved and watched videos</p>
      <div class="library-tabs mchrome-scroll" role="tablist" aria-label="Library sections">
        ${LIBRARY_TABS.map(t => {
          const n = libraryList(t.id).length;
          const active = t.id === tab;
          return `<button type="button" role="tab" class="library-tab ${active?'active':''}"
            aria-selected="${active?'true':'false'}"
            onclick="setLibraryTab('${t.id}')">${esc(t.label)}${n?` <span class="library-tab-count">${n}</span>`:''}</button>`;
        }).join("")}
      </div>
      <div class="library-panel" role="tabpanel">
        <p class="sub library-count">${list.length} item${list.length!==1?'s':''}</p>
        ${list.length
          ? pagedGrid(list, v => videoCard(v, { layout: "row" }), { cls: "video-list" })
          : `
            <div class="library-empty-box">
              <div class="empty-emoji">🎬</div>
              <div class="empty-msg">${esc(meta.empty)}</div>
              <div class="library-empty-actions">
                <button type="button" class="btn" onclick="go('home')">🔥 Browse Trending</button>
                <button type="button" class="btn ghost" onclick="go('categories')">Browse Categories</button>
              </div>
              <div class="library-empty-recs">
                <h3 class="row-heading">Recommended For You</h3>
                <div class="row-scroll">
                  ${trending().slice(0, 8).map(v => videoCard(v)).join("")}
                </div>
              </div>
            </div>
          `}
      </div>
    </div>`;
}

export function renderCategories(){
  return `<h2>Categories</h2><p class="sub">Browse by topic</p>
    ${DATA.categories.map(c=>`<h3>${esc(c)}</h3><div class="row-scroll">${byCat(c).slice(0, CAT_ROW_MAX).map(v=>videoCard(v)).join("")||'<div class="small">No videos yet.</div>'}</div>`).join("")}`;
}

/** Hub of pornstar face packs (#pornstars). */
export function renderPornstars(){
  const stars = pornstars().slice().sort((a, b) => (b.subs || 0) - (a.subs || 0));
  if(!stars.length){
    return emptyState("No pornstars yet. Check back soon.", POPULAR_TAGS.slice(0, 6), { emoji: "⭐" });
  }
  return `
    <div class="pornstars-page">
      <h2>Pornstars</h2>
      <p class="sub">${stars.length} star${stars.length !== 1 ? "s" : ""} · intro + Shorts packs</p>
      <div class="pornstars-grid">
        ${stars.map(c => {
          const vids = DATA.videos.filter(v => v.creator === c.id && (v.status !== "private" && v.status !== "pending"));
          const shortsN = vids.filter(v => v.orientation === "vertical").length;
          const av = c.avatar
            ? `<img src="${esc(mediaUrl(c.avatar))}" alt="" loading="lazy" decoding="async"/>`
            : `<span>${esc((c.name || "?")[0])}</span>`;
          const tags = (c.tags || []).slice(0, 4).map(t => `<span class="tag-chip">#${esc(t)}</span>`).join("");
          return `
          <button type="button" class="pornstar-card" onclick="openCreator('${jsq(c.id)}')">
            <div class="pornstar-card-avatar${c.avatar ? " has-img" : ""}">${av}</div>
            <div class="pornstar-card-body">
              <div class="pornstar-card-name">${esc(c.name)} ${c.verified ? '<span class="verified">✓</span>' : ""}</div>
              <div class="small">${vids.length} video${vids.length !== 1 ? "s" : ""}${shortsN ? ` · ${shortsN} Shorts` : ""}</div>
              ${tags ? `<div class="tag-chips" style="margin-top:8px">${tags}</div>` : ""}
            </div>
          </button>`;
        }).join("")}
      </div>
    </div>`;
}

export function renderSubs(){
  const list = pubVideos().filter(v=>vstate.subs.includes(v.creator));
  return `<h2>Subscriptions</h2><p class="sub">Latest from creators you follow</p>
    <div class="pill-row">${DATA.creators.filter(c=>vstate.subs.includes(c.id)).map(c=>`<button class="filter-pill active" onclick="openCreator('${jsq(c.id)}')">${esc(c.name)}</button>`).join("")}</div>
    ${list.length
      ? pagedGrid(list, v=>videoCard(v,{layout:'row'}), {cls:'video-list'})
      : emptyState("Nothing from your subscriptions yet. Follow creators to fill this feed.", POPULAR_TAGS.slice(0, 6), { emoji: "📺" })}`;
}

export function renderProfile(){
  const isSignedIn = typeof ShAuth !== "undefined" && ShAuth.isSignedIn();
  const session = isSignedIn ? ShAuth.session() : null;
  const userEmail = session?.user?.email || DATA.user.name || "Guest";
  const initials = (userEmail||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const subCreators = DATA.creators.filter(c=>vstate.subs.includes(c.id));
  return `<h2>You</h2>
    <div class="profile-hero panel">
      <div class="profile-avatar">${initials}</div>
      <div class="profile-info">
        <h3 style="margin:0 0 2px">${esc(userEmail)}</h3>
        <div class="small">${isSignedIn ? "Verified Session" : esc(DATA.user.handle||"@viewer")}</div>
        <div class="profile-stats">
          <span>${vstate.subs.length} <b>subscriptions</b></span>
          <span>${vstate.favorites.length} <b>favorites</b></span>
          <span>${vstate.history.length} <b>watched</b></span>
        </div>
      </div>
    </div>
    <div class="account-session-card panel" style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px">
      <div>
        <div style="font-weight:700;font-size:14px">Account Session</div>
        <div class="small" style="color:var(--muted)">${isSignedIn ? `Signed in as ${esc(userEmail)}` : 'Browsing as Guest'}</div>
      </div>
      <button type="button" class="btn ghost sm" onclick="signOutUser()" style="border-color:var(--accent);color:var(--accent);font-weight:700;border-radius:999px;padding:6px 16px">
        Sign Out
      </button>
    </div>
    <div class="metrics" style="margin-top:14px">
      <div class="metric"><div class="label">Library</div><div class="value">${vstate.later.length + vstate.favorites.length}</div><div onclick="go('library')" class="metric-link">Open library →</div></div>
      <div class="metric"><div class="label">Watch Later</div><div class="value">${vstate.later.length}</div><div onclick="setLibraryTab('later')" class="metric-link">View →</div></div>
      <div class="metric"><div class="label">Favorites</div><div class="value">${vstate.favorites.length}</div><div onclick="setLibraryTab('favorites')" class="metric-link">View →</div></div>
      <div class="metric"><div class="label">History</div><div class="value">${vstate.history.length}</div><div onclick="setLibraryTab('history')" class="metric-link">View →</div></div>
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
  const isSignedIn = typeof ShAuth !== "undefined" && ShAuth.isSignedIn();
  return `<h2>Settings</h2>
    <div class="panel" style="max-width:520px">
      <label class="setting-row">
        <span>
          <span class="lbl" style="margin:0">Autoplay next video</span>
          <span class="small" style="display:block;color:var(--muted)">Automatically play the next suggested video when one ends.</span>
        </span>
        <input type="checkbox" class="switch" ${vstate.settings.autoplay ? 'checked' : ''} onchange="toggleAutoplaySetting(this.checked)"/>
      </label>
      <label class="setting-row" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
        <span>
          <span class="lbl" style="margin:0">Hover Trailer Preview</span>
          <span class="small" style="display:block;color:var(--muted)">Autoplay video trailer preview when hovering over video thumbnails.</span>
        </span>
        <input type="checkbox" class="switch" ${vstate.settings.hoverPreview !== false ? 'checked' : ''} onchange="toggleHoverPreviewSetting(this.checked)"/>
      </label>
      <div class="setting-row" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <span>
          <span class="lbl" style="margin:0">Account Session</span>
          <span class="small" style="display:block;color:var(--muted)">${isSignedIn ? 'Clear your authenticated session on this device.' : 'Clear local guest session.'}</span>
        </span>
        <button type="button" class="btn ghost sm" onclick="signOutUser()" style="border-color:var(--accent);color:var(--accent);font-weight:700">
          Sign Out
        </button>
      </div>
    </div>`;
}

/* Demoted stub surfaces — reachable by deep hash only, not primary nav.
   Honest empty/coming-soon so we never imply a finished product. */
export function renderLive(){
  return `<h2>Live</h2>
    <div class="empty">
      <div class="empty-emoji">🔴</div>
      <div class="empty-msg">Live streams are coming soon.</div>
      <button type="button" class="btn" onclick="go('home')">Browse videos</button>
    </div>`;
}

export function renderPlaylists(){
  return `<h2>Playlists</h2>
    <div class="empty">
      <div class="empty-emoji">≣</div>
      <div class="empty-msg">Custom playlists aren't available yet. Use Library for Watch Later, Favorites, and History.</div>
      <button type="button" class="btn" onclick="go('library')">Open Library</button>
    </div>`;
}

function searchCreatorCard(c){
  const initials = esc((c.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase());
  return `
    <button type="button" class="search-creator-card" onclick="openCreator('${jsq(c.id)}')">
      <div class="search-creator-avatar">${initials}</div>
      <div class="search-creator-meta">
        <div class="search-creator-name">${esc(c.name)} ${c.verified?'<span class="verified">✓</span>':''}</div>
        <div class="small">${fmt(c.subs)} subscribers</div>
      </div>
    </button>`;
}

/* Landing when Search is open with no query — tags, categories, trending. */
function renderSearchHub(){
  const top = trending().slice(0, SEARCH_HUB_TRENDING);
  const cats = (DATA.categories && DATA.categories.length ? DATA.categories : CATEGORIES).slice(0, SEARCH_HUB_CATS);
  return `
    <div class="search-page search-hub">
      <h2>Search</h2>
      <p class="sub">Find videos, tags, and creators</p>
      <div class="search-hub-prompt panel">
        <div class="search-hub-prompt-ico" aria-hidden="true">🔍</div>
        <div>
          <div class="search-hub-prompt-title">Type in the search bar above</div>
          <div class="small">Or jump in with a popular tag or category below.</div>
        </div>
        <button type="button" class="btn sm" onclick="focusSearch()">Focus search</button>
      </div>
      <h3 class="row-heading">Popular tags</h3>
      <div class="pill-row related-tags">
        ${POPULAR_TAGS.slice(0, 16).map(t=>`<button type="button" class="filter-pill" onclick="searchTag('${jsq(t)}')">#${esc(t)}</button>`).join("")}
      </div>
      <h3 class="row-heading">Browse categories</h3>
      <div class="pill-row">
        ${cats.map(c=>`<button type="button" class="filter-pill" onclick="setHomeCategory('${jsq(c)}')">${esc(c)}</button>`).join("")}
      </div>
      ${top.length ? rowSection("Trending now", top, { layout: "row" }) : ""}
    </div>`;
}

export function renderSearch(){
  const raw = (vstate.searchQuery||"").trim();
  if(!raw) return renderSearchHub();

  let vids = searchCatalog(raw);
  const qLower = raw.toLowerCase();
  const crs = DATA.creators.filter(c =>
    (c.name||"").toLowerCase().includes(qLower) ||
    (c.handle||"").toLowerCase().includes(qLower)
  ).slice(0, 12);

  // Related tags: most common among results (minus the query), as refinements.
  const tagFreq = {};
  for(const v of vids.slice(0, 60)) for(const t of (v.tags||[])){
    if(t.toLowerCase() === qLower) continue;
    tagFreq[t] = (tagFreq[t]||0) + 1;
  }
  const related = Object.entries(tagFreq).sort((a,b)=>b[1]-a[1]).slice(0, 12).map(x=>x[0]);
  const fallback = !vids.length ? trending().slice(0, SEARCH_HUB_TRENDING) : [];

  if(vstate.searchSort && vstate.searchSort !== "none"){
    vids = sortedVideos(vstate.searchSort, vids);
  }

  return `
    <div class="search-page">
      <div class="search-results-head">
        <div>
          <h2>Results for “${esc(raw)}”</h2>
          <p class="sub">${vids.length} video${vids.length!==1?'s':''}${crs.length ? ` · ${crs.length} creator${crs.length!==1?'s':''}` : ''}</p>
        </div>
        <div class="search-head-actions">
          ${vids.length ? renderSortControl(vstate.searchSort, "setSearchSort") : ""}
          <button type="button" class="btn ghost sm" onclick="clearSearch()">Clear</button>
        </div>
      </div>
      ${related.length ? `
        <div class="pill-row related-tags" aria-label="Related tags">
          ${related.map(t=>`<button type="button" class="filter-pill" onclick="searchTag('${jsq(t)}')">#${esc(t)}</button>`).join("")}
        </div>` : ""}
      ${crs.length ? `
        <h3 class="row-heading">Creators</h3>
        <div class="search-creator-row">${crs.map(searchCreatorCard).join("")}</div>` : ""}
      ${vids.length
        ? `<h3 class="row-heading">Videos</h3>${pagedGrid(vids, v=>videoCard(v,{layout:'row'}), {cls:'video-list'})}`
        : `
        ${emptyState(`No videos found for “${raw}”.`, POPULAR_TAGS.slice(0, 8))}
        ${fallback.length ? rowSection("Trending instead", fallback, { layout: "row" }) : ""}
        `}
    </div>`;
}
