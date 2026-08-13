/* Top-level render: routes vstate.page to a page renderer, then runs the
   post-render side effects (nav highlight, lazy thumbs, player gestures,
   pending hydrate, structured data). */
import { DATA, toast, creatorName, mediaUrl, fmt, ytId } from "../shared/catalog.js";
// Plain public/ path (not a bundler import) — this file is also loaded by
// the plain Node test runner (see manifest-sync.test.mjs's import chain),
// which can't resolve a Vite-style asset import for a .png file. Verified
// present at public/favicon-64.png and copied through to dist/favicon-64.png
// unhashed by Vite's static public/ passthrough (separate from
// src/shared/assets/favicon-64.png, which IS a bundler import elsewhere and
// gets a hashed asset filename — the two are intentionally different files
// serving different call sites, not duplication to clean up).
const defaultThumbUrl = "/favicon-64.png";
import { vstate } from "./state.js";
import { displayViews } from "./display-metrics.js";
import { pubVideos, trending } from "./catalog-queries.js";
import { takePendingHydrate } from "./router.js";
import { relativeTime } from "./util.js";
// takePendingFeedFocus is consumed inside attachFeedObserver (pages/feed.js)
import { hydrateWatch } from "./hydrate.js";
import { attachPlayerControlsV2 } from "./player-controls-v2.js";
import { renderHome, nextHero } from "./pages/home.js";
import { renderWatch, attachWatchHandlers } from "./pages/watch.js";
import { renderMovieDetail } from "./pages/movie.js";
import { renderCreatorPage } from "./pages/creator.js";
import { renderFeed, attachFeedObserver } from "./pages/feed.js";
import { refreshChipRows } from "./mobile-chrome.js";
import { resetGridWindow, observeSentinels, setGridAppendHook } from "./grid-window.js";
import {
  listPage, renderCategories, renderSubs, renderProfile, renderSettings,
  renderLive, renderPlaylists, renderSearch, renderLibrary, renderPornstars,
} from "./pages/misc.js";

const LIBRARY_PAGES = new Set(["library", "later", "favorites", "history", "downloads"]);

export function render(){
  const v=document.getElementById("view"); const p=vstate.page;
  if(v) v.classList.toggle("content-feed", p === "feed");
  document.querySelector(".app")?.classList.toggle("page-watch", p === "watch");
  document.querySelector(".app")?.classList.toggle("page-feed", p === "feed");
  resetGridWindow();          // drop stale windowed-grid state before rebuilding #view
  if(_lazyObserver) _lazyObserver.disconnect();   // drop phantom targets from the page we're leaving
  const map={
    home:renderHome, watch:renderWatch, categories:renderCategories, subscriptions:renderSubs,
    profile:renderProfile, settings:renderSettings, live:renderLive, playlists:renderPlaylists,
    movie:renderMovieDetail, creator:renderCreatorPage, search:renderSearch,
    feed:renderFeed, library:renderLibrary, pornstars:renderPornstars,
  };
  if(map[p]) v.innerHTML = map[p]();
  else if(p==="explore")   v.innerHTML = listPage("Explore", trending(), "");
  else if(p==="trending")  v.innerHTML = listPage("Trending", trending(), "");
  else if(p==="originals") v.innerHTML = listPage("House Originals", pubVideos().filter(x=>x.type==="original"), "");
  // Legacy page ids still render via Library hub (go() also rewrites them)
  else if(LIBRARY_PAGES.has(p)) v.innerHTML = renderLibrary();
  else v.innerHTML = renderHome();

  // Active nav: Library button stays lit for any library tab/legacy alias
  const navPage = LIBRARY_PAGES.has(p) ? "library" : p;
  document.querySelectorAll("#nav button, #bottomNav button, .mobile-drawer-nav button").forEach(b=>{
    const bp = b.dataset.page || b.dataset.nav;
    if (!bp) return;
    b.classList.toggle("active", bp === navPage || bp === p);
  });
  // Keep the topbar search box in sync with routed query (hash / tag chips).
  const searchInput = document.getElementById("searchInput");
  if(searchInput && p === "search" && document.activeElement !== searchInput){
    searchInput.value = vstate.searchQuery || "";
  }
  markToggleStates();
  lazyLoadThumbs();
  observeSentinels();         // wire lazy-append for any windowed grids on this page
  attachPlayer();
  attachPlayerControlsV2();
  attachHoverPreview();
  attachHeroRotation(p === "home");
  if (p === "feed") {
    attachFeedObserver();
  }
  if (p === "watch") {
    attachWatchHandlers();
  }

  const pending = takePendingHydrate();
  if(pending!=null) hydrateWatch(pending);

  // Deferred to next frame / idle: keeps rAF under 2ms to eliminate animation frame violations
  requestAnimationFrame(() => {
    refreshChipRows(); // recompute horizontal chip-row edge fades (mobile)
  });

  if (typeof window !== "undefined") {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => addStructuredData(), { timeout: 1500 });
    } else {
      setTimeout(() => addStructuredData(), 60);
    }
  }
}

