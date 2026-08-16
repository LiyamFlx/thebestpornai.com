/* Home page: unified hero, filter/sort bars, curated rows + expand for more. */
import { DATA, esc, creatorName, fmt, mediaUrl, ytId } from "../../shared/catalog.js";
import { videoCard, rowSection, emptyState } from "../../shared/ui.js";
import { CATEGORIES, POPULAR_TAGS } from "../../shared/taxonomy.js";
import { categoryPagePath, homeFilterHref } from "../../shared/public-routes.js";
import { POSTS, postsForHub, isFeaturedPost } from "../../blog/posts.js";
import { postCoverThumbUrl } from "../../blog/card.js";
import { vstate, persistState } from "../state.js";
import { jsq, relativeTime } from "../util.js";
import { displayViews } from "../display-metrics.js";
import {
  pubVideos, trending, byCat, byCategoryFilter, sortedVideos, movies,
  actNames, clipsByAct, highlights, originals, byIdDesc, byViewsDesc,
  byUploadedDesc, videoById, relatedTo, pornstars,
} from "../catalog-queries.js";

// Homepage hero rotates through a small, high-signal pool of catalog videos
// (top performers with a real playable file — no YouTube embeds, no vertical
// clips) instead of a couple of hardcoded ids. Built lazily and re-derived
// whenever DATA.videos changes identity/length (seed -> full catalog swap,
// manifest sync) so the pool upgrades from seed-only to catalog-wide once
// the full list lands, same invalidation signal catalog-queries.js uses.
const HERO_POOL_SIZE = 10;
let _heroPool = null, _heroPoolLen = -1, _heroPoolRef = null;
function heroPool(){
  if(_heroPool && DATA.videos === _heroPoolRef && DATA.videos.length === _heroPoolLen) return _heroPool;
  _heroPoolRef = DATA.videos; _heroPoolLen = DATA.videos.length;
  const real = v => v.src && !ytId(v.src);
  const pool = trending().filter(real).slice(0, HERO_POOL_SIZE);
  _heroPool = pool.length ? pool : pubVideos().filter(real).slice(0, HERO_POOL_SIZE);
  return _heroPool;
}

// Which pool entry is on screen — picked once per page load (not per render,
// so filtering/sorting doesn't make the hero jump around), then advanced by
// the rotation timer (see attachHeroRotation() in render.js).
let _heroIndex = null;
export function currentHero(){
  const pool = heroPool();
  if(!pool.length) return null;
  if(_heroIndex === null) _heroIndex = Math.floor(Math.random() * pool.length);
  return pool[_heroIndex % pool.length];
}
export function nextHero(){
  const pool = heroPool();
  if(!pool.length) return null;
  _heroIndex = ((_heroIndex ?? 0) + 1) % pool.length;
  return pool[_heroIndex];
}

// Horizontal rows: cap cards so DOM stays bounded.
const ROW_MAX = 18;
// How many category rows show before "Browse more categories".
const PRIMARY_CAT_ROWS = 2;

export const SORT_OPTIONS = [
  { key: "none", label: "Featured", icon: "✨" },
  { key: "latest", label: "Latest Releases", icon: "🕒" },
  { key: "views", label: "Most Viewed", icon: "👁️" },
  { key: "likes", label: "Top Rated", icon: "❤️" },
  { key: "longest", label: "Longest Duration", icon: "⏳" },
  { key: "shortest", label: "Shortest Clips", icon: "⚡" },
  { key: "trending", label: "Trending Now", icon: "🔥" },
];

