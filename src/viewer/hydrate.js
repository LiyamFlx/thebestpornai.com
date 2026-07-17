/* Supabase overlay: best-effort persistence + hydration of the watch page.
   Any failure leaves the seeded catalog values in place. */
import { DATA, esc, fmt } from "../shared/catalog.js";
import { ShAPI } from "../shared/streamhub-api.js";
import { vstate, onWatch } from "./state.js";
import { patchComments } from "./comments.js";

/* Fire-and-forget persistence: never let an API failure break the UI. The
   optimistic in-memory update has already been applied by the caller, so if
   Supabase is down we simply keep that (today's fallback behavior).
   RETURNS the in-flight promise (always resolves) so callers like the vote
   lock can actually await completion — previously it returned undefined and
   the lock released synchronously, making it a no-op. */
export function persist(promiseFn){
  try {
    if(typeof ShAPI!=="undefined" && ShAPI.enabled)
      return Promise.resolve(promiseFn()).catch(()=>{});
  } catch(_){}
  return Promise.resolve();
}

/* Views already recorded this session — openVideo can fire repeatedly for the
   same video (back/forward, related-row loops) and must not inflate counts. */
const _viewed = new Set();

/* Pull persisted likes/comments from Supabase and patch the already-rendered
   watch page. Best-effort: any failure leaves the seeded values in place.
   Also records the view here so it fires on BOTH the click path (openVideo) and
   the direct-link/refresh path (applyHash -> render -> pending hydrate). */
export async function hydrateWatch(id){
  if(typeof ShAPI==="undefined" || !ShAPI.enabled) return;
  if(!_viewed.has(id)){ _viewed.add(id); persist(()=> ShAPI.addView(id)); }
  try {
    const [counts, comments, views, favCount] = await Promise.all([
      ShAPI.likeCounts(id), ShAPI.listComments(id), ShAPI.viewCount(id), ShAPI.favoriteCount(id)
    ]);
    if(vstate.current && vstate.current.id===id && onWatch()){
      const v = vstate.current;
      // Server counts become the authoritative overlay; they already include
      // any votes we persisted earlier, so we never mutate the seed values
      // (previously v.likes++ plus counts.like double-counted own likes).
      vstate.live[id] = { like: counts.like||0, dislike: counts.dislike||0 };
      const likeNum=document.getElementById("likeNum"), disNum=document.getElementById("disNum");
      if(likeNum) likeNum.textContent = fmt(v.likes + vstate.live[id].like);
      if(disNum)  disNum.textContent  = fmt(v.dislikes + vstate.live[id].dislike);
      // Views (seed + real) in the sub line.
      const subEl=document.getElementById("watchSub");
      if(subEl) subEl.innerHTML = "👁 " + fmt(v.views + (views||0)) + " views <span class='dot-sep'>•</span> " + esc(v.uploaded);
      // Favorites count chip.
      const favCountEl=document.getElementById("favCount");
      if(favCountEl) favCountEl.textContent = favCount ? (" ("+fmt(favCount)+")") : "";
      if(comments && comments.length){
        // Merge persisted comments into DATA.comments (avoid dupes) and re-render the list region.
        for(const c of comments){
          const key = "db"+c.id;
          if(!DATA.comments.some(m=>m.id===key))
            DATA.comments.push({ id:key, video:id, user:c.author, text:c.body, time:"", ts: Date.parse(c.created_at)||0 });
        }
        if(vstate.current && vstate.current.id===id && onWatch()) patchComments(v);
      }
    }
  } catch(_){ /* offline / API down -> keep seeded values */ }
}
