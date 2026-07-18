/* KILL SWITCH — this service worker unregisters itself and deletes all caches.
 *
 * The previous SW cached the app shell and served stale HTML/catalog bundles,
 * so newly published videos never appeared. This version does the opposite:
 * on install/activate it wipes every cache and unregisters itself, then reloads
 * open pages so the browser goes back to fetching everything fresh from the
 * network. After this deploys, no service worker controls the site.
 */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // delete every cache this origin has
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    // stop controlling the site
    await self.registration.unregister();
    // force-reload any open tabs so they refetch fresh
    const clients = await self.clients.matchAll({ type: "window" });
    for (const client of clients) { try { client.navigate(client.url); } catch (_) {} }
  })());
});

// Pass everything straight through to the network — cache nothing.
self.addEventListener("fetch", () => {});