export function renderSortControl(currentSort = "none", onSelectFn = "setHomeSort"){
  const activeOpt = SORT_OPTIONS.find(s => s.key === currentSort) || SORT_OPTIONS[0];
  return `
    <div class="sort-control-wrap">
      <button type="button" class="sort-trigger-btn ${currentSort !== 'none' ? 'is-sorted' : ''}" onclick="this.parentElement.classList.toggle('open')" aria-label="Sort videos: ${activeOpt.label}">
        <svg class="ico sort-ico" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>
        <span class="sort-btn-label">${esc(activeOpt.label)}</span>
        <span class="sort-btn-arrow">▾</span>
      </button>
      <div class="sort-menu-popover">
        <div class="sort-menu-header">Sort By</div>
        ${SORT_OPTIONS.map(s => {
          const isSelected = currentSort === s.key;
          return `
            <button type="button" class="sort-menu-item ${isSelected ? 'active' : ''}" onclick="this.closest('.sort-control-wrap').classList.remove('open'); ${onSelectFn}('${s.key}')">
              <span class="sort-item-icon">${s.icon}</span>
              <span class="sort-item-title">${esc(s.label)}</span>
              ${isSelected ? '<span class="sort-item-check">✓</span>' : ''}
            </button>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

export function toggleCatMenu(btn, ev) {
  if (ev) ev.stopPropagation();
  if (!btn) return;
  const wrap = btn.closest(".cat-more");
  if (!wrap) return;
  const menu = wrap.querySelector(".cat-more-menu");
  const wasOpen = wrap.classList.contains("open");

  // Close any other open popovers
  document.querySelectorAll(".cat-more.open, .sort-control-wrap.open").forEach((el) => el.classList.remove("open"));

  if (!wasOpen && menu) {
    wrap.classList.add("open");
    const rect = btn.getBoundingClientRect();
    const isMobile = window.innerWidth <= 760;
    if (isMobile) {
      menu.style.position = "fixed";
      menu.style.left = "12px";
      menu.style.right = "12px";
      menu.style.top = Math.max(10, Math.min(rect.bottom + 8, window.innerHeight - 340)) + "px";
      menu.style.width = "auto";
      menu.style.maxHeight = "60vh";
    } else {
      const menuWidth = 360;
      let left = rect.left;
      if (left + menuWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - menuWidth - 16);
      }
      menu.style.position = "fixed";
      menu.style.top = (rect.bottom + 6) + "px";
      menu.style.left = left + "px";
      menu.style.width = menuWidth + "px";
      menu.style.maxHeight = "400px";
    }
    menu.style.zIndex = "99999";
  }
}

function homeFilterBar(){
  const filters = [
    ["all","All"],
    ["movies","Movies"],
    ["scenes","Scenes"],
    ["clips","Clips"],
    ["pornstars","Pornstars"],
  ];
  const POPULAR_QUICK_CATS = ["Latina", "MILF", "POV", "Big Tits", "Blonde", "Amateur"];
  const activeCat = vstate.homeCategory;
  const showSort = vstate.homeFilter !== "pornstars";
  return `<div class="home-toolbar-v2">
    <div class="home-chips-strip mchrome-scroll">
      ${filters.map(([key,label])=>{
        const href = homeFilterHref(key);
        const on = vstate.homeFilter===key && !activeCat;
        return `<a href="${esc(href)}" class="filter-pill ${on?'active':''}" ${key==="pornstars"?"":`onclick="setHomeFilter('${key}'); return false;"`}>${label}</a>`;
      }).join("")}
      <span class="filter-divider"></span>
      ${POPULAR_QUICK_CATS.map(c=>{
        const href = categoryPagePath(c) || ("/#browse/"+encodeURIComponent(c));
        return `<a href="${esc(href)}" class="filter-pill ${activeCat===c?'active':''}">${esc(c)}</a>`;
      }).join("")}
      <span class="cat-more">
        <button type="button" class="filter-pill cat-picker-btn ${activeCat && !POPULAR_QUICK_CATS.includes(activeCat)?'active':''}" onclick="toggleCatMenu(this, event)">
          <span class="cat-pill-label">${activeCat && !POPULAR_QUICK_CATS.includes(activeCat) ? esc(activeCat) : 'More Categories (' + CATEGORIES.length + ')'}</span>
          <span class="cat-pill-caret">▾</span>
        </button>
        <div class="cat-more-menu">
          <div class="cat-more-menu-header">All Categories (${CATEGORIES.length})</div>
          <div class="cat-more-grid">
            ${CATEGORIES.map(c=>{
              const href = categoryPagePath(c) || ("/#browse/"+encodeURIComponent(c));
              return `<a href="${esc(href)}" class="cat-more-item ${activeCat===c?'active':''}">${esc(c)}</a>`;
            }).join("")}
          </div>
        </div>
      </span>
    </div>
    ${showSort ? `
      <div class="home-sort-wrap">
        ${renderSortControl(vstate.homeSort, "setHomeSort")}
      </div>
    ` : ""}
  </div>`;
}

