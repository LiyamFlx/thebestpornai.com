/* Home page: unified hero, filter/sort bars, curated rows + expand for more. */
import { DATA, esc, creatorName, fmt, mediaUrl, ytId } from "../../shared/catalog.js";
import { videoCard, rowSection, emptyState } from "../../shared/ui.js";
import { CATEGORIES, POPULAR_TAGS } from "../../shared/taxonomy.js";
import { POSTS } from "../../blog/posts.js";
import { postCoverThumbUrl } from "../../blog/card.js";
import { vstate, persistState } from "../state.js";
import { jsq, relativeTime } from "../util.js";
import { displayViews } from "../display-metrics.js";
import {
  pubVideos, trending, byCat, byCategoryFilter, sortedVideos, movies,
  actNames, clipsByAct, highlights, originals, byIdDesc, byViewsDesc,
  byUploadedDesc, videoById, relatedTo,
} from "../catalog-queries.js";

// Homepage hero rotates between a small pool, picked once per page load
// (not per render — re-picking on every filter/sort change would make the
// hero jump around while browsing).
const HERO_VIDEO_POOL = [193, 270];
export const HERO_VIDEO_ID = HERO_VIDEO_POOL[Math.floor(Math.random() * HERO_VIDEO_POOL.length)];

// Horizontal rows: cap cards so DOM stays bounded.
const ROW_MAX = 18;
// How many category rows show before "Browse more categories".
const PRIMARY_CAT_ROWS = 2;

