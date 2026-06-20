// File: public/sw.js
// Your Pool Mate — service worker
//
// Strategy (deliberately conservative):
//   - Navigations: network-first, fall back to cached app shell when offline.
//   - Same-origin static assets (js/css/svg/png/fonts): stale-while-revalidate.
//   - Everything else (Supabase API, Stripe, cross-origin): never intercepted.
//
// Bump CACHE_VERSION on any release that changes cached assets — old caches
// are deleted on activate.

const CACHE_VERSION = 'ypm-v2-crystal-clear';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/logo.svg', '/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase/Stripe

  // Navigations: network-first with shell fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/').then((c) => c || caches.match('/index.html')))
    );
    return;
  }

  // Static assets: stale-while-revalidate
  if (/\.(js|css|svg|png|jpg|jpeg|webp|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
