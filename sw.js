// Service worker for Zman & Luach — Kiryas Joel offline clock/calendar
//
// Strategy: NETWORK-FIRST for every request.
//   - If the tablet has internet (e.g., family visiting with Wi-Fi), it
//     always fetches the newest version of every file and quietly updates
//     the offline cache in the background. So any change you make and
//     re-upload is picked up the very next time the tablet is online —
//     never a month-long delay.
//   - If there is no internet, it instantly falls back to whatever was
//     last successfully loaded, so the clock keeps working offline exactly
//     as before.

const CACHE_NAME = 'zman-luach-cache';
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
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('./index.html'))
      )
  );
});