function homeFilterBar(){
  const filters = [["all","All"],["movies","Movies"],["scenes","Scenes"],["clips","Clips"]];
  const sorts = [["none","Default"],["latest","Latest"],["likes","Most Liked"],["views","Most Viewed"]];
  const activeCat = vstate.homeCategory;
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

const moviesRow = (allMovies) =>
  `<h3 class="row-heading">Movies</h3><div class="row-scroll">${allMovies.map(m=>videoCard(m.poster, {onClick:`openMovie('${jsq(m.title)}')`, layout:'row'})).join("")}</div>`;

function topCreatorsRow(){
  const top = DATA.creators.slice().sort((a,b)=>(b.subs||0)-(a.subs||0)).slice(0, 8);
  if(!top.length) return "";
  return `<h3 class="row-heading">Top Creators</h3><div class="row-scroll creator-circle-row">
    ${top.map(c=>`
      <div class="creator-circle" onclick="openCreator('${jsq(c.id)}')">
        <div class="creator-circle-avatar">${esc((c.name||"?")[0])}</div>
        <div class="creator-circle-name">${esc(c.name)}</div>
      </div>`).join("")}
  </div>`;
}

/* Single hero: same markup everywhere; CSS switches desktop billboard vs mobile card. */
function homeHero(hero){
  const heroIsVideo = hero.src && !ytId(hero.src);
  const laterOn = vstate.later.includes(hero.id);
  const media = hero.thumb
    ? `<img class="home-hero-img" src="${mediaUrl(hero.thumb)}" alt="" loading="eager" decoding="async"/>`
    : (heroIsVideo
        ? `<video class="home-hero-img" src="${mediaUrl(hero.src)}${hero.thumb ? '' : '#t=1'}" muted autoplay loop playsinline></video>`
        : ``);
  const liveCount = pubVideos().filter(v => !v.flagged).length.toLocaleString("en-US");
  return `
    <section class="home-hero" aria-label="Featured video">
      <div class="home-hero-media">${media}</div>
      <div class="home-hero-body">
        <span class="home-hero-tag">Featured</span>
        <span class="home-hero-count">${liveCount} videos and counting</span>
        <h1 class="home-hero-title">${esc(hero.title)}</h1>
        <p class="home-hero-meta">${esc(creatorName(hero.creator))} · ${fmt(displayViews(hero))} views${hero.uploaded ? ` · ${esc(relativeTime(hero.uploaded))}` : ''}</p>
        <div class="home-hero-actions">
          <button type="button" class="btn home-hero-play" onclick="openVideo(${hero.id})">▶ Play</button>
          <button type="button" class="hero-later-btn ${laterOn?'on':''}" data-later-id="${hero.id}" aria-pressed="${laterOn?'true':'false'}" onclick="toggleLater(${hero.id})" aria-label="${laterOn?'Remove from Watch Later':'Add to Watch Later'}" title="Watch Later"><svg class="ico"><use href="#icon-save"/></svg></button>
        </div>
      </div>
    </section>`;
}

/* "Because you watched …" — tag-overlap recs from the most recent history item. */
function becauseYouWatchedRow(){
  const lastId = vstate.history && vstate.history[0];
  if(lastId == null) return "";
  const seed = videoById(lastId);
  if(!seed) return "";
  const recs = relatedTo(seed, ROW_MAX).filter(v => v.id !== seed.id);
  if(recs.length < 3) return "";
  const shortTitle = seed.title.length > 42 ? seed.title.slice(0, 40) + "…" : seed.title;
  const heading = `Because you watched <span class="row-reason" title="${esc(seed.title)}">${esc(shortTitle)}</span>`;
  return rowSection(heading, recs, { layout: "row", allowHtmlTitle: true });
}

/* Editorial teasers linking into /blog/ — keeps the product ↔ content loop warm. */
function fromTheBlogRow(){
  if(!POSTS || !POSTS.length) return "";
  const posts = [...POSTS].sort((a,b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);
  const cards = posts.map(p => {
    const cover = postCoverThumbUrl(p);
    return `
      <a class="blog-home-card" href="/blog/${esc(p.slug)}.html">
        <div class="blog-home-card-media">
          ${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" decoding="async" width="166" height="104"/>` : ``}
          <span class="blog-home-card-pill">${esc(p.category)}</span>
        </div>
        <div class="blog-home-card-body">
          <div class="blog-home-card-title">${esc(p.title)}</div>
          <div class="blog-home-card-meta">${esc(relativeTime(p.date))} · ${p.readMins} min</div>
        </div>
      </a>`;
  }).join("");
  return `
    <div class="row-heading-wrap">
      <h3 class="row-heading">From the Blog</h3>
      <a class="row-heading-link" href="/blog/">See all →</a>
    </div>
    <div class="row-scroll blog-home-row">${cards}</div>`;
}

function moreCategoriesBlock(cats, acts){
  if(vstate.homeExpandCats){
    return `
      ${rowSection("Highlights", highlights().slice(0, ROW_MAX), { layout: "row" })}
      ${acts.map(a => rowSection("Act: " + a, clipsByAct(a).slice(0, ROW_MAX), { layout: "row" })).join("")}
      ${cats.map(c => rowSection(c, byCat(c).slice(0, ROW_MAX), { layout: "row" })).join("")}
      ${rowSection("Recently Uploaded", byUploadedDesc().slice(0, ROW_MAX), { layout: "row" })}
      <div class="home-more-wrap">
        <button type="button" class="btn ghost" onclick="setHomeExpandCats(false)">Show fewer rows</button>
      </div>`;
  }
  const preview = cats.slice(0, PRIMARY_CAT_ROWS);
  const remaining = Math.max(0, cats.length - PRIMARY_CAT_ROWS + acts.length);
  return `
    ${preview.map(c => rowSection(c, byCat(c).slice(0, ROW_MAX), { layout: "row" })).join("")}
    ${remaining > 0 ? `
    <div class="home-more-wrap">
      <button type="button" class="btn home-more-btn" onclick="setHomeExpandCats(true)">
        Browse more categories${remaining ? ` (+${remaining})` : ""}
      </button>
    </div>` : ""}`;
}

function _renderHomeBody(){
  const pub = pubVideos();
  const hero = pub.find(v=>v.id===HERO_VIDEO_ID) || pub.find(v=>v.type==="original") || pub[0];
  if(!hero) return { html: `<div class="empty">No videos available yet.</div>`, empty: true };

  const filter = vstate.homeFilter;
  const sort = vstate.homeSort;

  if(vstate.homeCategory){
    const cat = vstate.homeCategory;
    let matches = byCategoryFilter(cat);
    if(sort!=="none"){
      const matchSet = new Set(matches);
      matches = sortedVideos(sort).filter(v=>matchSet.has(v));
    }
    const shown = matches.slice(0, vstate.limit);
    const html = `
      ${homeFilterBar()}
      <h3 class="row-heading">${esc(cat)} <span class="small">(${matches.length})</span></h3>
      ${shown.length
        ? `<div class="video-list">${shown.map(v=>videoCard(v,{layout:'row'})).join("")}</div>`
        : emptyState(`No ${cat} videos yet.`, POPULAR_TAGS.filter(t=>t!==cat).slice(0,8))}
      ${matches.length > vstate.limit ? `<button class="btn ghost" style="margin:16px auto;display:block" onclick="loadMore()">Load more</button>` : ''}
    `;
    return { html, empty: !shown.length };
  }

  if(sort!=="none"){
    const label = sort==="latest" ? "Latest" : sort==="likes" ? "Most Liked" : "Most Viewed";
    const all = sortedVideos(sort).slice(0, vstate.limit);
    const html = `
      ${homeFilterBar()}
      ${all.length
        ? `<h3 class="row-heading">${label}</h3><div class="video-list">${all.map(v=>videoCard(v,{layout:'row'})).join("")}</div>`
        : emptyState("No videos match this sort yet.", POPULAR_TAGS.slice(0, 8), { emoji: "📭" })}
      ${pub.length > vstate.limit ? `<button class="btn ghost" style="margin:16px auto;display:block" onclick="loadMore()">Load more videos</button>` : ''}
    `;
    return { html, empty: !all.length };
  }

  if(filter==="movies"){
    const allMovies = movies();
    const html = `${homeFilterBar()}${allMovies.length
      ? moviesRow(allMovies)
      : emptyState("No movies yet. Browse clips and scenes instead.", POPULAR_TAGS.slice(0, 6), { emoji: "🎬" })}`;
    return { html, empty: !allMovies.length };
  }
  if(filter==="scenes"){
    const allScenes = pub.filter(v=>v.level==="scene");
    const html = `${homeFilterBar()}${allScenes.length
      ? rowSection("Scenes", allScenes.slice(0, ROW_MAX), {layout:'row'})
      : emptyState("No scenes tagged yet.", POPULAR_TAGS.slice(0, 6), { emoji: "🎞" })}`;
    return { html, empty: !allScenes.length };
  }
  if(filter==="clips"){
    const allClips = pub.filter(v=>v.level==="clip");
    const html = `${homeFilterBar()}${allClips.length
      ? rowSection("Clips", allClips.slice(0, ROW_MAX), {layout:'row'})
      : emptyState("No clips tagged yet.", POPULAR_TAGS.slice(0, 6), { emoji: "📎" })}`;
    return { html, empty: !allClips.length };
  }

  // ---- Default curated home (Sprint B) ----
  const top = trending();
  const allMovies = movies();
  const historySet = new Set(vstate.history);
  // Cap like every other home row so long history does not dump 50 full cards.
  // Drop any history id that no longer resolves to a real video (deleted,
  // unpublished, or plain corrupted localStorage data) — don't just hide it
  // from this render, prune it from vstate.history for good so it can't keep
  // reappearing every time this page renders.
  const resolvedHistory = [];
  const validHistoryIds = [];
  for(const id of vstate.history){
    const v = videoById(id);
    if(v){ resolvedHistory.push(v); validHistoryIds.push(id); }
  }
  if(validHistoryIds.length !== vstate.history.length){
    vstate.history = validHistoryIds;
    persistState();
  }
  const continueWatching = resolvedHistory.slice(0, ROW_MAX);
  const recommended = (() => {
    const nw = top.filter(v => !historySet.has(v.id));
    return (nw.length >= 6 ? nw : top).slice(0, ROW_MAX);
  })();
  const cats = DATA.categories || CATEGORIES;
  const acts = actNames();

  const html = `
    ${homeFilterBar()}
    ${homeHero(hero)}

    ${continueWatching.length ? rowSection("Continue Watching", continueWatching, { layout: "row" }) : ""}
    ${becauseYouWatchedRow()}
    ${rowSection("Fresh Uploads", byIdDesc().slice(0, ROW_MAX), { layout: "row" })}
    ${rowSection("Recommended for you", recommended, { layout: "row" })}
    ${rowSection("Trending now", byViewsDesc().slice(0, ROW_MAX), { layout: "row" })}
    ${fromTheBlogRow()}
    ${rowSection("House Originals", originals().slice(0, ROW_MAX), { layout: "row" })}
    ${allMovies.length ? moviesRow(allMovies) : ""}
    ${topCreatorsRow()}
    ${moreCategoriesBlock(cats, acts)}
  `;
  return { html, empty: false };
}

export function renderHome() {
  return _renderHomeBody().html;
}
