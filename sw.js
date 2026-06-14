// Famiglia service worker (OPEN-8). Caches the app shell for offline use and
// runtime-caches Google Fonts. Bump CACHE to invalidate after a deploy.
const CACHE = 'famiglia-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-512-maskable.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App navigations: serve the cached shell, fall back to network.
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then((r) => r || fetch(req).catch(() => caches.match('./')))
    );
    return;
  }

  // Same-origin assets: cache first, then network (and cache the result).
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((r) =>
        r || fetch(req).then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return resp;
        }).catch(() => caches.match('./index.html'))
      )
    );
    return;
  }

  // Cross-origin (fonts): network first, fall back to cache.
  e.respondWith(
    fetch(req).then((resp) => {
      const copy = resp.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return resp;
    }).catch(() => caches.match(req))
  );
});