/* Reflect the current Favorites / Watch-Later membership on every card
   quick-action button just rendered. Cards previously showed no saved state at
   all; marking them here (and patching in place on toggle — see actions.js)
   gives feedback without a full re-render on each tap. */
function markToggleStates(){
  const favs = new Set(vstate.favorites);
  const later = new Set(vstate.later);
  document.querySelectorAll("[data-fav-id]").forEach(b => {
    const on = favs.has(+b.dataset.favId);
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  document.querySelectorAll("[data-later-id]").forEach(b => {
    const on = later.has(+b.dataset.laterId);
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

/* Single query pass for the player + status/gesture wiring — attachPlayerControlsV2()
   (a separate module) still does its own lookup, but the two handlers defined
   in this file no longer each re-query .player-wrap/video.player independently. */
function attachPlayer(){
  const wrap = document.querySelector(".player-wrap");
  const video = wrap && wrap.querySelector("video.player");
  if(!wrap || !video) return;
  attachPlayerGestures(video);
  attachPlayerStatus(wrap, video);
}

/* Double-click on the player: left third rewinds 10s, right third skips 10s,
   middle toggles fullscreen. The player element is recreated on every render
   (innerHTML swap), so attaching here never stacks listeners. */
function attachPlayerGestures(activePlayer){
  activePlayer.addEventListener("dblclick", (e) => {
    e.preventDefault();
    const rect = activePlayer.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
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
      // Fullscreen the .player-container-v2 wrapper, not the bare .player-wrap —
      // it's the element player-controls-v2.js's toggleFullscreenV2 also
      // targets, and the one style.css has explicit :fullscreen sizing rules
      // for (so the custom overlay controls stay usable and correctly laid
      // out in fullscreen regardless of which control triggered it).
      const target = activePlayer.closest(".player-container-v2") || activePlayer.closest(".player-wrap") || activePlayer;
      if(!document.fullscreenElement){
        target.requestFullscreen?.().catch(()=>{});
      } else {
        document.exitFullscreen?.().catch(()=>{});
      }
    }
  });
}

/* Loading/error feedback for the main player: two separate overlay elements
   in playerEmbed()'s template (shared/ui.js) — .player-status-loading (the
   spinner) and .player-status-error (message + Retry button), not one
   shared node with a toggled class. querySelector(".player-status") used to
   match only the FIRST of these (the loading div, since it comes first in
   the template) — showError() then toggled classes/display on the loading
   div while the real error div (and its .player-error-msg/Retry button,
   which querySelector never found since they're a sibling, not a
   descendant) stayed hidden. Net effect: a genuine playback error/stalled
   load never actually showed "This video couldn't be loaded" or a working
   Retry button. Selecting both elements explicitly fixes it. */
function attachPlayerStatus(wrap, activePlayer){
  const loading = wrap.querySelector(".player-status-loading");
  const error = wrap.querySelector(".player-status-error");
  if(!loading && !error) return;

  const showLoading = () => {
    if(loading) loading.style.display = "flex";
    if(error) error.style.display = "none";
  };
  const hideLoading = () => { if(loading) loading.style.display = "none"; };
  const showError = () => {
    if(loading) loading.style.display = "none";
    if(error) error.style.display = "flex";
  };

  activePlayer.addEventListener("loadstart", showLoading);
  activePlayer.addEventListener("waiting", showLoading);
  activePlayer.addEventListener("playing", hideLoading);
  activePlayer.addEventListener("canplay", hideLoading);
  activePlayer.addEventListener("error", showError);
  // A stall under 4s is normal buffering; only surface it as an error if it hangs.
  let stallTimer = null;
  activePlayer.addEventListener("stalled", () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(showError, 4000);
  });
  activePlayer.addEventListener("playing", () => clearTimeout(stallTimer));
}

/* Hover-to-preview: on desktop, hovering a card plays its muted thumb/preview
   video from the start; leaving pauses and resets. Uses event delegation on
   #view so it survives innerHTML swaps and never stacks listeners. No-op on
   touch devices (no hover). */
let _hoverBound = false;
function attachHoverPreview(){
  if(_hoverBound) return;                 // delegate once, survives re-renders
  if(window.matchMedia && window.matchMedia("(hover: none)").matches) return;  // touch: skip
  const view = document.getElementById("view");
  if(!view) return;
  _hoverBound = true;
  const play = (card)=>{
    const vid = card.querySelector("video.thumb-preview, video.thumb-video");
    if(!vid) return;
    if(vid.dataset.src){ vid.src = vid.dataset.src; vid.removeAttribute("data-src"); vid.classList.remove("lazy"); }
    vid.currentTime = 0;
    const p = vid.play(); if(p && p.catch) p.catch(()=>{});
    card.classList.add("previewing");
  };
  const stop = (card)=>{
    const vid = card.querySelector("video.thumb-preview, video.thumb-video");
    if(vid){ try{ vid.pause(); vid.currentTime = 0; }catch(_){}}
    card.classList.remove("previewing");
  };
  view.addEventListener("mouseover", e=>{ const c=e.target.closest(".card"); if(c && !c.contains(e.relatedTarget)) play(c); });
  view.addEventListener("mouseout",  e=>{ const c=e.target.closest(".card"); if(c && !c.contains(e.relatedTarget)) stop(c); });
}

/* Home hero rotation: cycles the billboard through its pool of catalog
   videos on a timer, patching the existing DOM in place (swap video src,
   title, meta, action buttons) rather than a full re-render — a full
   render() would reset scroll position and tear down every other row's
   lazy-load state for the sake of one element. Timer is cleared on every
   render() call (page nav, filter/sort change, catalog merge) so it never
   stacks or outlives the .home-hero element it targets. */
const HERO_ROTATE_MS = 7000;
const HERO_FADE_MS = 260;
let _heroRotateTimer = null;
function attachHeroRotation(isHomePage){
  clearInterval(_heroRotateTimer);
  _heroRotateTimer = null;
  if(!isHomePage) return;
  const section = document.querySelector(".home-hero[data-hero-id]");
  if(!section) return;   // filtered/sorted home views don't render a hero
  _heroRotateTimer = setInterval(() => {
    const hero = nextHero();
    if(!hero) return;
    section.classList.add("hero-fading");
    setTimeout(() => {
      section.dataset.heroId = hero.id;
      const media = section.querySelector(".home-hero-media");
      if(media){
        const heroIsVideo = hero.src && !ytId(hero.src);
        media.innerHTML = heroIsVideo
          ? `<video class="home-hero-img" src="${mediaUrl(hero.src)}" ${hero.thumb ? `poster="${mediaUrl(hero.thumb)}"` : ''} muted autoplay loop playsinline preload="auto"></video>`
          : (hero.thumb ? `<img class="home-hero-img" src="${mediaUrl(hero.thumb)}" alt="" loading="eager" decoding="async"/>` : '');
      }
      const title = section.querySelector(".home-hero-title");
      if(title) title.textContent = hero.title;
      const meta = section.querySelector(".home-hero-meta");
      if(meta) meta.textContent = `${creatorName(hero.creator)} · ${fmt(displayViews(hero))} views${hero.uploaded ? ` · ${relativeTime(hero.uploaded)}` : ''}`;
      const playBtn = section.querySelector(".home-hero-play");
      if(playBtn) playBtn.setAttribute("onclick", `openVideo(${hero.id})`);
      const laterBtn = section.querySelector(".hero-later-btn");
      if(laterBtn){
        const laterOn = vstate.later.includes(hero.id);
        laterBtn.dataset.laterId = hero.id;
        laterBtn.setAttribute("onclick", `toggleLater(${hero.id})`);
        laterBtn.classList.toggle("on", laterOn);
        laterBtn.setAttribute("aria-pressed", laterOn ? "true" : "false");
      }
      section.classList.remove("hero-fading");
    }, HERO_FADE_MS);
  }, HERO_ROTATE_MS);
}

/* "YYYY-MM-DD" -> full ISO 8601 datetime with timezone, e.g.
   "2026-07-04" -> "2026-07-04T00:00:00Z". Google's structured-data validator
   flags a bare date as both an invalid datetime and missing a timezone. */
function isoDate(d){
  if(!d || typeof d !== "string") return undefined;
  if(/^\d{4}-\d{2}-\d{2}$/.test(d)) return d + "T00:00:00Z";
  return d;   // already a full datetime (or unparseable) — pass through as-is
}

/* "M:SS" (or "H:MM:SS") -> ISO 8601 duration, e.g. "0:10" -> "PT10S",
   "2:05" -> "PT2M5S", "1:02:03" -> "PT1H2M3S". Omits zero-value components
   instead of emitting misleading "PT0M10S". Returns undefined for missing/
   unparseable input so the caller can drop the field rather than emit
   invalid markup. */
function isoDuration(d){
  if(!d || typeof d !== "string") return undefined;
  const parts = d.split(":").map(n => parseInt(n, 10));
  if(parts.some(isNaN) || !parts.length) return undefined;
  let h = 0, m = 0, s = 0;
  if(parts.length === 3) [h, m, s] = parts;
  else if(parts.length === 2) [m, s] = parts;
  else [s] = parts;
  if(h === 0 && m === 0 && s === 0) return undefined;   // zero-length: nothing to report
  return "PT" + (h ? h+"H" : "") + (m ? m+"M" : "") + (s ? s+"S" : "");
}

/* Basic structured data for SEO / AI Overviews (VideoObject on watch, WebSite
   elsewhere). Injected dynamically so it reflects current video or page state. */
function addStructuredData(){
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
      "description": v.desc || `${v.title} by ${creatorName(v.creator)}`,
      // schema.org VideoObject requires thumbnailUrl — never omit it even
      // when a video has no generated poster yet (falls back to a site image
      // rather than dropping the field, which Search Console flags as an error).
      "thumbnailUrl": v.thumb ? mediaUrl(v.thumb) : new URL(defaultThumbUrl, location.origin).href,
      "uploadDate": isoDate(v.uploaded),
      "duration": isoDuration(v.duration),
      "contentUrl": v.src ? mediaUrl(v.src) : undefined,
      "genre": v.category,
      "keywords": (v.tags || []).join(", ") || undefined,
      "interactionStatistic": [
        { "@type": "InteractionCounter", "interactionType": "https://schema.org/LikeAction", "userInteractionCount": v.likes },
        { "@type": "InteractionCounter", "interactionType": "https://schema.org/ViewAction", "userInteractionCount": displayViews(v) }
      ]
    };
  } else if (vstate.page === "home") {
    // ItemList of top videos so crawlers/AI see the catalog, not an empty shell.
    const top = trending().slice(0, 20);
    json = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "thebestpornai — trending videos",
      "url": "https://www.thebestpornai.com/",
      "numberOfItems": top.length,
      "itemListElement": top.map((v, idx) => ({
        "@type": "ListItem",
        "position": idx + 1,
        "item": {
          "@type": "VideoObject",
          "name": v.title,
          "description": v.desc || `${v.title} by ${creatorName(v.creator)}`,
          "thumbnailUrl": v.thumb ? mediaUrl(v.thumb) : new URL(defaultThumbUrl, location.origin).href,
          "uploadDate": isoDate(v.uploaded),
          "duration": isoDuration(v.duration),
          "contentUrl": v.src ? mediaUrl(v.src) : undefined,
          "url": "https://www.thebestpornai.com/#video/" + v.id,
        }
      }))
    };
  }

  script.textContent = JSON.stringify(json);
  document.head.appendChild(script);
}

