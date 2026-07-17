/* ===================== VIEWER STATE =====================
   Single mutable state object shared by every viewer module. Mutate fields,
   never reassign the object (modules hold a live binding to it). */
export const vstate = {
  page:"home", current:null, creatorId:null,
  currentMovieTitle:null,
  favorites:[], later:[], history:[], downloads:[],
  subs:["c1","c2"],
  homeFilter:"all",   // "all" | "movies" | "scenes" | "clips"
  homeSort:"none",    // "none" | "latest" | "likes" | "views"
  commentPage: 1,     // comments paginated at COMMENTS_PER_PAGE
  commentSort: "new", // owned by state, not read back from the DOM mid-render
  searchQuery: "",    // search is a real page in the render pipeline
  live: {},           // id -> {like, dislike} counts layered over seed values
  limit: 36,          // simple grid pagination / load more
  flags: { globalUpload: true },  // feature flag: site-wide drag-drop upload
  pendingUploads: [], // uploader-only overlay of in-flight/own uploads
};

export const COMMENTS_PER_PAGE = 20;
export const HISTORY_MAX = 50;
export const COMMENT_MAX_LEN = 2000;

export function pushHistory(id){
  if(vstate.history.includes(id)) return;
  vstate.history.unshift(id);
  if(vstate.history.length > HISTORY_MAX) vstate.history.length = HISTORY_MAX;
}

/* Watch-page check used by every action that patches DOM in place instead of
   re-rendering (a full render() would rebuild #view and restart playback). */
export const onWatch = () => vstate.page === "watch";
