// Offline support.
// App files: network first (so updates show up right away), falling back to the saved copy when offline.
// Photos: cache first (they never change).
const SHELL = "rockhound-shell-v3";
const IMG = "rockhound-img-v1";
const FILES = ["./", "index.html", "css/app.css", "manifest.webmanifest",
  "js/app.js", "js/data.js", "js/lessons.js", "js/math.js", "js/shapes.js", "js/store.js", "js/sync.js", "js/credits.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== IMG).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.includes("/img/")) {
    e.respondWith(caches.open(IMG).then(async c =>
      (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })));
    return;
  }
  e.respondWith(caches.open(SHELL).then(c =>
    fetch(e.request, { cache: "no-cache" })
      .then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })
      .catch(async () => (await c.match(e.request, { ignoreSearch: true })) || c.match("index.html"))));
});
