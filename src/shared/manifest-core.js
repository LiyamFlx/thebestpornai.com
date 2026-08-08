/* Bunny/R2 manifest.json fetch + merge — the app-agnostic core shared by the
   viewer (auto-syncs on load + periodically) and creator studio (needs it so
   a freshly published upload survives a reload / shows in "Content" instead
   of only existing in that page session's in-memory DATA.videos.unshift()).
   No viewer-specific imports (router/render/state) — those stay in
   viewer/manifest-sync.js, which wraps this. */
import { DATA, fmt } from "./catalog.js";

export const MANIFEST_URL = "https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev/manifest.json";

export async function fetchManifest() {
  const r = await fetch(MANIFEST_URL + '?t=' + Date.now(), { cache: 'no-store' });
  if (r.status === 404) return [];
  if (!r.ok) throw Object.assign(new Error('bad status ' + r.status), { status: r.status });
  return r.json();
}

/* Validates each entry, dedupes against the catalog AND within the manifest
   itself (by both src and id — an id collision would hijack lookups), and
   prepends fresh entries to DATA.videos. Returns how many were added. */
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

export function videoCountLabel(lastSyncTs, extra = '') {
  const base = fmt(DATA.videos.length) + ' videos';
  const sync = lastSyncTs
    ? ' • synced ' + (Date.now() - lastSyncTs < 60000 ? 'just now' : 'recently')
    : '';
  return base + sync + extra;
}
