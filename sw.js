// Tempo offline support: keeps the app's own files on the device so it opens without a connection.
// Bump CACHE when FILES changes; activate deletes every other cache.
const CACHE = "tempo-v2";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png",
  "./fonts/space-grotesk-latin-500-normal.woff2", "./fonts/space-grotesk-latin-600-normal.woff2", "./fonts/space-grotesk-latin-700-normal.woff2"];
// cache: "reload" skips the browser's HTTP cache, so an install never stores a stale copy
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Only a real copy of a file is kept: not a 404, a 5xx, a captive-portal redirect or an opaque response
const keep = r => r && r.ok && r.type === "basic" && !r.redirected;
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // Network first for the page itself (so updates arrive). The saved app if the network fails or answers with an error
  // (Pages can 404 for a moment during a deploy); a redirect passes through untouched.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(r => {
      if (keep(r)) { const c = r.clone(); caches.open(CACHE).then(x => x.put("./index.html", c)); return r; }
      return r.status >= 400 ? caches.match("./index.html").then(hit => hit || r) : r;
    }, () => caches.match("./index.html")));
    return;
  }
  // Everything else: the saved copy at once, refreshed in the background (stale-while-revalidate) so icon, font and manifest updates arrive
  const fresh = fetch(req).then(r => { if (keep(r)) { const c = r.clone(); return caches.open(CACHE).then(x => x.put(req, c)).then(() => r); } return r; });
  e.respondWith(caches.match(req).then(hit => hit || fresh));
  e.waitUntil(fresh.catch(() => {}));
});
