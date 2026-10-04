/* thebestpornai Production Service Worker (v4)
 * Ensures high-speed shell caching while guaranteeing 100% catalog freshness.
 */

const CACHE_NAME = "streamhub-pwa-v4";

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

  // 1. Only handle GET requests with http or https protocol
  if (req.method !== "GET") return;
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // 2. Only intercept same-origin requests or Google Fonts (ignore Supabase, R2, external CDNs)
  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFont = url.hostname.includes("fonts.gstatic.com") || url.hostname.includes("fonts.googleapis.com");
  if (!isSameOrigin && !isGoogleFont) return;

  // 3. Never cache video streams, Range requests, or media downloads
  if (
    req.headers.get("range") ||
    url.pathname.endsWith(".mp4") ||
    url.pathname.endsWith(".webm") ||
    url.hostname.includes("r2.dev")
  ) {
    return;
  }

  // 4. Navigation & HTML: Network-First with Cache fallback.
  // ALWAYS resolves to a valid Response object to prevent "Failed to convert value to Response".
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      (async () => {
        try {
          const networkRes = await fetch(req);
          if (networkRes && networkRes.status === 200) {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy).catch(() => {})).catch(() => {});
          }
          return networkRes;
        } catch (_) {
          const cached = (await caches.match(req)) || (await caches.match("/")) || (await caches.match("/index.html"));
          if (cached) return cached;
          return new Response(
            "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'><title>Offline | TheBestPornAI</title><meta name='viewport' content='width=device-width,initial-scale=1'></head><body style='font-family:sans-serif;background:#0f0f13;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;'><div><h1>You are offline</h1><p>Check your internet connection and try again.</p><button onclick='location.reload()' style='background:#ff3366;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:16px;'>Retry</button></div></body></html>",
            {
              status: 503,
              statusText: "Service Unavailable",
              headers: { "Content-Type": "text/html; charset=utf-8" },
            }
          );
        }
      })()
    );
    return;
  }

  // 5. Static assets (hashed JS, CSS, fonts, images): Cache-First with Network fallback.
  // Guaranteed to resolve to a valid Response.
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".avif") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".woff2") ||
    isGoogleFont
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const networkRes = await fetch(req);
          if (networkRes && networkRes.status === 200) {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy).catch(() => {})).catch(() => {});
          }
          return networkRes;
        } catch (_) {
          return new Response(null, { status: 404, statusText: "Not Found" });
        }
      })()
    );
    return;
  }

  // 6. Dynamic / API / other requests: do not call respondWith.
  // The browser will handle them naturally with standard network fetch.
});
