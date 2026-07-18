/* User actions invoked from inline onclick attributes (exposed on window by
   main.js). Watch-page actions patch the DOM in place — a full render() would
   rebuild #view (player + layout), reset scroll AND restart playback. We only
   fall back to render() when the relevant control isn't on screen (e.g.
   favoriting from a grid card), so list pages that depend on the state still
   refresh. */
import { DATA, toast, fmt, mediaUrl } from "../shared/catalog.js";
import { ShAPI } from "../shared/streamhub-api.js";
import { vstate, pushHistory, onWatch, COMMENT_MAX_LEN } from "./state.js";
import { jsdec } from "./util.js";
import { setHash } from "./router.js";
import { render } from "./render.js";
import { hydrateWatch, persist } from "./hydrate.js";
import { patchComments } from "./comments.js";

export function go(p){ vstate.page=p; setHash(p==="home"?"":p); render(); }

export function focusSearch(){
  const i=document.getElementById("searchInput");
  if(i){ i.scrollIntoView({block:"start",behavior:"smooth"}); i.focus(); }
}

export function openVideo(id){
  id = +id;
  vstate.current = DATA.videos.find(v=>v.id===id);
  if(!vstate.current) return;
  pushHistory(id);
  vstate.commentPage = 1;
  vstate.page="watch"; setHash("video/"+id); render();
  hydrateWatch(id);   // fetch real counts/comments and patch them in (non-blocking)
}

export function openMovie(title){
  title = jsdec(title);   // arrives URI-encoded from inline onclick (see jsq)
  vstate.currentMovieTitle = title;
  vstate.page = "movie";
  setHash("movie/"+encodeURIComponent(title));
  render();
}

export function openCreator(cid){
  cid = jsdec(cid);   // arrives URI-encoded from inline onclick (see jsq)
  vstate.creatorId = cid;
  vstate.page = "creator";
  setHash("creator/"+encodeURIComponent(cid));
  render();
}

export function setHomeFilter(f){ vstate.homeFilter = f; vstate.homeCategory = ""; render(); }
export function setHomeSort(s){ vstate.homeSort = s; render(); }

/* Filter the home feed to a single category (from the filter bar "More" menu). */
export function setHomeCategory(c){
  c = jsdec(c);
  vstate.homeCategory = (vstate.homeCategory === c) ? "" : c;   // toggle off if same
  vstate.page = "home";
  vstate.homeFilter = "all";
  setHash(vstate.homeCategory ? "category/"+encodeURIComponent(vstate.homeCategory) : "");
  render();
}

/* Clicking a tag chip (card / watch page) runs a search for that tag. */
export function searchTag(tag){
  tag = jsdec(tag);
  vstate.searchQuery = tag;
  vstate.page = "search";
  setHash("search/"+encodeURIComponent(tag));
  render();
  const el = document.getElementById("searchInput");
  if(el) el.value = tag;
}

export function loadMore(){
  vstate.limit = (vstate.limit || 36) + 24;
  render();
}

export function toggleFav(id){
  id = +id;
  const on = vstate.favorites.includes(id);
  on ? vstate.favorites=vstate.favorites.filter(x=>x!==id) : vstate.favorites.push(id);
  toast(!on?"Added to Favorites":"Removed from Favorites");
  persist(()=> on ? ShAPI.removeFavorite(id) : ShAPI.addFavorite(id));
  const btn=document.getElementById("btnFav");
  if(onWatch() && btn) btn.classList.toggle("on", !on); else render();
}

export function toggleLater(id){
  id = +id;
  const on = vstate.later.includes(id);
  on ? vstate.later=vstate.later.filter(x=>x!==id) : vstate.later.push(id);
  toast(!on?"Saved to Watch Later":"Removed");
  const btn=document.getElementById("btnLater");
  if(onWatch() && btn) btn.classList.toggle("on", !on); else render();
}

/* Real download: videos are public on R2, so we fetch the file and save it via
   a temporary object URL (forces a download instead of navigating to it). Falls
   back to opening the direct URL if the fetch is blocked. */
