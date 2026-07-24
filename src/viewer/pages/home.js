/* Home page: hero, filter/sort bars, and the row-based feed. */
import { DATA, esc, creatorName, fmt, mediaUrl, ytId } from "../../shared/catalog.js";
import { videoCard, rowSection, emptyState } from "../../shared/ui.js";
import { CATEGORIES, POPULAR_TAGS } from "../../shared/taxonomy.js";
import { vstate } from "../state.js";
import { jsq } from "../util.js";
import { pubVideos, trending, byCat, byCategoryFilter, sortedVideos, movies, actNames, clipsByAct, highlights } from "../catalog-queries.js";

export const HERO_VIDEO_ID = 470; // pinned homepage hero — update this id to change it

// A horizontal scroll row only ever shows a handful of cards at once; capping
// each row keeps the homepage DOM to hundreds of cards instead of thousands
// (categories/acts were previously rendered in full — every match got a card).
const ROW_MAX = 24;

// Top categories shown inline in the filter bar; the rest live under "More ▾".
const TOP_CATEGORIES = CATEGORIES.slice(0, 8);
const MORE_CATEGORIES = CATEGORIES.slice(8);

// Single lookup table built once per module load. Used to resolve
// history/continue-watching IDs in O(1) instead of DATA.videos.find() per id.
const VIDEO_BY_ID = new Map(DATA.videos.map(v => [v.id, v]));

function homeFilterBar(){
  const filters = [["all","All"],["movies","Movies"],["scenes","Scenes"],["clips","Clips"]];
  const sorts = [["none","Default"],["latest","Latest"],["likes","Most Liked"],["views","Most Viewed"]];
  const activeCat = vstate.homeCategory;
  // `.mchrome-scroll` turns the filter/category rows into a single horizontal
  // scroll strip on mobile (never wraps); desktop keeps the wrapping pill rows.
  // On mobile the "More ▾" dropdown would be clipped by the scroll container, so
  // the overflow categories are also emitted inline as `.cat-scroll-extra` pills
  // (hidden on desktop, shown inline on mobile) — everything scrolls instead.
  // Type filters (All/Movies/Scenes/Clips) and top categories now render as
  // ONE combined scrollable chip row instead of two stacked rows — on mobile
  // this was previously two full-width rows of chrome before any video
  // appeared. "More" still opens the overflow-categories menu; the sort
  // control is a single compact select (icon+label) rather than either a
  // full pill row (desktop) or a full-width bar (mobile), so it never
  // reserves its own full line.
  return `<div class="pill-row home-combined-bar mchrome-scroll">
    ${filters.map(([key,label])=>`<button class="filter-pill ${(vstate.homeFilter===key && !activeCat)?'active':''}" onclick="setHomeFilter('${key}')">${label}</button>`).join("")}
    <span class="chip-sep" aria-hidden="true"></span>
    ${TOP_CATEGORIES.map(c=>`<button class="filter-pill ${activeCat===c?'active':''}" onclick="setHomeCategory('${jsq(c)}')">${esc(c)}</button>`).join("")}
    <span class="cat-more">
      <button class="filter-pill" onclick="this.parentNode.classList.toggle('open')">More ▾</button>
      <div class="cat-more-menu">
        ${MORE_CATEGORIES.map(c=>`<button class="cat-more-item ${activeCat===c?'active':''}" onclick="setHomeCategory('${jsq(c)}')">${esc(c)}</button>`).join("")}
      </div>
    </span>
    ${MORE_CATEGORIES.map(c=>`<button class="filter-pill cat-scroll-extra ${activeCat===c?'active':''}" onclick="setHomeCategory('${jsq(c)}')">${esc(c)}</button>`).join("")}
  </div>
  <select class="sort-select" onchange="setHomeSort(this.value)" aria-label="Sort videos">
    ${sorts.map(([key,label])=>`<option value="${key}" ${vstate.homeSort===key?'selected':''}>Sort: ${label}</option>`).join("")}
  </select>`;
}

const moviesRow = (allMovies) =>
  `<h3>Movies</h3><div class="row-scroll">${allMovies.map(m=>videoCard(m.poster, {onClick:`openMovie('${jsq(m.title)}')`, layout:'row'})).join("")}</div>`;
