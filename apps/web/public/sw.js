/* Minimal service worker for basic offline + faster repeat visits. */
const CACHE_NAME = "benimogretmenim-pwa-v1";

// Keep this list small; Next will handle most assets with hashed filenames.
const PRECACHE_URLS = ["/", "/manifest.webmanifest", "/pwa-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Cache only same-origin, successful responses.
          try {
            const url = new URL(req.url);
            if (url.origin === self.location.origin && res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            }
          } catch {
            // ignore
          }
          return res;
        })
        .catch(() => cached);
    }),
  );
});

