/* thebestpornai service worker — app-shell caching for an installable PWA.
 *
 * Scope: ONLY the static app shell (HTML/CSS/JS + icons) is cached. R2 media,
 * the manifest.json feed, and Supabase API calls are always fetched fresh
 * (network-only) so content/likes/uploads are never stale. Bump CACHE_VERSION
 * to invalidate the shell after a deploy.
 */
const CACHE_VERSION = "shell-v1";
const SHELL = ["/", "/index.html"];

// Hosts whose responses must NEVER be cached (dynamic content / APIs).
const NO_CACHE_HOSTS = [
  "pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev",   // R2 media + manifest
  "f0094d08f5ce974044087c377652c2ad.r2.cloudflarestorage.com", // R2 S3 (uploads)
  "dabfxysxcngijcxxekzc.supabase.co",               // Supabase API
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                       // never touch POST/PUT (uploads, likes)
  const url = new URL(req.url);
  if (NO_CACHE_HOSTS.some((h) => url.hostname === h)) return;   // dynamic: let it go to network
  if (url.origin !== self.location.origin) return;         // only handle same-origin shell

  // Stale-while-revalidate for the static shell: serve cache fast, refresh in bg.
  e.respondWith(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req).then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    )
  );
});
