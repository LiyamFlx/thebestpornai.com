/* ---- URL hash routing: shareable/bookmarkable per-video URLs ----
   Owns the hash <-> vstate.page mapping and the pending-hydrate handoff for
   the direct-link/refresh path (applyHash -> render -> hydrateWatch). */
import { DATA, toast } from "../shared/catalog.js";
import { vstate, pushHistory } from "./state.js";
import { jsdec } from "./util.js";
import { visible } from "./catalog-queries.js";
import { PORNSTARS_PATH, categoryPagePath } from "../shared/public-routes.js";

let _suppressHash = false;
let _pendingHydrate = null;   // video id to hydrate after the next render
let _pendingFeedFocus = null; // vertical video id to scroll-to after feed render
let _savedScroll = null;      // {y, viewTop, page, hash} captured just before opening a video
// Initial page load only runs applyHash() against the small SEED catalog
// (see catalog.js) — a #video/N id that's real but outside the seed must not
// be reported as "not found" until the full catalog has actually loaded.
let _catalogReady = false;
export function markCatalogReady(){ _catalogReady = true; }

export function scrollToTop(){
  // On desktop layout #view (.content) is its own scroll container (.app is
  // height:100vh), so window.scrollTo alone is a no-op there; on mobile
  // .app is height:auto and the window itself scrolls. Reset both.
  window.scrollTo(0, 0);
  const view = document.getElementById("view");
  if(view) view.scrollTop = 0;
}

/* Remember where the user was browsing (page, hash, scroll offset) so
   closing the watch page (Esc, close button) can put them back on the same
   card instead of always landing on Home/top. */
export function saveScrollPosition(){
  if(vstate.page === "watch") return; // already mid-watch (e.g. up-next) — keep the original spot
  const view = document.getElementById("view");
  _savedScroll = {
    y: window.scrollY,
    viewTop: view ? view.scrollTop : 0,
    page: vstate.page,
    hash: location.hash,
  };
}

export function takeSavedReturn(){
  const s = _savedScroll;
  _savedScroll = null;
  return s;
}

/* Update the URL hash. `replace:true` uses history.replaceState so live search
   typing does not push a history entry per keystroke (Back would be unusable). */
export function setHash(h, opts = {}){
  _suppressHash = true;
  const next = h ? ("#" + h) : "";
  if(opts.replace){
    try {
      history.replaceState(null, "", location.pathname + location.search + next);
    } catch(_){
      location.hash = next;
    }
  } else {
    location.hash = next;
  }
  setTimeout(()=>_suppressHash=false, 0);
}

/* Accept legacy / external links that use ?video=N (blog CTAs used this before
   hash routing was the only path). Promote to #video/N so the rest of the
   router + share URLs stay consistent. Also promotes ?shorts=N / ?feed=N →
   #shorts/N for shareable Shorts deep links (IG-reel style). */
export function promoteVideoQuery(){
  try {
    const params = new URLSearchParams(location.search);
    const shortsQ = params.get("shorts") || params.get("feed");
    const videoQ = params.get("video");
    // Only rewrite when there's no explicit hash yet (don't clobber deep links).
    if(location.hash && location.hash !== "#") return;
    const url = new URL(location.href);
    if(shortsQ){
      const id = Number(shortsQ);
      if(!Number.isFinite(id)) return;
      url.searchParams.delete("shorts");
      url.searchParams.delete("feed");
      url.hash = "shorts/" + id;
      history.replaceState(null, "", url.pathname + url.search + url.hash);
      return;
    }
    if(!videoQ) return;
    const id = Number(videoQ);
    if(!Number.isFinite(id)) return;
    url.searchParams.delete("video");
    url.hash = "video/" + id;
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  } catch(_){}
}

