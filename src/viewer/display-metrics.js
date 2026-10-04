/* Single source of truth for engagement numbers shown in the UI.
   Seed catalog (v.views / v.likes) is the baseline; Supabase overlays live
   in vstate.live[id] after hydrateWatch / votes. Cards and the watch page
   must use these helpers so they never disagree. */
import { vstate } from "./state.js";

/** Total views to display: seed + live server count once hydrated. */
export function displayViews(v) {
  if (!v) return 0;
  const id = typeof v === "object" ? v.id : v;
  const live = vstate.live[id];
  if (live && typeof live.views === "number" && Number.isFinite(live.views)) {
    return live.views;
  }
  return typeof v === "object" ? (Number(v.views) || 0) : 0;
}

/** Total likes to display: seed + live overlay delta from likeCounts. */
export function displayLikes(v) {
  if (!v) return 0;
  const id = typeof v === "object" ? v.id : v;
  const live = vstate.live[id];
  const extra = live && typeof live.like === "number" ? live.like : 0;
  return (typeof v === "object" ? (Number(v.likes) || 0) : 0) + extra;
}
