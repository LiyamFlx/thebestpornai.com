/* Top-level render: routes vstate.page to a page renderer, then runs the
   post-render side effects (nav highlight, lazy thumbs, player gestures,
   pending hydrate, structured data). */
import { DATA, toast, creatorName, mediaUrl } from "../shared/catalog.js";
import { vstate } from "./state.js";
import { pubVideos, trending } from "./catalog-queries.js";
import { takePendingHydrate } from "./router.js";
import { hydrateWatch } from "./hydrate.js";
import { renderHome } from "./pages/home.js";
import { renderWatch } from "./pages/watch.js";
import { renderMovieDetail } from "./pages/movie.js";
import { renderCreatorPage } from "./pages/creator.js";
import {
  listPage, renderCategories, renderSubs, renderProfile, renderSettings,
  renderLive, renderPlaylists, renderSearch,
} from "./pages/misc.js";

export function render(){
  const v=document.getElementById("view"); const p=vstate.page;
  const map={
    home:renderHome, watch:renderWatch, categories:renderCategories, subscriptions:renderSubs,
    profile:renderProfile, settings:renderSettings, live:renderLive, playlists:renderPlaylists,
    movie:renderMovieDetail, creator:renderCreatorPage, search:renderSearch,
  };
  if(map[p]) v.innerHTML = map[p]();
  else if(p==="explore")   v.innerHTML = listPage("Explore", trending(), "");
  else if(p==="trending")  v.innerHTML = listPage("Trending", trending(), "");
  else if(p==="originals") v.innerHTML = listPage("House Originals", pubVideos().filter(x=>x.type==="original"), "");
  else if(p==="favorites") v.innerHTML = listPage("Favorites", DATA.videos.filter(x=>vstate.favorites.includes(x.id)), "Tap ★ on any video to save it here.");
  else if(p==="later")     v.innerHTML = listPage("Watch Later", DATA.videos.filter(x=>vstate.later.includes(x.id)), "Nothing saved yet.");
  else if(p==="history")   v.innerHTML = listPage("History", vstate.history.map(id=>DATA.videos.find(x=>x.id===id)).filter(Boolean), "No watch history yet.");
  else if(p==="downloads") v.innerHTML = listPage("Downloads", DATA.videos.filter(x=>vstate.downloads.includes(x.id)), "No downloads yet.");
  else v.innerHTML = renderHome();

  document.querySelectorAll("#nav button, #bottomNav button").forEach(b=>b.classList.toggle("active", b.dataset.page===p));
  lazyLoadThumbs();
  attachPlayerGestures();
  attachPlayerStatus();
  attachHoverPreview();

  const pending = takePendingHydrate();
  if(pending!=null) hydrateWatch(pending);

  // Structured data for search engines and AI (called after DOM update)
  addStructuredData();
}

/* Double-click on the player: left third rewinds 10s, right third skips 10s,
   middle toggles fullscreen. The player element is recreated on every render
   (innerHTML swap), so attaching here never stacks listeners. */
function attachPlayerGestures(){
  const activePlayer = document.querySelector("video.player");
  if(!activePlayer) return;
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
      if(!document.fullscreenElement){
        activePlayer.requestFullscreen().catch(()=>{});
      } else {
        document.exitFullscreen().catch(()=>{});
      }
    }
  });
}

/* Loading/error feedback for the main player: shows a spinner while the video
   is buffering (loadstart/waiting) and swaps in an inline error + retry button
   if playback fails (error/prolonged stall). The player element is recreated
   on every render, so this re-attaches cleanly each time like the gestures above. */
function attachPlayerStatus(){
  const wrap = document.querySelector(".player-wrap");
  const activePlayer = wrap && wrap.querySelector("video.player");
  if(!wrap || !activePlayer) return;
  const loading = wrap.querySelector(".player-status-loading");
  const errorBox = wrap.querySelector(".player-status-error");
  const showLoading = () => { if(loading) loading.style.display = "flex"; if(errorBox) errorBox.style.display = "none"; };
  const hideLoading = () => { if(loading) loading.style.display = "none"; };
  const showError = () => { hideLoading(); if(errorBox) errorBox.style.display = "flex"; };

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
      "thumbnailUrl": v.thumb ? mediaUrl(v.thumb) : undefined,
      "uploadDate": v.uploaded,
      "duration": v.duration ? `PT${v.duration.replace(':', 'M')}S` : undefined,
      "contentUrl": v.src ? mediaUrl(v.src) : undefined,
      "genre": v.category,
      "keywords": (v.tags || []).join(", ") || undefined,
      "interactionStatistic": [
        { "@type": "InteractionCounter", "interactionType": "https://schema.org/LikeAction", "userInteractionCount": v.likes },
        { "@type": "InteractionCounter", "interactionType": "https://schema.org/ViewAction", "userInteractionCount": v.views }
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
          "thumbnailUrl": v.thumb ? mediaUrl(v.thumb) : undefined,
          "uploadDate": v.uploaded,
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
   scrolls near the viewport. Without this, ~180 <video> elements would all
   request metadata from the CDN on load and crawl the page. */
function revealThumb(el){
  if(el.dataset.src){
    el.preload = "metadata";
    el.src = el.dataset.src;            // src includes #t=1 → seeks to 1s for a frame
    el.removeAttribute("data-src");
    // Force the browser to actually decode a frame so the thumb isn't blank.
    el.addEventListener("loadedmetadata", () => {
      try { if(el.currentTime === 0) el.currentTime = Math.min(1, (el.duration||2) * 0.1); } catch(_){}
    }, { once: true });
    el.load();
  }
  el.classList.remove("lazy");
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
  const els = [...document.querySelectorAll("video.lazy[data-src]")];
  // Eager-load the first screenful immediately so the grid is never blank; lazy
  // the rest. A <video> thumb stays blank until its metadata loads AND it seeks
  // to #t=1, so we force load+seek here rather than waiting on scroll.
  els.forEach((el, i) => {
    if(!_lazyObserver || i < 24){ revealThumb(el); }
    else { _lazyObserver.observe(el); }
  });
}