/* Lazy-load video thumbnails: only fetch a thumbnail's metadata once its card
   scrolls near the viewport. Only targets .thumb-video (cards without a JPEG
   poster) — hover preview videos (.thumb-preview) are loaded on hover. */
function revealThumb(el){
  if(!el || !el.dataset.src) return;
  const src = el.dataset.src;
  el.removeAttribute("data-src");
  el.classList.remove("lazy");
  el.preload = "metadata";

  let fallbackTimer = null;
  const seekFrame = () => {
    clearTimeout(fallbackTimer);   // metadata/canplay already fired — the 2.5s fallback is now moot
    try {
      if(el.currentTime === 0) {
        el.currentTime = Math.min(1, (el.duration || 2) * 0.1);
      }
    } catch(_){}
  };

  if(el.readyState >= 1){
    seekFrame();
  } else {
    el.addEventListener("loadedmetadata", seekFrame, { once: true });
    el.addEventListener("canplay", seekFrame, { once: true });
    fallbackTimer = setTimeout(seekFrame, 2500);
  }

  el.src = src;
  try { el.load(); } catch(_){}
}

/* Asymmetric margin: generous vertical lookahead for the scrolling grid pages,
   tighter horizontal so off-screen cards in `.row-scroll` rows aren't all
   fetched at once on the home feed. */
