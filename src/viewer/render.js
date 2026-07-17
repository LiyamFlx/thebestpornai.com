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
      "description": `${v.title} by ${creatorName(v.creator)}`,
      "thumbnailUrl": v.thumb ? mediaUrl(v.thumb) : undefined,
      "uploadDate": v.uploaded,
      "duration": v.duration ? `PT${v.duration.replace(':', 'M')}S` : undefined,
      "contentUrl": v.src ? mediaUrl(v.src) : undefined,
      "interactionStatistic": [
        { "@type": "InteractionCounter", "interactionType": "https://schema.org/LikeAction", "userInteractionCount": v.likes },
        { "@type": "InteractionCounter", "interactionType": "https://schema.org/ViewAction", "userInteractionCount": v.views }
      ]
    };
  }

  script.textContent = JSON.stringify(json);
  document.head.appendChild(script);
}

/* Lazy-load video thumbnails: only fetch a thumbnail's metadata once its card
   scrolls near the viewport. Without this, ~180 <video> elements would all
   request metadata from the CDN on load and crawl the page. */
function revealThumb(el){
  if(el.dataset.src){ el.src = el.dataset.src; el.preload = "metadata"; el.removeAttribute("data-src"); }
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
  const els = document.querySelectorAll("video.lazy[data-src]");
  if(_lazyObserver){ els.forEach(el=>_lazyObserver.observe(el)); }
  else { els.forEach(revealThumb); }   // no IntersectionObserver: load eagerly
}