export async function download(id){
  id = +id;
  const v = DATA.videos.find(x=>x.id===id);
  if(!v || !v.src){ toast("No file to download"); return; }
  if(!vstate.downloads.includes(id)) vstate.downloads.push(id);
  const url = mediaUrl(v.src);
  const name = (v.title || "video").replace(/[^\w.-]+/g,"_") + (v.src.match(/\.\w+$/)?.[0] || ".mp4");
  toast("Downloading…");
  try {
    const res = await fetch(url);
    if(!res.ok) throw new Error("http "+res.status);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(objUrl), 4000);
    toast("Saved: " + name);
  } catch(_){
    // CORS/network fallback: open the direct URL in a new tab
    window.open(url, "_blank", "noopener");
  }
}

const _voting = new Set();

/* Single vote path for like/dislike. Optimistic delta lives in vstate.live
   (never mutates seed v.likes — see hydrateWatch). The _voting lock holds
   until the persist promise settles, because persist() returns it. */
function vote(id, kind){
  id = +id;                            // coerce: onclick passes number literal, but be safe
  const key = String(id);             // single lock per video — prevents simultaneous like+dislike
  if (_voting.has(key)) return;
  _voting.add(key);
  const v=DATA.videos.find(x=>x.id===id); if(!v){ _voting.delete(key); return; }
  const L = vstate.live[id] = vstate.live[id] || {like:0, dislike:0};
  L[kind]++; toast(kind==="like"?"Liked":"Disliked");
  persist(()=> ShAPI.addLike(id, kind)).finally(()=> _voting.delete(key));
  const num=document.getElementById(kind==="like"?"likeNum":"disNum");
  const base = kind==="like" ? v.likes : v.dislikes;
  if(onWatch() && num) num.textContent=fmt(base + L[kind]); else render();
}
export const likeVideo    = id => vote(id, "like");
export const dislikeVideo = id => vote(id, "dislike");

export function subscribe(cid){
  cid = jsdec(cid);
  const on = vstate.subs.includes(cid);
  on ? vstate.subs=vstate.subs.filter(x=>x!==cid) : vstate.subs.push(cid);
  const subbed = !on;
  // On the watch page patch the button in place — full render restarts the player.
  const btn = onWatch() ? document.querySelector(".subscribe-btn") : null;
  if(btn){
    btn.classList.toggle("ghost", subbed);
    btn.textContent = subbed ? "Subscribed" : "＋ Subscribe";
  } else render();
}

export function addComment(id){
  id = +id;
  const box=document.getElementById("cbox"); if(!box) return;
  const t=(box.value||"").trim(); if(!t)return;
  if (t.length > COMMENT_MAX_LEN) {
    toast(`Comment too long (max ${COMMENT_MAX_LEN} characters)`);
    return;
  }
  DATA.comments.push({id:"m"+Date.now(),video:id,user:DATA.user.name,text:t,time:"now",ts:Date.now()});
  box.value = "";
  persist(()=> ShAPI.addComment(id, DATA.user.name, t));
  // Patch the comment region only — render() would tear down the player mid-playback.
  if(onWatch() && vstate.current && vstate.current.id===id) patchComments(vstate.current);
  else render();
}

export function setCommentSort(val){
  vstate.commentSort = val==="old" ? "old" : "new";
  vstate.commentPage = 1;
  if(onWatch() && vstate.current) patchComments(vstate.current); else render();
}

export function loadMoreComments(){
  vstate.commentPage++;
  if(onWatch() && vstate.current) patchComments(vstate.current); else render();
}

export function shareVideo(id){
  const url = location.href.split("#")[0] + "#video/" + id;
  if(navigator.clipboard) navigator.clipboard.writeText(url).then(()=>toast("Link copied"),()=>toast("Link: "+url));
  else toast("Link: "+url);
}

/* Search is a real page in the render pipeline (vstate.searchQuery), not a raw
   innerHTML write — previously any render() (fav toggle, hydrate fallback)
   silently wiped the results. */
let _searchTimer;
export function doSearch(){
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(_doSearchNow, 220);
}
function _doSearchNow(){
  const el = document.getElementById("searchInput"); if(!el) return;
  const q = (el.value||"").trim();
  vstate.searchQuery = q;
  if(!q){ if(vstate.page==="search") vstate.page="home"; render(); return; }
  vstate.page = "search";
  render();
}
