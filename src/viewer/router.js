/* ---- URL hash routing: shareable/bookmarkable per-video URLs ----
   Owns the hash <-> vstate.page mapping and the pending-hydrate handoff for
   the direct-link/refresh path (applyHash -> render -> hydrateWatch). */
import { DATA, toast } from "../shared/catalog.js";
import { vstate, pushHistory } from "./state.js";
import { jsdec } from "./util.js";
import { visible } from "./catalog-queries.js";

let _suppressHash = false;
let _pendingHydrate = null;   // video id to hydrate after the next render
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
   router + share URLs stay consistent. */
export function promoteVideoQuery(){
  try {
    const q = new URLSearchParams(location.search).get("video");
    if(!q) return;
    const id = Number(q);
    if(!Number.isFinite(id)) return;
    // Only rewrite when there's no explicit hash yet (don't clobber deep links).
    if(location.hash && location.hash !== "#") return;
    const url = new URL(location.href);
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
    if(vid && visible(vid)){ vstate.current=vid; pushHistory(vid.id); vstate.page="watch"; _pendingHydrate=vid.id; return; }
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
    setTimeout(() => toast("That video isn't available."), 0);
    return;
  }
  const mm=h.match(/^movie\/(.+)$/);
  if(mm){ vstate.currentMovieTitle=jsdec(mm[1]); vstate.page="movie"; return; }
  const mc=h.match(/^creator\/(.+)$/);
  if(mc){ vstate.creatorId=jsdec(mc[1]); vstate.page="creator"; return; }
  // Search hub (#search) or results (#search/<query>)
  if(h === "search" || h === "search/"){
    vstate.page = "search";
    vstate.searchQuery = "";
    return;
  }
  const ms=h.match(/^search\/(.+)$/);
  if(ms){ vstate.searchQuery=jsdec(ms[1]); vstate.page="search"; return; }
  const mcat=h.match(/^category\/(.+)$/);
  if(mcat){ vstate.homeCategory=jsdec(mcat[1]); vstate.homeFilter="all"; vstate.page="home"; return; }
  // Library hub: #library or #library/later|favorites|history|downloads
  const mlib=h.match(/^library(?:\/(later|favorites|history|downloads))?$/);
  if(mlib){
    vstate.page = "library";
    vstate.libraryTab = mlib[1] || vstate.libraryTab || "later";
    return;
  }
  // Unknown #library/... (typos, trailing slash) still open Library — never fall through to Home
  if(h === "library" || h.startsWith("library/")){
    vstate.page = "library";
    vstate.libraryTab = vstate.libraryTab || "later";
    return;
  }
  // Legacy deep links still land in Library with the right tab
  if(h==="later"||h==="favorites"||h==="history"||h==="downloads"){
    vstate.page = "library";
    vstate.libraryTab = h;
    return;
  }
  vstate.page = h || "home";
}

/* render() consumes this once per render — returns the id then clears it. */
export function takePendingHydrate(){
  const id = _pendingHydrate;
  _pendingHydrate = null;
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
