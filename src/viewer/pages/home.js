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

// Single lookup table built once per module load. Used to resolve
// history/continue-watching IDs in O(1) instead of DATA.videos.find() per id.
const VIDEO_BY_ID = new Map(DATA.videos.map(v => [v.id, v]));

function homeFilterBar(){
  const filters = [["all","All"],["movies","Movies"],["scenes","Scenes"],["clips","Clips"]];
  const sorts = [["none","Default"],["latest","Latest"],["likes","Most Liked"],["views","Most Viewed"]];
  const activeCat = vstate.homeCategory;
  // `.mchrome-scroll` turns the filter/category row into a single horizontal
  // scroll strip on mobile (never wraps); desktop keeps the wrapping pill row.
  // All categories live behind one "Filters ▾" dropdown (was previously a
  // handful of always-visible category pills plus a "More" overflow) so the
  // row only ever shows the 4 format tabs + Filters + Sort. On mobile the
  // dropdown switches to position:fixed (see style.css) since the scroll
  // strip's overflow-x:auto would otherwise clip an absolutely-positioned menu.
  return `<div class="pill-row home-combined-bar mchrome-scroll">
    ${filters.map(([key,label])=>`<button class="filter-pill ${(vstate.homeFilter===key && !activeCat)?'active':''}" onclick="setHomeFilter('${key}')">${label}</button>`).join("")}
    <span class="cat-more">
      <button class="filter-pill ${activeCat?'active':''}" onclick="this.parentNode.classList.toggle('open')">${activeCat ? esc(activeCat) : 'Filters'} ▾</button>
      <div class="cat-more-menu">
        ${CATEGORIES.map(c=>`<button class="cat-more-item ${activeCat===c?'active':''}" onclick="setHomeCategory('${jsq(c)}')">${esc(c)}</button>`).join("")}
      </div>
    </span>
    <select class="sort-select sort-select-inline" onchange="setHomeSort(this.value)" aria-label="Sort videos">
      ${sorts.map(([key,label])=>`<option value="${key}" ${vstate.homeSort===key?'selected':''}>Sort: ${label}</option>`).join("")}
    </select>
  </div>`;
}

// `m.poster` is a video object (the full movie, or its lowest-numbered scene
// as a fallback) per movies()'s return shape in catalog-queries.js — despite
// the field name, this is NOT an image URL, so passing it straight into
// videoCard() (which expects a video-shaped object) is correct as-is.
const moviesRow = (allMovies) =>
  `<h3>Movies</h3><div class="row-scroll">${allMovies.map(m=>videoCard(m.poster, {onClick:`openMovie('${jsq(m.title)}')`, layout:'row'})).join("")}</div>`;

// Circular-avatar creator row (Netflix/YouTube "Top Creators" pattern).
// Ranked by subscriber count; routes through the same openCreator() the
// Vertical Feed's avatar click already uses — a real per-creator profile
// page, not a placeholder link.
function topCreatorsRow(){
  const top = DATA.creators.slice().sort((a,b)=>(b.subs||0)-(a.subs||0)).slice(0, 8);
  if(!top.length) return "";
  return `<h3>Top Creators</h3><div class="row-scroll creator-circle-row">
    ${top.map(c=>`
      <div class="creator-circle" onclick="openCreator('${jsq(c.id)}')">
        <div class="creator-circle-avatar">${esc((c.name||"?")[0])}</div>
        <div class="creator-circle-name">${esc(c.name)}</div>
      </div>`).join("")}
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
        <button class="hero-later-btn ${vstate.later.includes(hero.id)?'on':''}" onclick="toggleLater(${hero.id})" aria-label="${vstate.later.includes(hero.id)?'Remove from Watch Later':'Add to Watch Later'}" title="Watch Later"><svg class="ico"><use href="#icon-save"/></svg></button>
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
    ${topCreatorsRow()}
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
  return _renderHomeBody().html;
}