/* Single source of truth for engagement numbers shown in the UI.
   Seed catalog (v.views / v.likes) is the baseline; Supabase overlays live
   in vstate.live[id] after hydrateWatch / votes. Cards and the watch page
   must use these helpers so they never disagree. */
import { vstate } from "./state.js";

/** Total views to display: seed + live server count once hydrated. */
export function displayViews(v) {
  if (!v) return 0;
  const live = vstate.live[v.id];
  if (live && typeof live.views === "number" && Number.isFinite(live.views)) {
    return live.views;
  }
  return Number(v.views) || 0;
}

/** Total likes to display: seed + live overlay delta from likeCounts. */
export function displayLikes(v) {
  if (!v) return 0;
  const live = vstate.live[v.id];
  const extra = live && typeof live.like === "number" ? live.like : 0;
  return (Number(v.likes) || 0) + extra;
}