export function applyHash(){
  const h=(location.hash||"").replace(/^#/,"");
  const m=h.match(/^video\/(\d+)$/);
  if(m){
    const vid=DATA.videos.find(v=>v.id===+m[1]);
    // Same visible() gate as openVideo() (actions.js) — a #video/N hash to a
    // known private/pending id must not be directly openable just because
    // the numeric id leaked (e.g. shared before moderation, or guessed).
    if(vid && visible(vid)){
      // Vertical clips belong in Shorts — redirect share/watch links into the feed
      // so #video/N and #shorts/N both land on the right surface for reels.
      if(vid.orientation === "vertical"){
        vstate.page = "feed";
        vstate.feedFocusId = vid.id;
        _pendingFeedFocus = vid.id;
        setHash("shorts/" + vid.id, { replace: true });
        return;
      }
      vstate.current=vid; pushHistory(vid.id); vstate.page="watch";
      vstate.feedFocusId = null;
      _pendingHydrate=vid.id;
      return;
    }
    if(!_catalogReady){
      // Full catalog hasn't loaded yet — this id may still turn out to be
      // valid (it's just outside the small initial seed). Leave the hash
      // alone; loadFullCatalog()'s completion handler re-runs applyHash().
      return;
    }
    // Unknown/private id, and the full catalog is loaded — this really
    // doesn't exist. Don't silently fall through to whatever vstate.page was
    // previously — land on Home explicitly and say why, instead of a
    // broken-looking blank/random result.
    setHash("", { replace: true });
    vstate.page = "home";
    vstate.feedFocusId = null;
    setTimeout(() => toast("That video isn't available."), 0);
    return;
  }

  /* Shorts / vertical feed deep links — IG-reel style:
     #shorts/123  (canonical share form)
     #feed/123    (alias)
     #shorts or #feed opens the feed without a pinned clip */
  const mshort = h.match(/^(?:shorts|feed)\/(\d+)$/);
  if(mshort){
    const id = +mshort[1];
    const vid = DATA.videos.find(v => v.id === id);
    if(vid && visible(vid) && vid.orientation === "vertical"){
      vstate.page = "feed";
      vstate.feedFocusId = id;
      _pendingFeedFocus = id;
      // Normalize alias #feed/N → #shorts/N for consistent share URLs
      if(h.startsWith("feed/")) setHash("shorts/" + id, { replace: true });
      return;
    }
    if(vid && visible(vid) && vid.orientation !== "vertical"){
      // Shared as shorts but it's a landscape clip — open the watch page instead
      vstate.current = vid;
      pushHistory(vid.id);
      vstate.page = "watch";
      vstate.feedFocusId = null;
      _pendingHydrate = vid.id;
      setHash("video/" + id, { replace: true });
      return;
    }
    if(!_catalogReady) return;
    setHash("shorts", { replace: true });
    vstate.page = "feed";
    vstate.feedFocusId = null;
    setTimeout(() => toast("That Short isn't available."), 0);
    return;
  }
  if(h === "shorts" || h === "feed" || h === "shorts/" || h === "feed/"){
    vstate.page = "feed";
    vstate.feedFocusId = null;
    _pendingFeedFocus = null;
    return;
  }

  const mm=h.match(/^movie\/(.+)$/);
  if(mm){ vstate.currentMovieTitle=jsdec(mm[1]); vstate.page="movie"; vstate.feedFocusId = null; return; }
  const mc=h.match(/^creator\/(.+)$/);
  if(mc){ vstate.creatorId=jsdec(mc[1]); vstate.page="creator"; vstate.feedFocusId = null; return; }
  // Alias: #pornstar/<id> → same as #creator/<id>
  const mps=h.match(/^pornstar\/(.+)$/);
  if(mps){ vstate.creatorId=jsdec(mps[1]); vstate.page="creator"; vstate.feedFocusId = null; return; }
  if(h === "pornstars" || h === "pornstar"){
    location.replace(PORNSTARS_PATH);
    return;
  }
  if(h === "movies" || h === "scenes" || h === "clips"){
    vstate.page = "home";
    vstate.homeFilter = h;
    vstate.homeCategory = "";
    vstate.feedFocusId = null;
    return;
  }
  // Search hub (#search) or results (#search/<query>)
  if(h === "search" || h === "search/"){
    vstate.page = "search";
    vstate.searchQuery = "";
    vstate.feedFocusId = null;
    return;
  }
  const ms=h.match(/^search\/(.+)$/);
  if(ms){ vstate.searchQuery=jsdec(ms[1]); vstate.page="search"; vstate.feedFocusId = null; return; }
  const mbrowse=h.match(/^browse\/(.+)$/);
  if(mbrowse){
    vstate.homeCategory = jsdec(mbrowse[1]);
    vstate.homeFilter = "all";
    vstate.page = "home";
    vstate.feedFocusId = null;
    return;
  }
  const mcat=h.match(/^category\/(.+)$/);
  if(mcat){
    const name = jsdec(mcat[1]);
    const landing = categoryPagePath(name);
    if(landing){
      location.replace(landing);
      return;
    }
    vstate.homeCategory = name;
    vstate.homeFilter = "all";
    vstate.page = "home";
    vstate.feedFocusId = null;
    return;
  }
  // Library hub: #library or #library/later|favorites|history|downloads
  const mlib=h.match(/^library(?:\/(later|favorites|history|downloads))?$/);
  if(mlib){
    vstate.page = "library";
    vstate.libraryTab = mlib[1] || vstate.libraryTab || "later";
    vstate.feedFocusId = null;
    return;
  }
  // Unknown #library/... (typos, trailing slash) still open Library — never fall through to Home
  if(h === "library" || h.startsWith("library/")){
    vstate.page = "library";
    vstate.libraryTab = vstate.libraryTab || "later";
    vstate.feedFocusId = null;
    return;
  }
  // Legacy deep links still land in Library with the right tab
  if(h==="later"||h==="favorites"||h==="history"||h==="downloads"){
    vstate.page = "library";
    vstate.libraryTab = h;
    vstate.feedFocusId = null;
    return;
  }
  // Bare page names (#home, #explore, …) — clear shorts pin
  if(h !== "feed" && h !== "shorts") vstate.feedFocusId = null;
  vstate.page = h || "home";
}

/* render() consumes this once per render — returns the id then clears it. */
export function takePendingHydrate(){
  const id = _pendingHydrate;
  _pendingHydrate = null;
  return id;
}

/* Shorts deep-link target — consumed after feed DOM is built. */
export function takePendingFeedFocus(){
  const id = _pendingFeedFocus;
  _pendingFeedFocus = null;
  return id;
}

/* Registered from main.js so this module stays side-effect-free on import. */
export function initRouter(onChange){
  window.addEventListener("hashchange", ()=>{
    if(_suppressHash) return;
    applyHash();
    onChange();
    scrollToTop();   // back/forward: land at the top of the restored page
  });
}
