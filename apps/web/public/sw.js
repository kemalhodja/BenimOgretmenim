/* Minimal service worker for basic offline + faster repeat visits. */
const CACHE_NAME = "benimogretmenim-pwa-v4";

// "/" precache kaldırıldı — API JSON döneminde bozuk cache beyaz sayfa yapıyordu.
const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/uygulama",
  "/brand-mark.svg",
  "/icon-192",
];

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

  const accept = req.headers.get("accept") ?? "";
  const isDocument = req.mode === "navigate" || accept.includes("text/html");

  if (isDocument) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((c) => c ?? Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          try {
            const url = new URL(req.url);
            const type = res.headers.get("content-type") ?? "";
            if (
              url.origin === self.location.origin &&
              res.ok &&
              !type.includes("application/json")
            ) {
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

