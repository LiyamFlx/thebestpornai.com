/* Home page: unified hero, filter/sort bars, curated rows + expand for more. */
import { DATA, esc, creatorName, fmt, mediaUrl, ytId, loadFullCatalog } from "../../shared/catalog.js";
import { videoCard, rowSection, emptyState } from "../../shared/ui.js";
import { CATEGORIES, POPULAR_TAGS } from "../../shared/taxonomy.js";
import { browsePath, homeFilterHref } from "../../shared/public-routes.js";
import { postCoverThumbUrl } from "../../blog/card.js";
import { vstate, persistState } from "../state.js";
import { jsq, relativeTime } from "../util.js";
import { displayViews } from "../display-metrics.js";
import {
  pubVideos, searchableVideos, trending, byCat, byCategoryFilter, sortedVideos, movies,
  actNames, clipsByAct, highlights, originals, byViewsDesc,
  byUploadedDesc, newestUploads, videoById, relatedTo, pornstars, visible,
} from "../catalog-queries.js";
import { affiliateChoiceHtml } from "../../shared/affiliates.js";

// Hero pool: top real-file videos (no YouTube/vertical); rebuilt when DATA.videos identity/length changes.
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

// Picked once per page load so filter/sort re-renders don't make the hero jump; advanced by attachHeroRotation().
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

const ROW_MAX = 18;
const PRIMARY_CAT_ROWS = 2;
const POPULAR_QUICK_CATS = ["Latina", "MILF", "POV", "Big Tits", "Blonde", "Amateur"];
const HOME_FILTERS = [
  ["all", "All"],
  ["movies", "Movies"],
  ["scenes", "Scenes"],
  ["clips", "Clips"],
  ["pornstars", "Pornstars"],
];

export const SORT_OPTIONS = [
  { key: "none", label: "Featured", icon: "✨" },
  { key: "latest", label: "Latest Releases", icon: "🕒" },
  { key: "views", label: "Most Viewed", icon: "👁️" },
  { key: "likes", label: "Top Rated", icon: "❤️" },
  { key: "longest", label: "Longest Duration", icon: "⏳" },
  { key: "shortest", label: "Shortest Clips", icon: "⚡" },
  { key: "trending", label: "Trending Now", icon: "🔥" },
];

/* ---- Event delegation (Invariant #1: zero inline handlers) ---- */
const GLOBAL_NAME = /^[A-Za-z_$][\w$]*$/;
function callGlobal(name, ...args){
  const fn = GLOBAL_NAME.test(name || "") ? window[name] : null;
  return typeof fn === "function" ? fn(...args) : undefined;
}

function closePopovers(except){
  document.querySelectorAll(".cat-more.open, .sort-control-wrap.open").forEach((el) => {
    if(el === except) return;
    el.classList.remove("open");
    const trigger = el.querySelector("[aria-expanded]");
    if(trigger) trigger.setAttribute("aria-expanded", "false");
  });
}

function toggleSortMenu(btn){
  const wrap = btn.closest(".sort-control-wrap");
  if(!wrap) return;
  closePopovers(wrap);
  const open = wrap.classList.toggle("open");
  btn.setAttribute("aria-expanded", String(open));
}

const HOME_ACTS = {
  filter: (el) => callGlobal("setHomeFilter", el.dataset.key),
  sortToggle: (el) => toggleSortMenu(el),
  sort: (el) => { closePopovers(); callGlobal(el.dataset.sortFn, el.dataset.key); },
  catMenu: (el, e) => toggleCatMenu(el, e),
  creator: (el) => callGlobal("openCreator", el.dataset.id),
  go: (el) => callGlobal("go", el.dataset.page),
  play: (el) => callGlobal("openVideo", Number(el.dataset.id)),
  later: (el) => callGlobal("toggleLater", Number(el.dataset.id)),
  loadMore: () => callGlobal("loadMore"),
  expandCats: (el) => callGlobal("setHomeExpandCats", el.dataset.on === "1"),
};