const _lazyObserver = (typeof window !== "undefined" && "IntersectionObserver" in window)
  ? new IntersectionObserver((entries, obs)=>{
      entries.forEach(e=>{
        if(!e.isIntersecting) return;
        revealThumb(e.target);
        obs.unobserve(e.target);
      });
    }, { rootMargin: "250px 80px" })
  : null;

function lazyLoadThumbs(){
  // Targets ONLY .thumb-video.lazy (not .thumb-preview)
  const els = [...document.querySelectorAll("video.thumb-video.lazy[data-src]")];
  // Eager-load the first screenful immediately so the grid is never blank; lazy
  // the rest. ~8 covers what's actually above the fold on a phone.
  const eager = _lazyObserver ? 8 : els.length;
  els.forEach((el, i) => {
    if(i < eager){ revealThumb(el); }
    else { _lazyObserver.observe(el); }
  });
}

/* When a windowed grid appends its next batch, wire the new cards up the same
   way a fresh render would: observe their lazy thumbnails and reflect saved
   (fav / watch-later) state. Registered once; grid-window.js invokes it. */
setGridAppendHook((added) => {
  const favs = new Set(vstate.favorites);
  const later = new Set(vstate.later);
  for(const node of added){
    if(!node || node.nodeType !== 1) continue;
    node.querySelectorAll("video.thumb-video.lazy[data-src]").forEach(el => {
      if(_lazyObserver) _lazyObserver.observe(el); else revealThumb(el);
    });
    node.querySelectorAll("[data-fav-id]").forEach(b => {
      const on = favs.has(+b.dataset.favId);
      b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    node.querySelectorAll("[data-later-id]").forEach(b => {
      const on = later.has(+b.dataset.laterId);
      b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
});

/* Event delegation on document: handles all cards, chips, and quick-actions */
if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (!action) return;

    if (action === "open-video") {
      const id = target.dataset.videoId;
      if (id) {
        e.preventDefault();
        window.openVideo?.(Number(id));
      }
    } else if (action === "toggle-fav") {
      const id = target.dataset.videoId;
      if (id) {
        e.stopPropagation();
        e.preventDefault();
        window.toggleFav?.(Number(id));
      }
    } else if (action === "toggle-later") {
      const id = target.dataset.videoId;
      if (id) {
        e.stopPropagation();
        e.preventDefault();
        window.toggleLater?.(Number(id));
      }
    } else if (action === "share-video") {
      const id = target.dataset.videoId;
      if (id) {
        e.stopPropagation();
        e.preventDefault();
        window.shareVideo?.(Number(id));
      }
    } else if (action === "search-tag") {
      const tag = target.dataset.tag;
      if (tag) {
        e.stopPropagation();
        e.preventDefault();
        window.searchTag?.(tag);
      }
    } else if (action === "open-creator") {
      const id = target.dataset.creatorId;
      if (id) {
        e.preventDefault();
        window.openCreator?.(id);
      }
    } else if (action === "set-home-category") {
      const cat = target.dataset.category;
      if (cat) {
        e.preventDefault();
        window.setHomeCategory?.(cat);
      }
    }
  });
}