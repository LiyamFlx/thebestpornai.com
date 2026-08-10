/* KILL SWITCH — unregisters itself and deletes all caches.
 *
 * The previous SW cached the app shell and served stale HTML/catalog bundles,
 * so newly published videos never appeared. This version does the opposite:
 * on activate it wipes every cache and unregisters itself, then reloads open
 * pages so the browser fetches fresh from the network.
 *
 * Intentionally NO fetch handler — Chrome warns that empty fetch listeners
 * are no-ops and add navigation overhead ("Fetch event handler is recognized
 * as no-op").
 */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window" });
    for (const client of clients) {
      try { client.navigate(client.url); } catch (_) {}
    }
  })());
});