function onHomeClick(e){
  const el = e.target.closest("[data-home-act]");
  if(!el){
    if(!e.target.closest(".cat-more, .sort-control-wrap")) closePopovers();
    return;
  }
  const act = HOME_ACTS[el.dataset.homeAct];
  if(!act) return;
  // Let cmd/ctrl/shift/middle-click on real links open a new tab.
  if(el.tagName === "A" && (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return;
  e.preventDefault();
  act(el, e);
}

function onHomeKeydown(e){
  if(e.key === "Escape"){ closePopovers(); return; }
  if(e.key !== "Enter" && e.key !== " ") return;
  const el = e.target.closest && e.target.closest('[data-home-act][role="button"]');
  if(!el || el.tagName === "BUTTON") return;
  e.preventDefault();
  el.click();
}

function onViewportChange(e){
  if(e && e.type === "scroll" && e.target && e.target.closest && e.target.closest(".cat-more-menu, .sort-menu-popover")) return;
  document.querySelectorAll(".cat-more.open").forEach((el) => {
    el.classList.remove("open");
    const trigger = el.querySelector("[aria-expanded]");
    if(trigger) trigger.setAttribute("aria-expanded", "false");
  });
}

if(typeof document !== "undefined" && !window.__homeDelegationBound){
  window.__homeDelegationBound = true;
  document.addEventListener("click", onHomeClick);
  document.addEventListener("keydown", onHomeKeydown);
  window.addEventListener("resize", onViewportChange, { passive: true });
  document.addEventListener("scroll", onViewportChange, { passive: true, capture: true });
}

export function renderSortControl(currentSort = "none", onSelectFn = "setHomeSort"){
  const activeOpt = SORT_OPTIONS.find(s => s.key === currentSort) || SORT_OPTIONS[0];
  const fn = GLOBAL_NAME.test(onSelectFn) ? onSelectFn : "setHomeSort";
  return `
    <div class="sort-control-wrap">
      <button type="button" class="sort-trigger-btn ${currentSort !== "none" ? "is-sorted" : ""}" data-home-act="sortToggle" aria-haspopup="menu" aria-expanded="false" aria-label="Sort videos: ${esc(activeOpt.label)}">
        <svg class="ico sort-ico" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>
        <span class="sort-btn-label">${esc(activeOpt.label)}</span>
        <span class="sort-btn-arrow" aria-hidden="true">▾</span>
      </button>
      <div class="sort-menu-popover" role="menu">
        <div class="sort-menu-header">Sort By</div>
        ${SORT_OPTIONS.map(s => {
          const isSelected = currentSort === s.key;
          return `
            <button type="button" role="menuitemradio" aria-checked="${isSelected}" class="sort-menu-item ${isSelected ? "active" : ""}" data-home-act="sort" data-sort-fn="${fn}" data-key="${s.key}">
              <span class="sort-item-icon" aria-hidden="true">${s.icon}</span>
              <span class="sort-item-title">${esc(s.label)}</span>
              ${isSelected ? '<span class="sort-item-check" aria-hidden="true">✓</span>' : ""}
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

  closePopovers();
  if (wasOpen || !menu) return;

  wrap.classList.add("open");
  btn.setAttribute("aria-expanded", "true");
  const rect = btn.getBoundingClientRect();
  const s = menu.style;
  s.position = "fixed";
  s.zIndex = "99999";
  if (window.innerWidth <= 760) {
    s.left = "12px";
    s.right = "12px";
    s.top = Math.max(10, Math.min(rect.bottom + 8, window.innerHeight - 340)) + "px";
    s.width = "auto";
    s.maxHeight = "60vh";
  } else {
    const menuWidth = 360;
    s.right = "";
    s.top = (rect.bottom + 6) + "px";
    s.left = Math.min(rect.left, Math.max(16, window.innerWidth - menuWidth - 16)) + "px";
    s.width = menuWidth + "px";
    s.maxHeight = "400px";
  }
}

function homeFilterBar(){
  const activeCat = vstate.homeCategory;
  const customCat = activeCat && !POPULAR_QUICK_CATS.includes(activeCat);
  const showSort = vstate.homeFilter !== "pornstars";
  return `<div class="home-toolbar-v2">
    <div class="home-chips-strip mchrome-scroll">
      ${HOME_FILTERS.map(([key, label]) => {
        const on = vstate.homeFilter === key && !activeCat;
        const act = key === "pornstars" ? "" : ` data-home-act="filter" data-key="${key}"`;
        return `<a href="${esc(homeFilterHref(key))}" class="filter-pill ${on ? "active" : ""}"${on ? ' aria-current="page"' : ""}${act}>${label}</a>`;
      }).join("")}
      <span class="filter-divider" aria-hidden="true"></span>
      ${POPULAR_QUICK_CATS.map(c => {
        const on = activeCat === c;
        return `<a href="${esc(browsePath(c))}" class="filter-pill ${on ? "active" : ""}"${on ? ' aria-current="page"' : ""}>${esc(c)}</a>`;
      }).join("")}
      <span class="cat-more">
        <button type="button" class="filter-pill cat-picker-btn ${customCat ? "active" : ""}" data-home-act="catMenu" aria-haspopup="true" aria-expanded="false">
          <span class="cat-pill-label">${customCat ? esc(activeCat) : `More Categories (${CATEGORIES.length})`}</span>
          <span class="cat-pill-caret" aria-hidden="true">▾</span>
        </button>
        <div class="cat-more-menu">
          <div class="cat-more-menu-header">All Categories (${CATEGORIES.length})</div>
          <div class="cat-more-grid">
            ${CATEGORIES.map(c => `<a href="${esc(browsePath(c))}" class="cat-more-item ${activeCat === c ? "active" : ""}">${esc(c)}</a>`).join("")}
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

function loadMoreButton(label = "Load more"){
  return `<button type="button" class="btn ghost" style="margin:16px auto;display:block" data-home-act="loadMore">${label}</button>`;
}

function videoGrid(list){
  return `<div class="video-list">${list.map(v => videoCard(v, { layout: "row" })).join("")}</div>`;
}

function movieCard(m){
  return videoCard(m.poster, { onClick: `openMovie('${jsq(m.title)}')`, layout: "row" });
}

function pornstarsFilterBody(){
  const stars = pornstars().slice().sort((a, b) => (b.subs || 0) - (a.subs || 0));
  if(!stars.length){
    return emptyState("No pornstars yet. Check back soon.", POPULAR_TAGS.slice(0, 6), { emoji: "⭐" });
  }
  const counts = new Map();
  for(const v of DATA.videos){
    if(!visible(v)) continue;
    const c = counts.get(v.creator) || counts.set(v.creator, { all: 0, shorts: 0 }).get(v.creator);
    c.all++;
    if(v.orientation === "vertical") c.shorts++;
  }
  return `
    <h2 class="row-heading">Pornstars <span class="small">(${stars.length})</span></h2>
    <p class="sub" style="margin-top:-4px">Intro + Shorts packs — tap a star to open their page</p>
    <div class="pornstars-grid">
      ${stars.map(c => {
        const { all = 0, shorts = 0 } = counts.get(c.id) || {};
        const av = c.avatar
          ? `<img src="${esc(mediaUrl(c.avatar))}" alt="" loading="lazy" decoding="async"/>`
          : `<span>${esc((c.name || "?")[0])}</span>`;
        const tags = (c.tags || []).slice(0, 4).map(t => `<span class="tag-chip">#${esc(t)}</span>`).join("");
        return `
        <button type="button" class="pornstar-card" data-home-act="creator" data-id="${esc(c.id)}">
          <div class="pornstar-card-avatar${c.avatar ? " has-img" : ""}">${av}</div>
          <div class="pornstar-card-body">
            <div class="pornstar-card-name">${esc(c.name)} ${c.verified ? '<span class="verified">✓</span>' : ""}</div>
            <div class="small">${all} video${all !== 1 ? "s" : ""}${shorts ? ` · ${shorts} Shorts` : ""}</div>
            ${tags ? `<div class="tag-chips" style="margin-top:8px">${tags}</div>` : ""}
          </div>
        </button>`;
      }).join("")}
    </div>`;
}

function moviesRow(allMovies){
  const more = allMovies.length > ROW_MAX
    ? `<a class="row-heading-link" href="${esc(homeFilterHref("movies"))}" data-home-act="filter" data-key="movies">See all →</a>`
    : "";
  return `
    <div class="row-heading-wrap">
      <h2 class="row-heading">Movies</h2>
      ${more}
    </div>
    <div class="row-scroll">${allMovies.slice(0, ROW_MAX).map(movieCard).join("")}</div>`;
}

function creatorCircle(c, extraClass = "", avatarHtml = null){
  const av = avatarHtml ?? esc((c.name || "?")[0]);
  return `
      <div class="creator-circle${extraClass}" role="button" tabindex="0" data-home-act="creator" data-id="${esc(c.id)}" title="${esc(c.name)}" aria-label="${esc(c.name)}">
        <div class="creator-circle-avatar${c.avatar && avatarHtml ? " has-img" : ""}">${av}</div>
        <div class="creator-circle-name">${esc(c.name)}</div>
      </div>`;
}

function topCreatorsRow(){
  const top = DATA.creators.filter(c => c.kind !== "pornstar").sort((a, b) => (b.subs || 0) - (a.subs || 0)).slice(0, 8);
  if(!top.length) return "";
  return `<h2 class="row-heading">Top Creators</h2><div class="row-scroll creator-circle-row">
    ${top.map(c => creatorCircle(c)).join("")}
  </div>`;
}

function pornstarsRow(){
  const stars = pornstars().slice().sort((a, b) => (b.subs || 0) - (a.subs || 0)).slice(0, 12);
  if(!stars.length) return "";
  return `
    <div class="row-heading-wrap">
      <h2 class="row-heading">Pornstars</h2>
      <button type="button" class="row-heading-link" data-home-act="go" data-page="pornstars">See all →</button>
    </div>
    <div class="row-scroll creator-circle-row pornstar-circle-row">
      ${stars.map(c => creatorCircle(c, " pornstar-circle", c.avatar
        ? `<img class="creator-circle-avatar-img" src="${esc(mediaUrl(c.avatar))}" alt="" loading="lazy" decoding="async"/>`
        : null)).join("")}
    </div>`;
}

function prefersStillHero(){
  try { if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true; } catch (_) {}
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return !!(c && (c.saveData || c.effectiveType === "slow-2g" || c.effectiveType === "2g"));
}

// Always the real video (the ffmpeg thumb is blurry at billboard size); thumb is only the instant-paint poster.
function homeHero(hero){
  const heroIsVideo = hero.src && !ytId(hero.src);
  const laterOn = vstate.later.includes(hero.id);
  const poster = hero.thumb ? ` poster="${esc(mediaUrl(hero.thumb))}"` : "";
  const motion = prefersStillHero() ? "" : " autoplay loop";
  const media = heroIsVideo
    ? `<video class="home-hero-img" src="${esc(mediaUrl(hero.src))}"${poster} muted${motion} playsinline preload="metadata" disablepictureinpicture aria-hidden="true"></video>`
    : (hero.thumb ? `<img class="home-hero-img" src="${esc(mediaUrl(hero.thumb))}" alt="" fetchpriority="high" loading="eager" decoding="async"/>` : "");
  let live = 0;
  for(const v of searchableVideos()) if(!v.flagged) live++;
  const title = hero.title || "";
  return `
    <section class="home-hero" aria-label="Featured video" data-hero-id="${hero.id}">
      <div class="home-hero-media">${media}</div>
      <div class="home-hero-body">
        <div class="home-hero-badge-row">
          <div class="home-hero-badge-group">
            <span class="home-hero-tag">✨ Featured Scene</span>
            <span class="home-hero-count">4K Ultra HD · ${live.toLocaleString("en-US")} Videos</span>
          </div>
          <span class="home-hero-trust-pill">🛡️ 100% Free · Synthetic Personas Only</span>
        </div>
        <h1 class="home-hero-title">${esc(title)}</h1>
        <p class="home-hero-meta">${esc(creatorName(hero.creator))} · <span class="hero-views-num" data-hero-views="${hero.id}">${fmt(displayViews(hero))} views</span>${hero.uploaded ? ` · ${esc(relativeTime(hero.uploaded))}` : ""}</p>
        <div class="home-hero-actions">
          <button type="button" class="btn home-hero-play" data-home-act="play" data-id="${hero.id}" aria-label="Play ${esc(title)}">
            <span class="play-ico" aria-hidden="true">▶</span> Play Now
          </button>
          <button type="button" class="hero-later-btn ${laterOn ? "on" : ""}" data-home-act="later" data-later-id="${hero.id}" data-id="${hero.id}" aria-pressed="${laterOn}" aria-label="${laterOn ? "Remove from Watch Later" : "Add to Watch Later"}" title="Watch Later"><svg class="ico" aria-hidden="true"><use href="#icon-save"/></svg></button>
        </div>
      </div>
    </section>`;
}

function becauseYouWatchedRow(){
  const lastId = vstate.history && vstate.history[0];
  if(lastId == null) return "";
  const seed = videoById(lastId);
  if(!seed) return "";
  const recs = relatedTo(seed, ROW_MAX + 1).filter(v => v.id !== seed.id).slice(0, ROW_MAX);
  if(recs.length < 3) return "";
  const full = seed.title || "";
  const shortTitle = full.length > 42 ? full.slice(0, 40) + "…" : full;
  const heading = `Because you watched <span class="row-reason" title="${esc(full)}">${esc(shortTitle)}</span>`;
  return rowSection(heading, recs, { layout: "row", allowHtmlTitle: true });
}

// blog/posts.js (~600 KB) only feeds this below-the-fold row: lazy-load it and swap a fixed-height slot in.
let blogMod = null;
let blogLoad = null;
function loadBlogMod(){
  return blogLoad || (blogLoad = Promise.all([import("../../blog/posts.js"), loadFullCatalog()])
    .then(([m]) => (blogMod = m))
    .catch((e) => { blogLoad = null; throw e; }));
}

function fromTheBlogRow(){
  if(!blogMod){
    loadBlogMod().then(
      () => requestAnimationFrame(() => {
        const slot = document.getElementById("homeBlogSlot");
        if(slot) slot.outerHTML = fromTheBlogRow();
      }),
      () => { const slot = document.getElementById("homeBlogSlot"); if(slot) slot.remove(); }
    );
    return `<div id="homeBlogSlot" style="min-height:190px" aria-busy="true"></div>`;
  }
  const { POSTS, postsForHub, isFeaturedPost } = blogMod;
  if(!POSTS || !POSTS.length) return "";
  const posts = postsForHub(POSTS).slice(0, 8);
  const cards = posts.map((p) => {
    const cover = postCoverThumbUrl(p);
    const pill = isFeaturedPost(p) ? "Featured" : p.category;
    return `
      <a class="blog-home-card" href="/blog/${esc(p.slug)}.html">
        <div class="blog-home-card-media">
          ${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" decoding="async" width="166" height="104"/>` : ""}
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
      <h2 class="row-heading">From the Blog</h2>
      <a class="row-heading-link" href="/blog/">See all →</a>
    </div>
    <div class="row-scroll blog-home-row">${cards}</div>`;
}

function catRow(c){
  const list = byCat(c);
  return list.length ? rowSection(c, list.slice(0, ROW_MAX), { layout: "row" }) : "";
}

function moreCategoriesBlock(cats, acts){
  if(vstate.homeExpandCats){
    return `
      ${rowSection("Highlights", highlights().slice(0, ROW_MAX), { layout: "row" })}
      ${acts.map(a => {
        const clips = clipsByAct(a);
        return clips.length ? rowSection("Act: " + a, clips.slice(0, ROW_MAX), { layout: "row" }) : "";
      }).join("")}
      ${cats.map(catRow).join("")}
      ${rowSection("Recently Uploaded", byUploadedDesc().slice(0, ROW_MAX), { layout: "row" })}
      <div class="home-more-wrap">
        <button type="button" class="btn ghost" data-home-act="expandCats" data-on="0">Show fewer rows</button>
      </div>`;
  }
  let preview = "", shown = 0;
  for(const c of cats){
    if(shown >= PRIMARY_CAT_ROWS) break;
    const row = catRow(c);
    if(row){ preview += row; shown++; }
  }
  const remaining = Math.max(0, cats.length - shown) + acts.length;
  return `
    ${preview}
    ${remaining > 0 ? `
    <div class="home-more-wrap">
      <button type="button" class="btn home-more-btn" data-home-act="expandCats" data-on="1">
        Browse more categories (+${remaining})
      </button>
    </div>` : ""}`;
}

export function homeEditorialSection(){
  return `
    <section class="home-seo-editorial" aria-label="About thebestpornai">
      <div class="home-seo-editorial-card">
        <h2 class="home-seo-editorial-title">Free 4K AI Porn &amp; Uncensored Adult Streaming</h2>
        <p class="home-seo-editorial-text">
          Welcome to <strong>thebestpornai</strong>, the premier streaming destination for high-definition generative adult entertainment. Our growing library features over 7,000+ uncensored 4K AI porn scenes, full-length movies, and exclusive shorts rendered with hyper-realistic detail and 60fps fluidity. Powered by high-speed global edge infrastructure via Cloudflare R2, every video streams instantly with zero buffering and no registration or credit card required. Explore our signature character face packs featuring recurring virtual adult stars, or browse top categories including Blonde, Latina, MILF, POV, and House Originals. All performers are 100% synthetic, ethically generated fictional personas compliant with 18+ adult standards.
        </p>
        <div class="home-seo-editorial-links">
          <a href="/categories/blonde.html" class="tag-chip">Blonde AI</a>
          <a href="/categories/latina.html" class="tag-chip">Latina AI</a>
          <a href="/categories/milf.html" class="tag-chip">MILF AI</a>
          <a href="/categories/pov.html" class="tag-chip">POV AI</a>
          <a href="/categories/big-ass.html" class="tag-chip">Big Ass</a>
          <a href="/pornstars/" class="tag-chip">AI Pornstars Index</a>
          <a href="/categories/" class="tag-chip">All Categories</a>
          <a href="/blog/" class="tag-chip">AI Blog &amp; Guides</a>
        </div>
      </div>
    </section>`;
}

function pagedGridView({ heading, list, empty, moreLabel, cardFn = null }){
  const shown = list.slice(0, vstate.limit);
  const cards = cardFn
    ? `<div class="video-list">${shown.map(cardFn).join("")}</div>`
    : videoGrid(shown);
  const html = `
    ${homeFilterBar()}
    ${shown.length ? `${heading}${cards}` : empty}
    ${list.length > vstate.limit ? loadMoreButton(moreLabel) : ""}
    ${homeEditorialSection()}
  `;
  return { html, empty: !shown.length };
}

function _renderHomeBody(){
  const pub = pubVideos();
  const hero = currentHero() || pub.find(v => v.type === "original") || pub[0];
  if(!hero) return { html: `<div class="empty">No videos available yet.</div>`, empty: true };

  const filter = vstate.homeFilter;
  const sort = vstate.homeSort;

  if(vstate.homeCategory){
    const cat = vstate.homeCategory;
    let matches = byCategoryFilter(cat);
    if(sort !== "none"){
      const matchSet = new Set(matches);
      matches = sortedVideos(sort).filter(v => matchSet.has(v));
    }
    return pagedGridView({
      heading: `<h2 class="row-heading">${esc(cat)} <span class="small">(${matches.length})</span></h2>`,
      list: matches,
      empty: `<h2 class="row-heading">${esc(cat)} <span class="small">(0)</span></h2>${emptyState(`No ${cat} videos yet.`, POPULAR_TAGS.filter(t => t !== cat).slice(0, 8))}`,
    });
  }

  if(sort !== "none"){
    const sortObj = SORT_OPTIONS.find(s => s.key === sort);
    const label = sortObj ? sortObj.label : "Sorted Videos";
    const icon = sortObj ? sortObj.icon : "⚡";
    const sorted = sortedVideos(sort);
    return pagedGridView({
      heading: `<h2 class="row-heading">${icon} ${esc(label)} <span class="small">(${sorted.length} videos)</span></h2>`,
      list: sorted,
      empty: emptyState("No videos match this sort yet.", POPULAR_TAGS.slice(0, 8), { emoji: "📭" }),
      moreLabel: "Load more videos",
    });
  }

  if(filter === "movies"){
    const allMovies = movies();
    return pagedGridView({
      heading: `<h2 class="row-heading">Movies <span class="small">(${allMovies.length})</span></h2>`,
      list: allMovies,
      cardFn: movieCard,
      empty: emptyState("No movies yet. Browse clips and scenes instead.", POPULAR_TAGS.slice(0, 6), { emoji: "🎬" }),
    });
  }
  if(filter === "scenes" || filter === "clips"){
    const isScenes = filter === "scenes";
    const list = pub.filter(v => v.level === (isScenes ? "scene" : "clip"));
    return pagedGridView({
      heading: `<h2 class="row-heading">${isScenes ? "Scenes" : "Clips"} <span class="small">(${list.length})</span></h2>`,
      list,
      empty: emptyState(isScenes ? "No scenes tagged yet." : "No clips tagged yet.", POPULAR_TAGS.slice(0, 6), { emoji: isScenes ? "🎞" : "📎" }),
    });
  }
  if(filter === "pornstars"){
    const html = `${homeFilterBar()}${pornstarsFilterBody()}${homeEditorialSection()}`;
    return { html, empty: !pornstars().length };
  }

  // ---- Default curated home ----
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
  const historySet = new Set(validHistoryIds);
  const top = trending();
  const fresh = top.filter(v => !historySet.has(v.id));
  const recommended = (fresh.length >= 6 ? fresh : top).slice(0, ROW_MAX);
  const newest = newestUploads();
  const allMovies = movies();
  const cats = DATA.categories || CATEGORIES;

  const html = `
    ${homeFilterBar()}
    ${homeHero(hero)}

    ${resolvedHistory.length ? rowSection("Continue Watching", resolvedHistory.slice(0, ROW_MAX), { layout: "row" }) : ""}
    ${becauseYouWatchedRow()}
    <h2 class="row-heading">Fresh Uploads <span class="small">(${newest.length})</span></h2>
    ${videoGrid(newest.slice(0, vstate.limit))}
    ${newest.length > vstate.limit ? loadMoreButton("Load more uploads") : ""}
    ${affiliateChoiceHtml("home")}
    ${rowSection("Recommended for you", recommended, { layout: "row" })}
    ${rowSection("Trending now", byViewsDesc().slice(0, ROW_MAX), { layout: "row" })}
    ${fromTheBlogRow()}
    ${pornstarsRow()}
    ${rowSection("House Originals", originals().slice(0, ROW_MAX), { layout: "row" })}
    ${allMovies.length ? moviesRow(allMovies) : ""}
    ${topCreatorsRow()}
    ${moreCategoriesBlock(cats, actNames())}
    ${homeEditorialSection()}
  `;
  return { html, empty: false };
}

export function renderHome() {
  return _renderHomeBody().html;
}