// NOTE: this passes `m.poster` (not the movie object `m`) into videoCard, unlike every
// other call site in this file which passes the full video object. If videoCard expects
// a video-shaped object (id/title/thumb/etc.), this is likely broken — verify against
// movies()'s return shape and videoCard's signature before shipping. Left unchanged
// since I can't confirm the contract from this file alone.

function viewToggleTabs(active) {
  return `<div class="view-toggle-tabs">
    <button class="toggle-tab ${active==='grid'?'active':''}" onclick="go('home')">Grid View</button>
    <button class="toggle-tab ${active==='feed'?'active':''}" onclick="go('feed')">Vertical Feed</button>
  </div>`;
}

// Returns { html, empty } instead of a bare string. Callers should check the
// explicit `empty` flag rather than string-matching the rendered HTML for
// 'class="empty"' — that approach false-positives whenever any nested
// sub-row (e.g. an empty Highlights row) happens to render empty-state markup
// inside an otherwise fully-populated homepage.
function _renderHomeBody(){
  const pub = pubVideos(); // computed once, reused for every section below
  const hero = pub.find(v=>v.id===HERO_VIDEO_ID) || pub.find(v=>v.type==="original") || pub[0];
  if(!hero) return { html: `<div class="empty">No videos available yet.</div>`, empty: true };

  const filter = vstate.homeFilter;
  const sort = vstate.homeSort;

  // A selected category filters the whole feed to matching videos (category or
  // tag match), overriding the row layout with a focused grid.
  if(vstate.homeCategory){
    const cat = vstate.homeCategory;
    let matches = byCategoryFilter(cat);
    if(sort!=="none"){
      const matchSet = new Set(matches); // O(1) membership check instead of Array#includes in a loop
      matches = sortedVideos(sort).filter(v=>matchSet.has(v));
    }
    const shown = matches.slice(0, vstate.limit);
    const html = `
      ${homeFilterBar()}
      <h3>${esc(cat)} <span class="small">(${matches.length})</span></h3>
      ${shown.length ? `<div class="video-list">${shown.map(v=>videoCard(v,{layout:'row'})).join("")}</div>` : emptyState(`No ${cat} videos yet.`, POPULAR_TAGS.filter(t=>t!==cat).slice(0,8))}
      ${matches.length > vstate.limit ? `<button class="btn ghost" style="margin:16px auto;display:block" onclick="loadMore()">Load more</button>` : ''}
    `;
    return { html, empty: !shown.length };
  }

  // A non-default sort takes priority over the Movies/Scenes/Clips filter and
  // replaces the usual row set with one flat grid, same pattern as those filters.
  if(sort!=="none"){
    const label = sort==="latest" ? "Latest" : sort==="likes" ? "Most Liked" : "Most Viewed";
    const all = sortedVideos(sort).slice(0, vstate.limit);
    const html = `
      ${homeFilterBar()}
      ${all.length ? `<h3>${label}</h3><div class="video-list">${all.map(v=>videoCard(v,{layout:'row'})).join("")}</div>` : `<div class="empty">No videos yet.</div>`}
      ${pub.length > vstate.limit ? `<button class="btn ghost" style="margin:16px auto;display:block" onclick="loadMore()">Load more videos</button>` : ''}
    `;
    return { html, empty: !all.length };
  }

  // Movies/Scenes/Clips filters replace the usual row set with a focused view;
  // "all" (the default) keeps today's full homepage layout unchanged.
  if(filter==="movies"){
    const allMovies = movies();
    const html = `${homeFilterBar()}${allMovies.length ? moviesRow(allMovies) : `<div class="empty">No movies yet.</div>`}`;
    return { html, empty: !allMovies.length };
  }
  if(filter==="scenes"){
    const allScenes = pub.filter(v=>v.level==="scene");
    const html = `${homeFilterBar()}${allScenes.length ? rowSection("Scenes", allScenes, {layout:'row'}) : `<div class="empty">No scenes yet.</div>`}`;
    return { html, empty: !allScenes.length };
  }
  if(filter==="clips"){
    const allClips = pub.filter(v=>v.level==="clip");
    const html = `${homeFilterBar()}${allClips.length ? rowSection("Clips", allClips, {layout:'row'}) : `<div class="empty">No clips yet.</div>`}`;
    return { html, empty: !allClips.length };
  }

  const top = trending();
  const allMovies = movies();
  const heroIsVideo = hero.src && !ytId(hero.src); // computed once, reused by desktop + mobile hero
  const historySet = new Set(vstate.history); // O(1) membership for the Recommended row filter
  const continueWatching = vstate.history.map(id => VIDEO_BY_ID.get(id)).filter(Boolean);

  const html = `
    ${homeFilterBar()}
    <!-- Desktop Hero -->
    <div class="hero">
      ${heroIsVideo ? `<video src="${mediaUrl(hero.src)}" muted autoplay loop playsinline></video>` : ``}
      <div class="hero-body">
        <span class="tag">HOUSE ORIGINAL</span>
        <h1>${esc(hero.title)}</h1>
        <p class="sub">${esc(creatorName(hero.creator))} • ${fmt(hero.views)} views</p>
        <button class="btn" onclick="openVideo(${hero.id})">▶ Play</button>
        <button class="btn ghost" onclick="toggleLater(${hero.id})">+ Watch Later</button>
      </div>
    </div>

    <!-- Mobile Featured Hero Banner (Above-the-Fold Anchor) -->
    <div class="mobile-hero" onclick="openVideo(${hero.id})">
      <div class="mobile-hero-bg">
        ${hero.thumb ? `<img src="${mediaUrl(hero.thumb)}" alt="" loading="eager"/>` : (heroIsVideo ? `<video src="${mediaUrl(hero.src)}#t=1" muted autoplay loop playsinline></video>` : ``)}
      </div>
      <div class="mobile-hero-overlay">
        <span class="mobile-hero-tag">⚡ FEATURED ORIGINAL</span>
        <div class="mobile-hero-title">${esc(hero.title)}</div>
        <div class="mobile-hero-meta">${esc(creatorName(hero.creator))} • ${fmt(hero.views)} views</div>
        <button class="btn mobile-hero-cta" onclick="event.stopPropagation();openVideo(${hero.id})">
          ▶ Watch Now
        </button>
      </div>
    </div>

    ${continueWatching.length ? rowSection("Continue Watching", continueWatching, {layout:'row'}) : ""}
    ${rowSection("🔥 Fresh Uploads", pub.slice().sort((a,b)=>(Number(b.id)||0)-(Number(a.id)||0)).slice(0, vstate.limit), {layout:'row'})}
    ${rowSection("Recommended For You", (()=>{ const nw=top.filter(v=>!historySet.has(v.id)); return nw.length>=6?nw.slice(0, vstate.limit):top.slice(0, vstate.limit); })(), {layout:'row'})}
    ${rowSection("Trending Now", pub.slice().sort((a,b)=>b.views-a.views).slice(0, vstate.limit), {layout:'row'})}
    ${rowSection("House Originals", pub.filter(v=>v.type==="original").slice(0, vstate.limit), {layout:'row'})}
    ${allMovies.length ? moviesRow(allMovies) : ""}
    ${rowSection("Highlights", highlights().slice(0, ROW_MAX), {layout:'row'})}
    ${actNames().map(a=>rowSection("Act: "+esc(a), clipsByAct(a).slice(0, ROW_MAX), {layout:'row'})).join("")}
    ${DATA.categories.map(c=>rowSection(c, byCat(c).slice(0, ROW_MAX), {layout:'row'})).join("")}
    ${rowSection("Recently Uploaded", pub.slice().sort((a,b)=>b.uploaded.localeCompare(a.uploaded)).slice(0, vstate.limit), {layout:'row'})}
    ${pub.length > vstate.limit ? `<button class="btn ghost" style="margin:16px auto;display:block" onclick="loadMore()">Load more videos</button>` : ''}
  `;
  return { html, empty: false };
}

export function renderHome() {
  const { html, empty } = _renderHomeBody();
  if (empty) return html;
  return viewToggleTabs('grid') + html;
}