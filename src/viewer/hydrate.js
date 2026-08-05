/* Supabase overlay: best-effort persistence + hydration of the watch page.
   Any failure leaves the seeded catalog values in place. */
import { DATA, fmt } from "../shared/catalog.js";
import { ShAPI } from "../shared/streamhub-api.js";
import { vstate, onWatch } from "./state.js";
import { patchComments } from "./comments.js";
import { displayViews } from "./display-metrics.js";

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
   the direct-link/refresh path (applyHash -> render -> pending hydrate).

   IMPORTANT: store the combined view total on vstate.live[id].views so grid
   cards (which only had seed v.views) match the watch page after hydrate. */
export async function hydrateWatch(id){
  if(typeof ShAPI==="undefined" || !ShAPI.enabled) return;
  // Record first, then count — parallel fire used to race and under-count.
  if(!_viewed.has(id)){
    _viewed.add(id);
    await persist(()=> ShAPI.addView(id));
  }
  try {
    const [counts, comments, serverViews] = await Promise.all([
      ShAPI.likeCounts(id), ShAPI.listComments(id), ShAPI.viewCount(id)
    ]);
    const seed = DATA.videos.find(x => x.id === id) || vstate.current;
    const seedViews = seed && Number.isFinite(Number(seed.views)) ? Number(seed.views) : 0;
    // Server returns total engagement rows; seed is catalog baseline (often 0).
    // Combined total is what the watch page has always shown (seed + server).
    const totalViews = seedViews + (serverViews || 0);

    const L = vstate.live[id] = vstate.live[id] || { like: 0, dislike: 0 };
    L.like = counts.like || 0;
    L.dislike = counts.dislike || 0;
    L.views = totalViews;

    if(vstate.current && vstate.current.id===id && onWatch()){
      const v = vstate.current;
      const likeNum=document.getElementById("likeNum");
      if(likeNum) likeNum.textContent = fmt((v.likes||0) + L.like);
      const viewsEl=document.getElementById("watchViewsCount");
      if(viewsEl) viewsEl.textContent = fmt(displayViews(v)) + " views";
      if(comments && comments.length){
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
