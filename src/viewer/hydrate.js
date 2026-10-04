/* Supabase overlay: best-effort persistence + hydration of the watch page.
   Any failure leaves the seeded catalog values in place. */
import { DATA, fmt } from "../shared/catalog.js";
import { ShAPI } from "../shared/streamhub-api.js";
import { storedVoteFor, writeStoredVote } from "../shared/vote-logic.js";
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

/** Patch any card/Up-Next DOM nodes for a given video ID with its latest displayViews */
export function patchCardViewsInDOM(vid) {
  if (typeof document === "undefined") return;
  const num = fmt(displayViews(vid));
  // 1. Regular grid/row video cards (snippet cards)
  document.querySelectorAll(`.card[data-video-id="${vid}"] .card-views-num`).forEach(el => {
    el.textContent = num;
  });
  // 2. Up Next cards
  document.querySelectorAll(`.upnext-card[data-video-id="${vid}"] .upnext-views-num`).forEach(el => {
    el.textContent = `${num} views`;
  });
  // 3. Home hero banner
  document.querySelectorAll(`.hero-views-num[data-hero-views="${vid}"]`).forEach(el => {
    el.textContent = `${num} views`;
  });
}

// In-flight ID tracking to prevent duplicate network calls across rapid renders/scrolling
const _inFlightHydration = new Set();

/** Hydrate views for an array of card video IDs in the background */
export async function hydrateCardViews(videoIds) {
  if (typeof ShAPI === "undefined" || !ShAPI.enabled || !ShAPI.batchViewCounts) return;
  if (!Array.isArray(videoIds) || !videoIds.length) return;
  const unhydrated = Array.from(new Set(videoIds.map(Number))).filter(
    id => id > 0 && !_inFlightHydration.has(id) && (!vstate.live[id] || typeof vstate.live[id].views !== "number")
  );
  if (!unhydrated.length) return;
  // Mark in-flight immediately
  for (const id of unhydrated) _inFlightHydration.add(id);

  try {
    const counts = await ShAPI.batchViewCounts(unhydrated);
    for (const vid of unhydrated) {
      const seed = DATA.videos.find(x => x.id === vid);
      const seedViews = seed && Number.isFinite(Number(seed.views)) ? Number(seed.views) : 0;
      const sViews = counts[vid] || 0;
      const L = vstate.live[vid] = vstate.live[vid] || { like: 0, dislike: 0 };
      L.views = seedViews + sViews;
      patchCardViewsInDOM(vid);
    }
  } catch (_) {
    /* offline / API down -> keep seeded values */
  } finally {
    for (const id of unhydrated) _inFlightHydration.delete(id);
  }
}

/* Pull persisted likes/comments/views from Supabase and patch the already-rendered
   watch page and its Up Next cards. Best-effort: any failure leaves the seeded values in place.
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

  // Collect related video IDs from Up Next DOM cards
  const upNextEls = typeof document !== "undefined" ? document.querySelectorAll(".upnext-card[data-video-id]") : [];
  const relatedIds = Array.from(upNextEls).map(el => +el.dataset.videoId).filter(Boolean);
  const allIdsToFetch = Array.from(new Set([id, ...relatedIds]));

  try {
    const [counts, comments, serverViews, serverVote, batchCounts] = await Promise.all([
      ShAPI.likeCounts(id),
      ShAPI.listComments(id),
      ShAPI.viewCount(id),
      ShAPI.myVote(id),
      allIdsToFetch.length && ShAPI.batchViewCounts
        ? ShAPI.batchViewCounts(allIdsToFetch).catch(() => ({}))
        : Promise.resolve({})
    ]);
    const seed = DATA.videos.find(x => x.id === id) || vstate.current;
    const seedViews = seed && Number.isFinite(Number(seed.views)) ? Number(seed.views) : 0;
    // Server returns total engagement rows; seed is catalog baseline (often 0).
    // Combined total is what the watch page has always shown (seed + server).
    const sViews = (typeof serverViews === "number" && serverViews > 0)
      ? serverViews
      : (batchCounts[id] || 0);
    const totalViews = seedViews + sViews;

    const L = vstate.live[id] = vstate.live[id] || { like: 0, dislike: 0 };
    L.like = counts.like || 0;
    L.dislike = counts.dislike || 0;
    L.views = totalViews;
    L.myVote = serverVote || storedVoteFor(id);
    if (L.myVote) writeStoredVote(id, L.myVote);

    // Also hydrate related Up Next videos so their cards match real counts
    if (batchCounts) {
      for (const relId of relatedIds) {
        const seedRel = DATA.videos.find(x => x.id === relId);
        const seedRelViews = seedRel && Number.isFinite(Number(seedRel.views)) ? Number(seedRel.views) : 0;
        const relServerViews = batchCounts[relId] || 0;
        const LRel = vstate.live[relId] = vstate.live[relId] || { like: 0, dislike: 0 };
        LRel.views = seedRelViews + relServerViews;
        patchCardViewsInDOM(relId);
      }
    }

    // Patch current video's cards in DOM (e.g. if present in any grid/list)
    patchCardViewsInDOM(id);

    if(vstate.current && vstate.current.id===id && onWatch()){
      const v = vstate.current;
      const likeNum=document.getElementById("likeNum");
      if(likeNum) likeNum.textContent = fmt((v.likes||0) + L.like);
      const btnLike = document.getElementById("btnLike");
      if(btnLike){
        btnLike.classList.toggle("on", L.myVote === "like");
        btnLike.setAttribute("aria-pressed", L.myVote === "like" ? "true" : "false");
      }
      const btnDis = document.getElementById("btnDislike");
      if(btnDis){
        btnDis.classList.toggle("on", L.myVote === "dislike");
        btnDis.setAttribute("aria-pressed", L.myVote === "dislike" ? "true" : "false");
      }
      const viewsEl=document.getElementById("watchViewsCount");
      if(viewsEl) viewsEl.textContent = fmt(displayViews(v)) + " views";
      if(comments && comments.length){
        for(const c of comments){
          const key = "db"+c.id;
          if(!DATA.comments.some(m=>m.id===key))
            DATA.comments.push({ id:key, video:id, user:c.author, text:c.body, time:"", ts: Date.parse(c.created_at)||0 });
        }
        // Drop optimistic overlay rows now confirmed on the server so the
        // same comment doesn't render twice (commentsFor concatenates both).
        if (L.comments && L.comments.length) {
          L.comments = L.comments.filter((o) =>
            !comments.some((c) => c.body === o.text && (c.author || "Guest") === (o.user || "Guest"))
          );
        }
        if(vstate.current && vstate.current.id===id && onWatch()) patchComments(v);
      }
    }
  } catch(_){ /* offline / API down -> keep seeded values */ }
}
