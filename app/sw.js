// Offline support: keep a copy of the app files so iTIMS opens with no connection.
// Files refresh in the background; bump VERSION to clear old copies after a big change.
const VERSION = 'itims-1.0.0';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/db.js', 'js/schema.js', 'js/store.js', 'js/ui.js', 'js/util.js', 'js/sample.js',
  'js/views/csvio.js', 'js/views/dashboard.js', 'js/views/device.js', 'js/views/floorplan.js', 'js/views/form.js',
  'js/views/labels.js', 'js/views/photos.js', 'js/views/reports.js', 'js/views/scan.js', 'js/views/settings.js',
  'vendor/qrcode.js', 'vendor/jsQR.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Serve the saved copy at once (works offline), and refresh it in the background
// so the next launch gets any update.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const fresh = fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  });
  e.waitUntil(fresh.then(() => {}, () => {}));
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fresh.catch(() =>
    (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
