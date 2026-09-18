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
  './icon-512.png',
  './screenshot-mobile.png',
  './screenshot-desktop.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED' })))
  );
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

// Tapping "✓ Mark Complete" (or the notification itself) just dismisses it.
// The notification is already recorded as sent in the app's own persisted
// log the moment it was shown, so it won't be sent again today regardless —
// this button is there so the person has a clear, deliberate way to
// acknowledge and clear it, rather than only being able to "snooze" it.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'complete' || !event.action) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        if (clients.length > 0) return clients[0].focus();
      })
    );
  }
});
