/* Service worker Sanitech — application 100 % hors-ligne.
   Toutes les ressources locales sont mises en cache au premier chargement. */
const CACHE = 'sanitech-v3.2.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './css/components.css',
  './css/pages.css',
  './css/print.css',
  './js/vendor/sql-wasm.js',
  './js/vendor/sql-wasm-b64.js',
  './js/vendor/jsqr.js',
  './js/helpers.js',
  './js/ui.js',
  './js/db.js',
  './js/state.js',
  './js/qr.js',
  './js/auth.js',
  './js/nav.js',
  './js/pointage.js',
  './js/scanner.js',
  './js/users.js',
  './js/logs.js',
  './js/requests.js',
  './js/stats.js',
  './js/exports.js',
  './js/settings.js',
  './js/app.js',
  './fonts/samsungone-400.woff2',
  './fonts/samsungone-600.woff2',
  './fonts/samsungone-700.woff2',
  './fonts/samsungone-800.woff2',
  './fonts/material-symbols-rounded.woff2',
  './assets/logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const reqUrl = new URL(e.request.url);
  if (reqUrl.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => { });
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
