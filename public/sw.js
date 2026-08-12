/* thebestpornai Production Service Worker (v3)
 * Ensures high-speed shell caching while guaranteeing 100% catalog freshness.
 */

const CACHE_NAME = "streamhub-pwa-v3";

const STATIC_PRECACHE = [
  "/",
  "/favicon-32.png",
  "/favicon-64.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/site.webmanifest",
  "/logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_PRECACHE))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn("SW precache failed:", err))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return;
  }

  // 1. Only handle GET requests with http or https protocol (ignore chrome-extension:, moz-extension:, blob:, etc.)
  if (req.method !== "GET") return;
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // 2. Never cache video streams or Range requests (R2 / .mp4 media)
  if (
    req.headers.get("range") ||
    url.pathname.endsWith(".mp4") ||
    url.pathname.endsWith(".webm") ||
    url.hostname.includes("r2.dev")
  ) {
    return;
  }

  // 3. Navigation & HTML: Network-First with Cache fallback
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200 && (url.protocol === "http:" || url.protocol === "https:")) {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy).catch(() => {})).catch(() => {});
          }
          return networkRes;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // 4. Static assets (hashed JS, CSS, fonts, images): Cache-First with Network fallback
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".avif") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".woff2") ||
    url.hostname.includes("fonts.gstatic.com")
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200 && (url.protocol === "http:" || url.protocol === "https:")) {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy).catch(() => {})).catch(() => {});
          }
          return networkRes;
        });
      })
    );
    return;
  }

  // 5. Default Network-First
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
