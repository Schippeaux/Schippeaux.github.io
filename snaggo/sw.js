// Snaggo — offline cache for the app shell.
//
// IMPORTANT: a browser only re-checks a service worker for updates when
// this file's bytes change. Bump js/version.js's SNAGGO_VERSION on every
// release that ships — it's importScripts()'d below into CACHE_NAME, so
// that one edit is enough to (a) change this file's bytes, which makes the
// browser notice and install the new worker, and (b) get a fresh cache
// name, so install() repopulates it from the network and activate() drops
// the old one. Forgetting this step is why a deployed change can silently
// not show up on a device that already has Snaggo open/installed — not an
// edge-cache delay, a stuck old service worker serving its old cache
// forever, because cache-first never has a reason to go fetch again.
//
// Strategy: same-origin app files (html/css/js/manifest/icons) are
// network-first, falling back to cache only when offline — so a shipped
// change reaches you immediately whenever you have signal, and the cache
// only matters as a fallback with no signal on-site. Cross-origin CDN
// libraries are cache-first, since their URLs are pinned to an exact
// version and will never change under the same URL.

importScripts('js/version.js');
const CACHE_NAME = `snaggo-shell-${SNAGGO_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/version.js',
  './js/db.js',
  './js/media.js',
  './js/export.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        ASSETS.map((url) =>
          fetch(url, { cache: 'no-store' })
            .then((res) => cache.put(url, res))
            .catch(() => {})
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const isSameOrigin = new URL(event.request.url).origin === self.location.origin;

  if (isSameOrigin) {
    // Network-first: always serve the latest deployed code when there's a
    // connection; fall back to whatever's cached only when the fetch fails
    // (no signal on-site).
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cross-origin CDN libraries: cache-first, URL is pinned to a version.
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
            return res;
          })
      )
    );
  }
});
