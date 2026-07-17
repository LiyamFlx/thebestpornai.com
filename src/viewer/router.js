/* ---- URL hash routing: shareable/bookmarkable per-video URLs ----
   Owns the hash <-> vstate.page mapping and the pending-hydrate handoff for
   the direct-link/refresh path (applyHash -> render -> hydrateWatch). */
import { DATA } from "../shared/catalog.js";
import { vstate, pushHistory } from "./state.js";
import { jsdec } from "./util.js";

let _suppressHash = false;
let _pendingHydrate = null;   // video id to hydrate after the next render

export function setHash(h){
  _suppressHash = true;
  location.hash = h ? ("#"+h) : "";
  setTimeout(()=>_suppressHash=false, 0);
}

export function applyHash(){
  const h=(location.hash||"").replace(/^#/,"");
  const m=h.match(/^video\/(\d+)$/);
  if(m){
    const vid=DATA.videos.find(v=>v.id===+m[1]);
    if(vid){ vstate.current=vid; pushHistory(vid.id); vstate.page="watch"; _pendingHydrate=vid.id; return; }
  }
  const mm=h.match(/^movie\/(.+)$/);
  if(mm){ vstate.currentMovieTitle=jsdec(mm[1]); vstate.page="movie"; return; }
  const mc=h.match(/^creator\/(.+)$/);
  if(mc){ vstate.creatorId=jsdec(mc[1]); vstate.page="creator"; return; }
  const ms=h.match(/^search\/(.+)$/);
  if(ms){ vstate.searchQuery=jsdec(ms[1]); vstate.page="search"; return; }
  const mcat=h.match(/^category\/(.+)$/);
  if(mcat){ vstate.homeCategory=jsdec(mcat[1]); vstate.homeFilter="all"; vstate.page="home"; return; }
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
  });
}
