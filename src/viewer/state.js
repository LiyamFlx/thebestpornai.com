/* ===================== VIEWER STATE =====================
   Single mutable state object shared by every viewer module. Mutate fields,
   never reassign the object (modules hold a live binding to it). */

/* User collections persist across reloads via localStorage. Only these fields
   are stored (not transient UI state like page/search). */
const PERSIST_KEY = "sh_viewer_state";
const PERSIST_FIELDS = ["favorites", "later", "history", "downloads", "subs", "settings", "likedComments", "feedWatched"];
const DEFAULT_SETTINGS = { quality: "auto", autoplay: true, language: "en", playbackRate: 1, volume: 0.5, muted: false };
function loadPersisted(){
  try {
    const saved = JSON.parse(localStorage.getItem(PERSIST_KEY) || "null");
    if(!saved || typeof saved !== "object") return {};
    const out = {};
    for(const f of PERSIST_FIELDS){
      if(f === "settings"){
        if(saved.settings && typeof saved.settings === "object") out.settings = { ...DEFAULT_SETTINGS, ...saved.settings };
      } else if(f === "likedComments"){
        if(Array.isArray(saved.likedComments)) out.likedComments = saved.likedComments;
      } else if(Array.isArray(saved[f])) out[f] = saved[f];
    }
    return out;
  } catch(_){ return {}; }
}

export const vstate = {
  page:"home", current:null, creatorId:null,
  currentMovieTitle:null,
  favorites:[], later:[], history:[], downloads:[], feedWatched:[],
  subs:["c1","c2"],
  homeFilter:"all",   // "all" | "movies" | "scenes" | "clips"
  homeCategory:"",    // "" = no category filter, else a category name from taxonomy
  homeSort:"none",    // "none" | "latest" | "likes" | "views"
  homeExpandCats:false, // show secondary category/act rows on home
  libraryTab:"later", // "later" | "favorites" | "history" | "downloads"
  commentPage: 1,     // comments paginated at COMMENTS_PER_PAGE
  commentSort: "new", // owned by state, not read back from the DOM mid-render
  searchQuery: "",    // search is a real page in the render pipeline
  live: {},           // id -> {like, dislike} counts layered over seed values
  limit: 36,          // simple grid pagination / load more
  flags: { globalUpload: true },  // feature flag: site-wide drag-drop upload
  pendingUploads: [], // uploader-only overlay of in-flight/own uploads
  settings: { ...DEFAULT_SETTINGS },   // playback quality / autoplay / language / playbackRate — real prefs, persisted below
  likedComments: [],  // comment ids ("db"+n or "m"+timestamp) this browser has liked — persisted
  commentLikeCounts: {}, // comment id -> local like-count delta (session overlay, not persisted — only likedComments membership is)
  watchTab: "upnext", // "upnext" | "comments" — mobile watch-page tab selection (transient, resets each video)
  theaterMode: false, // desktop-only widened player layout (transient)
  ...loadPersisted(),   // rehydrate favorites/later/history/downloads/subs/settings/likedComments
};

/* Save the persisted collections. Call after any mutation to those fields.
   Cheap + synchronous; best-effort (ignores quota/private-mode errors). */
export function persistState(){
  try {
    const data = {};
    for(const f of PERSIST_FIELDS) data[f] = vstate[f];
    localStorage.setItem(PERSIST_KEY, JSON.stringify(data));
  } catch(_){}
}

export const COMMENTS_PER_PAGE = 20;
export const HISTORY_MAX = 50;
export const COMMENT_MAX_LEN = 2000;
export const FEED_WATCHED_MAX = 300;

export function pushHistory(id){
  if(vstate.history.includes(id)){
    // move to front (most-recent) without duplicating
    vstate.history = vstate.history.filter(x=>x!==id);
  }
  vstate.history.unshift(id);
  if(vstate.history.length > HISTORY_MAX) vstate.history.length = HISTORY_MAX;
  persistState();
}

/* Vertical-feed "seen" tracking: feed.js marks a video watched once the
   viewer has actually played a meaningful chunk of it (not just scrolled
   past). Used to order the feed so unwatched/new clips surface first on
   every visit instead of the same static catalog order forever — see
   orderedFeedVideos() in pages/feed.js. Capped + FIFO-evicted so a heavy
   user doesn't grow this unboundedly; eviction just lets that oldest video
   resurface as "unwatched" eventually, which is fine for a shuffle feed. */
export function markFeedWatched(id){
  if(vstate.feedWatched.includes(id)) return;
  vstate.feedWatched.push(id);
  if(vstate.feedWatched.length > FEED_WATCHED_MAX) vstate.feedWatched.shift();
  persistState();
}

/* Watch-page check used by every action that patches DOM in place instead of
   re-rendering (a full render() would rebuild #view and restart playback). */
export const onWatch = () => vstate.page === "watch";
