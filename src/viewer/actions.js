/* User actions invoked from inline onclick attributes (exposed on window by
   main.js). Watch-page actions patch the DOM in place — a full render() would
   rebuild #view (player + layout), reset scroll AND restart playback. We only
   fall back to render() when the relevant control isn't on screen (e.g.
   favoriting from a grid card), so list pages that depend on the state still
   refresh. */
import { DATA, toast, fmt, mediaUrl } from "../shared/catalog.js";
import { ShAPI } from "../shared/streamhub-api.js";
import { vstate, pushHistory, onWatch, persistState, COMMENT_MAX_LEN } from "./state.js";
import { jsdec } from "./util.js";
import { setHash, scrollToTop, saveScrollPosition, takeSavedReturn } from "./router.js";
import { render } from "./render.js";
import { hydrateWatch, persist } from "./hydrate.js";
import { patchComments, commentsFor, renderCommentList } from "./comments.js";
import { pubVideos, visible } from "./catalog-queries.js";

/* Primary navigation destinations. Legacy aliases (later/favorites/…) route
   into the Library hub with the matching tab so old links and menus still work. */
const LIBRARY_ALIASES = { later: "later", favorites: "favorites", history: "history", downloads: "downloads" };

export function go(p){
  if(LIBRARY_ALIASES[p]){
    vstate.libraryTab = LIBRARY_ALIASES[p];
    vstate.page = "library";
    setHash("library/" + vstate.libraryTab);
    render();
    scrollToTop();
    return;
  }
  if(p === "library"){
    vstate.page = "library";
    if(!vstate.libraryTab) vstate.libraryTab = "later";
    setHash("library/" + vstate.libraryTab);
    render();
    scrollToTop();
    return;
  }
  if(p === "search"){
    goSearch();
    return;
  }
  // True Home: clear category/format filters so "Browse Home" recovery CTAs
  // and the sidebar Home button always land on the curated default feed.
  if(p === "home"){
    vstate.page = "home";
    vstate.homeCategory = "";
    vstate.homeFilter = "all";
    vstate.homeExpandCats = false;
    vstate.feedFocusId = null;
    setHash("");
    render();
    scrollToTop();
    return;
  }
  // Shorts tab: open the vertical feed without a pinned clip (shareable bare #shorts)
  if(p === "feed" || p === "shorts"){
    vstate.page = "feed";
    vstate.feedFocusId = null;
    setHash("shorts");
    render();
    scrollToTop();
    return;
  }
  vstate.page = p;
  vstate.feedFocusId = null;
  setHash(p);
  render();
  scrollToTop();
}

/* Open the Search hub (or keep the current query) and focus the topbar input. */
export function goSearch(){
  vstate.page = "search";
  const q = (vstate.searchQuery || "").trim();
  setHash(q ? "search/" + encodeURIComponent(q) : "search");
  render();
  scrollToTop();
  // Focus after paint so the input exists and mobile chrome expands.
  requestAnimationFrame(() => focusSearch());
}

export function setLibraryTab(tab){
  const t = ["later","favorites","history","downloads"].includes(tab) ? tab : "later";
  vstate.libraryTab = t;
  vstate.page = "library";
  setHash("library/" + t);
  render();
  scrollToTop();
}

export function focusSearch(){
  const topbar = document.querySelector(".topbar");
  if(topbar){
    topbar.classList.add("mchrome-search-open");
    const toggleBtn = topbar.querySelector(".topbar-search-toggle");
    if(toggleBtn) toggleBtn.setAttribute("aria-expanded", "true");
  }
  const i = document.getElementById("searchInput");
  if(i){
    if(vstate.searchQuery && !i.value) i.value = vstate.searchQuery;
    i.scrollIntoView({ block: "start", behavior: "smooth" });
    i.focus();
  }
}

export function openVideo(id){
  id = +id;
  const video = DATA.videos.find(v=>v.id===id);
  // Private/pending uploads must never be directly openable via a known id
  // or #video/N hash — the visible() gate everywhere else (feeds, search,
  // trending, suggestions) was purely cosmetic if this entry point skipped it.
  if(!visible(video)) return;
  // Vertical clips open in Shorts at the exact reel (shareable #shorts/N),
  // not the landscape watch page — matches IG-style deep links.
  if(video.orientation === "vertical"){
    saveScrollPosition();
    pushHistory(id);
    vstate.feedFocusId = id;
    vstate.page = "feed";
    setHash("shorts/" + id);
    render();
    return;
  }
  vstate.current = video;
  if(!vstate.current) return;
  saveScrollPosition();
  pushHistory(id);
  vstate.commentPage = 1;
  vstate.feedFocusId = null;
  vstate.page="watch"; setHash("video/"+id); render(); scrollToTop();
  hydrateWatch(id);   // fetch real counts/comments and patch them in (non-blocking)
}