/** Full pornstar card grid for the home "Pornstars" filter (same cards as #pornstars hub). */
function pornstarsFilterBody(){
  const stars = pornstars().slice().sort((a, b) => (b.subs || 0) - (a.subs || 0));
  if(!stars.length){
    return emptyState("No pornstars yet. Check back soon.", POPULAR_TAGS.slice(0, 6), { emoji: "⭐" });
  }
  return `
    <h3 class="row-heading">Pornstars <span class="small">(${stars.length})</span></h3>
    <p class="sub" style="margin-top:-4px">Intro + Shorts packs — tap a star to open their page</p>
    <div class="pornstars-grid">
      ${stars.map(c => {
        const vids = DATA.videos.filter(v => v.creator === c.id && v.status !== "private" && v.status !== "pending");
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
    </div>`;
}

const moviesRow = (allMovies) =>
  `<h3 class="row-heading">Movies</h3><div class="row-scroll">${allMovies.map(m=>videoCard(m.poster, {onClick:`openMovie('${jsq(m.title)}')`, layout:'row'})).join("")}</div>`;

function topCreatorsRow(){
  const top = DATA.creators.filter(c => c.kind !== "pornstar").slice().sort((a,b)=>(b.subs||0)-(a.subs||0)).slice(0, 8);
  if(!top.length) return "";
  return `<h3 class="row-heading">Top Creators</h3><div class="row-scroll creator-circle-row">
    ${top.map(c=>`
      <div class="creator-circle" onclick="openCreator('${jsq(c.id)}')">
        <div class="creator-circle-avatar">${esc((c.name||"?")[0])}</div>
        <div class="creator-circle-name">${esc(c.name)}</div>
      </div>`).join("")}
  </div>`;
}

/** Face pack row — pornstars with avatar when set. */
function pornstarsRow(){
  const stars = pornstars().slice().sort((a,b)=>(b.subs||0)-(a.subs||0)).slice(0, 12);
  if(!stars.length) return "";
  return `
    <div class="row-heading-wrap">
      <h3 class="row-heading">Pornstars</h3>
      <button type="button" class="row-heading-link" onclick="go('pornstars')">See all →</button>
    </div>
    <div class="row-scroll creator-circle-row pornstar-circle-row">
      ${stars.map(c => {
        const av = c.avatar
          ? `<img class="creator-circle-avatar-img" src="${esc(mediaUrl(c.avatar))}" alt="" loading="lazy" decoding="async"/>`
          : esc((c.name||"?")[0]);
        return `
      <div class="creator-circle pornstar-circle" onclick="openCreator('${jsq(c.id)}')" title="${esc(c.name)}">
        <div class="creator-circle-avatar${c.avatar ? " has-img" : ""}">${av}</div>
        <div class="creator-circle-name">${esc(c.name)}</div>
      </div>`;
      }).join("")}
    </div>`;
}

/* Single hero: same markup everywhere; CSS switches desktop billboard vs mobile card.
   Always renders the actual video file, never the generated poster JPG — that
   thumbnail is a single small ffmpeg-grabbed frame that reads visibly blurry
   once CSS scales it up to fill the full-width billboard. `poster` still uses
   the thumb (when present) purely for an instant first paint before the
   video's own first frame decodes. */
