// Service worker for Zman & Luach — Kiryas Joel offline clock/calendar
// Cache-first strategy: once installed, the app works with zero network access.
// Bump CACHE_VERSION any time you edit the app files and want the tablet to
// pick up the changes the next time it's online (via the Sync button, or
// automatically the next time the service worker checks for updates).

const CACHE_VERSION = 'zman-luach-v1';
const APP_SHELL = [
  './',
  './index.html',
  './engine.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Cache-first, falling back to network (and caching the result) — and if
  // both fail (fully offline, first load of something new), fall back to
  // the cached index.html so the app shell always renders.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && event.request.method === 'GET') {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
