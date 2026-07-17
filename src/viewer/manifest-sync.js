/* Bunny/R2 manifest sync: load user-uploaded videos and prepend to the feed.
   The manifest is remote input: validate shape and dedupe on BOTH src and id —
   an id collision would hijack the hero pin and every openVideo() lookup. */
import { DATA, fmt } from "../shared/catalog.js";
import { vstate } from "./state.js";
import { applyHash } from "./router.js";
import { render } from "./render.js";

const MANIFEST_URL = "https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev/manifest.json";

let _lastManifestSync = null;

export function updateVideoCount(extra = '') {
  const badge = document.getElementById("videoCountBadge");
  if (!badge) return;
  const base = fmt(DATA.videos.length) + ' videos';
  const sync = _lastManifestSync
    ? ' • synced ' + (Date.now() - _lastManifestSync < 60000 ? 'just now' : 'recently')
    : '';
  badge.textContent = base + sync + extra;
}

async function fetchManifest() {
  const r = await fetch(MANIFEST_URL + '?t=' + Date.now(), { cache: 'no-store' });
  if (r.status === 404) return [];
  if (!r.ok) throw Object.assign(new Error('bad status ' + r.status), { status: r.status });
  return r.json();
}

/* Single merge path (previously duplicated between the initial loader and
   refreshManifest with subtly different rules). Validates each entry, dedupes
   against the catalog AND within the manifest itself, prepends fresh entries,
   and returns how many were added. */
export function mergeManifest(uploads) {
  if (!Array.isArray(uploads)) return 0;
  const existingSrc = new Set(DATA.videos.map(v => v.src));
  const existingIds = new Set(DATA.videos.map(v => v.id));
  const fresh = [];

  for (const v of uploads) {
    if (!v || typeof v !== 'object') continue;
    if (typeof v.src !== 'string' || !v.src) continue;
    if (existingSrc.has(v.src)) continue;
    const id = Number(v.id);
    if (!Number.isFinite(id) || existingIds.has(id)) continue;
    if (typeof v.title !== 'string') continue;

    fresh.push({ ...v, id });
    existingSrc.add(v.src);
    existingIds.add(id);
  }

  if (fresh.length) DATA.videos.unshift(...fresh);
  return fresh.length;
}

/* Initial load: best-effort, console-only errors, minimal re-render. */
export async function syncManifestOnLoad() {
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
