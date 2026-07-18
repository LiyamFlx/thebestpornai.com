/* thebestpornai service worker — installable PWA, but content-fresh.
 *
 * Strategy:
 *   - HTML documents (navigations): NETWORK-FIRST — always try the network so
 *     new deploys / new videos show immediately; fall back to cache only when
 *     offline. This prevents the "stale shell shows old catalog" problem.
 *   - Hashed static assets (/assets/*.js|css, images): cache-first — safe
 *     because their filename changes when content changes.
 *   - R2 media, manifest.json, Supabase API: never touched (network-only).
 *
 * Bump CACHE_VERSION on any strategy change to force a clean slate.
 */
const CACHE_VERSION = "v2";

const NO_CACHE_HOSTS = [
  "pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev",
  "f0094d08f5ce974044087c377652c2ad.r2.cloudflarestorage.com",
  "dabfxysxcngijcxxekzc.supabase.co",
];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;             // R2/Supabase/etc → network as-is
  if (NO_CACHE_HOSTS.some((h) => url.hostname === h)) return;

  const isDoc = req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isDoc) {
    // NETWORK-FIRST for HTML so content is always current; cache is offline fallback.
    e.respondWith(
      fetch(req)
        .then((res) => { caches.open(CACHE_VERSION).then((c) => c.put(req, res.clone())); return res; })
        .catch(() => caches.match(req).then((c) => c || caches.match("/")))
    );
    return;
  }

  // Hashed assets: cache-first (filename changes on new content, so it's safe).
  e.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => {
        if (res && res.status === 200) caches.open(CACHE_VERSION).then((c) => c.put(req, res.clone()));
        return res;
      })
    )
  );
});