/* Close the watch page (Esc / close button) back to wherever the user was
   browsing before — same page, same filters, same scroll position. Unlike
   go("home"), this never resets category/filter state. */
export function closeWatch(){
  if(vstate.page !== "watch") return;
  const saved = takeSavedReturn();
  vstate.page = saved?.page || "home";
  setHash((saved?.hash || "").replace(/^#/, ""));
  render();
  if(saved){
    window.scrollTo(0, saved.y);
    const view = document.getElementById("view");
    if(view) view.scrollTop = saved.viewTop;
  } else {
    scrollToTop();
  }
}

/* Cycle to the previous/next public video from the watch page (dir: -1 | 1).
   Shared by the on-screen prev/next buttons and the ArrowLeft/ArrowRight
   keyboard shortcut in main.js so both stay in sync. */
export function stepWatch(dir){
  const list = pubVideos();
  if(!list.length) return;
  const currentIdx = list.findIndex(v=>v.id===vstate.current?.id);
  if(currentIdx===-1) return;
  const nextIdx = (currentIdx + dir + list.length) % list.length;
  openVideo(list[nextIdx].id);
}

export function openMovie(title){
  title = jsdec(title);   // arrives URI-encoded from inline onclick (see jsq)
  vstate.currentMovieTitle = title;
  vstate.page = "movie";
  setHash("movie/"+encodeURIComponent(title));
  render();
  scrollToTop();
}

export function openCreator(cid){
  cid = jsdec(cid);   // arrives URI-encoded from inline onclick (see jsq)
  vstate.creatorId = cid;
  vstate.page = "creator";
  setHash("creator/"+encodeURIComponent(cid));
  render();
  scrollToTop();
}

export function setHomeFilter(f){
  const allowed = new Set(["all","movies","scenes","clips","pornstars"]);
  vstate.homeFilter = allowed.has(f) ? f : "all";
  vstate.homeCategory = "";
  vstate.homeExpandCats = false;
  // Stars are people, not a sorted video list — reset sort noise
  if(vstate.homeFilter === "pornstars") vstate.homeSort = "none";
  render();
}
export function setHomeSort(s){ vstate.homeSort = s; render(); }
export function setHomeExpandCats(on){
  vstate.homeExpandCats = !!on;
  vstate.page = "home";
  render();
}

/* Filter the home feed to a single category (from the filter bar "More" menu). */
export function setHomeCategory(c){
  c = jsdec(c);
  vstate.homeCategory = (vstate.homeCategory === c) ? "" : c;   // toggle off if same
  vstate.page = "home";
  vstate.homeFilter = "all";
  setHash(vstate.homeCategory ? "category/"+encodeURIComponent(vstate.homeCategory) : "");
  render();
  scrollToTop();
}

/* Clicking a tag chip (card / watch page) runs a search for that tag. */
export function searchTag(tag){
  tag = jsdec(tag);
  vstate.searchQuery = tag;
  vstate.page = "search";
  setHash("search/"+encodeURIComponent(tag));
  render();
  scrollToTop();
  const el = document.getElementById("searchInput");
  if(el) el.value = tag;
}

/* Reset query and return to the Search hub. */
export function clearSearch(){
  vstate.searchQuery = "";
  const el = document.getElementById("searchInput");
  if(el) el.value = "";
  vstate.page = "search";
  setHash("search");
  render();
  scrollToTop();
  requestAnimationFrame(() => focusSearch());
}

export function loadMore(){
  vstate.limit = (vstate.limit || 36) + 24;
  render();
}

/* Which page's *content* is exactly the toggled set. On that page the item
   appears/disappears when toggled, so the list must be rebuilt (full render);
   everywhere else we patch the affected controls in place and skip the render —
   avoiding a full grid rebuild (and lost scroll position) for a single tap. */
function reflectSetToggle(kind, id, active){
  // Library hub (or legacy aliases) must re-render so items appear/disappear.
  if(vstate.page === "library" || vstate.page === "favorites" || vstate.page === "later" || vstate.page === "history" || vstate.page === "downloads"){
    render();
    return;
  }
  // Watch-page primary action button (present only on the watch page).
  const watchBtn = document.getElementById(kind==="fav" ? "btnFav" : "btnLater");
  if(watchBtn){
    watchBtn.classList.toggle("on", active);
    watchBtn.setAttribute("aria-pressed", active ? "true" : "false");
  }
  // Card / hero quick-actions for this id (a video can appear in several places —
  // patch every instance so they stay in sync). Hero uses data-later-id too.
  document.querySelectorAll(`[data-${kind}-id="${id}"]`).forEach(b => {
    b.classList.toggle("on", active);
    b.setAttribute("aria-pressed", active ? "true" : "false");
    if(kind === "later" && b.classList.contains("hero-later-btn")){
      b.setAttribute("aria-label", active ? "Remove from Watch Later" : "Add to Watch Later");
    }
  });
}

export function toggleFav(id){
  id = +id;
  const on = vstate.favorites.includes(id);
  on ? vstate.favorites=vstate.favorites.filter(x=>x!==id) : vstate.favorites.push(id);
  persistState();
  toast(!on?"Added to Favorites":"Removed from Favorites");
  persist(()=> on ? ShAPI.removeFavorite(id) : ShAPI.addFavorite(id));
  reflectSetToggle("fav", id, !on);
}

export function toggleLater(id){
  id = +id;
  const on = vstate.later.includes(id);
  on ? vstate.later=vstate.later.filter(x=>x!==id) : vstate.later.push(id);
  persistState();
  toast(!on?"Saved to Watch Later":"Removed");
  reflectSetToggle("later", id, !on);
}

/* Real download: videos are public on R2, so we fetch the file and save it via
   a temporary object URL (forces a download instead of navigating to it). Falls
   back to opening the direct URL if the fetch is blocked. */
export async function download(id){
  id = +id;
  const v = DATA.videos.find(x=>x.id===id);
  if(!v || !visible(v) || !v.src){ toast("No file to download"); return; }
  if(!vstate.downloads.includes(id)){ vstate.downloads.push(id); persistState(); }
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
  // Patch every on-screen counter for this video in place. Like counts only
  // ever appear on the watch page (#likeNum/#disNum) and the vertical feed
  // (#feedLike_<id>); nothing else in any layout changes on a vote, so we never
  // need a full render() — which on the feed would rebuild the whole scroller,
  // tear down the autoplay observer, and interrupt playback.
  const base = kind==="like" ? v.likes : v.dislikes;
  const val = fmt(base + L[kind]);
  const watchNum = document.getElementById(kind==="like"?"likeNum":"disNum");
  if(watchNum) watchNum.textContent = val;
  if(kind==="like"){
    const feedLabel = document.getElementById("feedLike_"+id);
    if(feedLabel) feedLabel.textContent = val;
    // A plain class selector here (not the onclick-attribute substring match
    // this used to do) — that scanned every <button> in the DOM comparing
    // attribute text, real avoidable work on a page with hundreds of cards.
    const feedBtn = document.querySelector(`.feed-item[data-video-id="${id}"] .feed-like-btn`);
    if(feedBtn) feedBtn.classList.add("liked");
  }
}
export const likeVideo    = id => vote(id, "like");
export const dislikeVideo = id => vote(id, "dislike");

export function subscribe(cid){
  cid = jsdec(cid);
  const on = vstate.subs.includes(cid);
  on ? vstate.subs=vstate.subs.filter(x=>x!==cid) : vstate.subs.push(cid);
  persistState();
  const subbed = !on;
  // On the watch page patch the button in place — full render restarts the player.
  const btn = onWatch() ? document.getElementById("subscribeBtnV2") : null;
  if(btn){
    btn.classList.toggle("subscribed", subbed);
    const label = document.getElementById("subscribeTextV2");
    const bell = btn.querySelector(".bell-ico");
    if(label) label.textContent = subbed ? "Subscribed" : "Subscribe";
    if(bell) bell.style.display = subbed ? "" : "none";
  } else render();
}

/* Post a comment. `textOpt` is used by the Shorts feed drawer (#feedCbox);
   watch page omits it and reads #cbox. Previously feed called addComment(id, text)
   but this only looked at #cbox — so Shorts posts silently no-oped. */
export function addComment(id, textOpt){
  id = +id;
  const cbox = document.getElementById("cbox");
  const feedCbox = document.getElementById("feedCbox");
  let t = typeof textOpt === "string" ? textOpt.trim() : "";
  if (!t) {
    const box = cbox || feedCbox;
    if (!box) return false;
    t = (box.value || "").trim();
  }
  if (!t) return false;
  if (t.length > COMMENT_MAX_LEN) {
    toast(`Comment too long (max ${COMMENT_MAX_LEN} characters)`);
    return false;
  }
  // vstate.live overlay, not DATA.comments — see comments.js's commentsFor()
  const author = (DATA.user && DATA.user.name) || "Guest";
  const comment = { id: "m" + Date.now(), video: id, user: author, text: t, time: "now", ts: Date.now() };
  const L = vstate.live[id] = vstate.live[id] || { like: 0, dislike: 0 };
  L.comments = L.comments || [];
  L.comments.push(comment);
  if (cbox) cbox.value = "";
  if (feedCbox) feedCbox.value = "";
  persist(() => ShAPI.addComment(id, author, t));

  // Watch page: patch list only — full render() would tear down the player.
  if (onWatch() && vstate.current && vstate.current.id === id) {
    patchComments(vstate.current);
  }

  // Shorts feed drawer: refresh list + sidebar count without re-rendering the feed
  // (full render() would reset scroll-snap position and pause playback).
  const feedBody = document.getElementById("feedCommentsBody");
  if (feedBody) {
    const v = DATA.videos.find((x) => x.id === id);
    if (v) {
      feedBody.innerHTML = renderCommentList(v);
      const commentLabel = document.getElementById(`feedComment_${id}`);
      if (commentLabel) commentLabel.textContent = String(commentsFor(v).length);
    }
  } else if (!(onWatch() && vstate.current && vstate.current.id === id)) {
    render();
  }
  return true;
}

/* Comment-level like toggle (distinct from video like/dislike). Persists only
   membership in vstate.likedComments (so "did I like this" survives reload);
   the displayed count itself is a session-only delta — see comments.js's
   commentLikeCount(). No backend table for comment likes exists yet, so
   there's nothing to persist() against; toggling is purely local/optimistic. */
export function likeComment(id){
  const liked = vstate.likedComments.includes(id);
  if(liked){
    vstate.likedComments = vstate.likedComments.filter(x=>x!==id);
    vstate.commentLikeCounts[id] = (vstate.commentLikeCounts[id]||0) - 1;
  } else {
    vstate.likedComments.push(id);
    vstate.commentLikeCounts[id] = (vstate.commentLikeCounts[id]||0) + 1;
  }
  persistState();
  if(vstate.current) patchComments(vstate.current);
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

/* Report a video. Records the report locally (persistent, honest — the user's
   report is remembered) and best-effort forwards it to the moderation queue if
   the API accepts it. No fake "submitted" claim when it only stored locally. */
export function reportVideo(id){
  id = +id;
  let reported = [];
  try { reported = JSON.parse(localStorage.getItem("sh_reported") || "[]"); } catch(_){}
  if(reported.includes(id)){ toast("You already reported this video"); return; }
  reported.push(id);
  try { localStorage.setItem("sh_reported", JSON.stringify(reported)); } catch(_){}
  toast("Report received — thanks for flagging");
  // Best-effort: forward to the moderation queue if the API allows it (requires
  // a moderator session; silently ignored otherwise — the local report stands).
  persist(()=> ShAPI.moderate(id, "reported", "user report", null));
}

/* Share a deep link. Vertical (Shorts) clips use #shorts/N so the recipient
   lands on that exact reel in the feed — same idea as an IG Reel URL.
   Landscape clips keep #video/N (watch page). Prefer the Web Share sheet on
   mobile when available; fall back to clipboard. */
export function shareVideo(id){
  id = +id;
  const v = DATA.videos.find((x) => x.id === id);
  const isShort = v && v.orientation === "vertical";
  const hash = isShort ? ("shorts/" + id) : ("video/" + id);
  const url = location.href.split("#")[0] + "#" + hash;
  const title = (v && v.title) ? v.title : "Watch on thebestpornai";

  if(typeof navigator.share === "function"){
    navigator.share({ title, url, text: title }).then(() => {
      toast(isShort ? "Short shared" : "Link shared");
    }).catch((err) => {
      if(err && err.name === "AbortError") return;
      copyShareUrl(url, isShort);
    });
    return;
  }
  copyShareUrl(url, isShort);
}

function copyShareUrl(url, isShort){
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(
      () => toast(isShort ? "Short link copied" : "Link copied"),
      () => toast("Link: " + url)
    );
  } else {
    toast("Link: " + url);
  }
}

/* Search is a real page in the render pipeline (vstate.searchQuery), not a raw
   innerHTML write — previously any render() (fav toggle, hydrate fallback)
   silently wiped the results. Empty query opens the Search hub (not Home). */
let _searchTimer;
export function doSearch(){
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(_doSearchNow, 220);
}
function _doSearchNow(){
  const el = document.getElementById("searchInput"); if(!el) return;
  const q = (el.value || "").trim();
  vstate.searchQuery = q;
  vstate.page = "search";
  // replace:true — typing "milf" must not create 4 Back-stack entries
  setHash(q ? "search/" + encodeURIComponent(q) : "search", { replace: true });
  render();
}

/* Settings: only real, checkable prefs are exposed here (see renderSettings())
   — "Playback Quality"/"Language"/"Theme" were removed rather than left as
   dead dropdowns, since there's no adaptive-bitrate, i18n, or alt-theme
   system in the app for them to actually control. Autoplay wires straight
   into player-controls-v2.js's attachAutoAdvance(), which checks this flag. */
export function toggleAutoplaySetting(on){
  vstate.settings.autoplay = !!on;
  persistState();
  toast(on ? "Autoplay turned on" : "Autoplay turned off");
}