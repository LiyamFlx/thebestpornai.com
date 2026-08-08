/* Bunny/R2 manifest sync: load user-uploaded videos and prepend to the feed.
   Fetch/merge core lives in shared/manifest-core.js (also used by creator
   studio); this file adds the viewer-specific bits — video-count badge,
   route re-apply, and page re-render — on top. */
import { DATA } from "../shared/catalog.js";
import { fetchManifest, mergeManifest, videoCountLabel } from "../shared/manifest-core.js";
import { vstate } from "./state.js";
import { applyHash } from "./router.js";
import { render } from "./render.js";

export { mergeManifest };

let _lastManifestSync = null;

export function updateVideoCount(extra = '') {
  const badge = document.getElementById("videoCountBadge");
  if (!badge) return;
  badge.textContent = videoCountLabel(_lastManifestSync, extra);
}

/* Initial load: best-effort, console-only errors, minimal re-render. */
export async function syncManifestOnLoad() {
  updateVideoCount();
  try {
    let uploads;
    try {
      uploads = await fetchManifest();
    } catch (e) {
      if (e && e.status) {
        console.warn('[manifest] fetch failed', e.status);
        updateVideoCount(' • sync failed');
        return;
      }
      throw e;
    }
    if (!Array.isArray(uploads) || !uploads.length) return;

    const added = mergeManifest(uploads);
    _lastManifestSync = Date.now();

    if (!added) { updateVideoCount(); return; }

    // Re-apply the route (a direct link may target a manifest video) and only
    // re-render pages whose content actually changes with new videos.
    if (location.hash) applyHash();
    const currentPageNeedsFull = ['home', 'explore', 'trending', 'categories'].includes(vstate.page);
    if (currentPageNeedsFull) render();
    updateVideoCount();
  } catch (e) {
    console.warn('[manifest] load error (non-fatal):', e?.message || e);
    updateVideoCount(' • sync error');
  }
}

/* Manual refresh for power users / debugging (window.refreshManifest). */
export async function refreshManifest() {
  _lastManifestSync = null;
  try {
    const uploads = await fetchManifest();
    const added = mergeManifest(uploads);
    if (added) render();
    _lastManifestSync = Date.now();
    updateVideoCount();
    console.log('[manifest] refreshed, added', added);
  } catch (e) {
    console.error('[manifest] manual refresh failed', e);
  }
}
