/*
 * Workora app-shell service worker.
 *
 * Installability only requires an activated worker with a fetch handler.
 * We deliberately do NOT cache HTML, API responses or authenticated pages —
 * that data is session-specific and must always come from the network.
 * Only immutable static assets get a stale-while-revalidate cache.
 */

const CACHE_NAME = "workora-static-v1";
const STATIC_PATH = /^\/(?:_next\/static\/|icon-|apple-touch-icon|favicon\.ico|manifest\.webmanifest)/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(["/icon-192.png", "/icon-512.png"]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;
  if (!STATIC_PATH.test(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => cached);

      return cached ?? network;
    }),
  );
});
