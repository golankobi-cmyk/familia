// Famiglia service worker. The app shell (index.html) is served NETWORK FIRST,
// so a fresh deploy is picked up immediately whenever the device is online. The
// cache becomes a pure offline fallback. Other same-origin assets are served
// stale-while-revalidate: cache for speed, refreshed in the background. Because
// of this, CACHE no longer needs bumping on every deploy. Bump it only when you
// want to force a clean wipe of all previously cached assets.
const CACHE = 'famiglia-v2';
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

  // App navigations and the HTML shell: NETWORK FIRST. Always try the network so
  // the newest deployed index.html wins; fall back to cache only when offline.
  const isShell = req.mode === 'navigate' ||
    (url.origin === self.location.origin && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')));
  if (isShell) {
    e.respondWith(
      fetch(req).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
        return resp;
      }).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Same-origin assets: stale-while-revalidate. Serve cache immediately, fetch a
  // fresh copy in the background and update the cache for next time.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req).then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return resp;
        }).catch(() => cached);
        return cached || network;
      })
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