function homeHero(hero){
  const heroIsVideo = hero.src && !ytId(hero.src);
  const laterOn = vstate.later.includes(hero.id);
  const media = heroIsVideo
    ? `<video class="home-hero-img" src="${mediaUrl(hero.src)}" ${hero.thumb ? `poster="${mediaUrl(hero.thumb)}"` : ''} muted autoplay loop playsinline preload="auto"></video>`
    : (hero.thumb ? `<img class="home-hero-img" src="${mediaUrl(hero.thumb)}" alt="" loading="eager" decoding="async"/>` : ``);
  const liveCount = pubVideos().filter(v => !v.flagged).length.toLocaleString("en-US");
  return `
    <section class="home-hero" aria-label="Featured video" data-hero-id="${hero.id}">
      <div class="home-hero-media">${media}</div>
      <div class="home-hero-body">
        <div class="home-hero-badge-row">
          <span class="home-hero-tag">✨ Featured</span>
          <span class="home-hero-count">4K Ultra HD · ${liveCount} Videos</span>
          <span class="home-hero-free-pill">100% Free · No Signup</span>
        </div>
        <h1 class="home-hero-title">${esc(hero.title)}</h1>
        <p class="home-hero-meta">${esc(creatorName(hero.creator))} · ${fmt(displayViews(hero))} views${hero.uploaded ? ` · ${esc(relativeTime(hero.uploaded))}` : ''}</p>
        <div class="home-hero-actions">
          <button type="button" class="btn home-hero-play" onclick="openVideo(${hero.id})">
            <span class="play-ico">▶</span> Play Now
          </button>
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
  // Featured generators guide first, then newest others (matches /blog/ hub).
  const posts = postsForHub(POSTS).slice(0, 8);
  const cards = posts.map((p, i) => {
    const cover = postCoverThumbUrl(p);
    const pill = isFeaturedPost(p) ? "Featured" : p.category;
    return `
      <a class="blog-home-card" href="/blog/${esc(p.slug)}.html">
        <div class="blog-home-card-media">
          ${cover ? `<img src="${esc(cover)}" alt="" loading="${i === 0 ? "eager" : "lazy"}" decoding="async" width="166" height="104"/>` : ``}
          <span class="blog-home-card-pill">${esc(pill)}</span>
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
  const hero = currentHero() || pub.find(v=>v.type==="original") || pub[0];
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
    const sortObj = SORT_OPTIONS.find(s => s.key === sort);
    const label = sortObj ? sortObj.label : "Sorted Videos";
    const icon = sortObj ? sortObj.icon : "⚡";
    const all = sortedVideos(sort).slice(0, vstate.limit);
    const html = `
      ${homeFilterBar()}
      ${all.length
        ? `<h3 class="row-heading">${icon} ${label} <span class="small">(${pub.length} videos)</span></h3><div class="video-list">${all.map(v=>videoCard(v,{layout:'row'})).join("")}</div>`
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
  if(filter==="pornstars"){
    const stars = pornstars();
    const html = `${homeFilterBar()}${pornstarsFilterBody()}`;
    return { html, empty: !stars.length };
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

function homeAffiliatePromoStrip(){
  return `
    <div class="home-affiliate-strip">
      <div class="home-affiliate-left">
        <div class="home-affiliate-badge">⚡ AI Studio Partner</div>
        <div class="home-affiliate-title">Create Custom AI Adult Videos &amp; 4K Scenes</div>
        <div class="home-affiliate-sub">Use <strong>OurDream.ai</strong> to generate high-fidelity photoreal AI babes, uncensored fantasies, and cinematic videos with zero restrictions.</div>
      </div>
      <a href="https://ourdream.ai/?ref=thebestpornai" target="_blank" rel="noopener nofollow" class="home-affiliate-cta">
        <span>Start Generating Free</span>
        <span class="cta-arrow">→</span>
      </a>
    </div>`;
}

  const html = `
    ${homeFilterBar()}
    ${homeHero(hero)}

    ${continueWatching.length ? rowSection("Continue Watching", continueWatching, { layout: "row" }) : ""}
    ${becauseYouWatchedRow()}
    ${rowSection("Fresh Uploads", byIdDesc().slice(0, ROW_MAX), { layout: "row" })}
    ${homeAffiliatePromoStrip()}
    ${rowSection("Recommended for you", recommended, { layout: "row" })}
    ${rowSection("Trending now", byViewsDesc().slice(0, ROW_MAX), { layout: "row" })}
    ${fromTheBlogRow()}
    ${pornstarsRow()}
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
