// 记录记录 offline cache. Bump VERSION when files change.
const VERSION = 'jilu-v4';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  // cache:'reload' skips the browser's HTTP cache so a new version really is new
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // The page itself: try the network first (3 s), fall back to the cached copy when offline.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 3000);
        const res = await fetch(req, {cache: 'no-store', signal: ctl.signal}); clearTimeout(t);
        if (res && res.ok) { cache.put('./index.html', res.clone()); return res; }
      } catch (_) {}
      return (await cache.match('./index.html')) || (await cache.match(req, {ignoreSearch: true})) ||
        new Response('离线中，且没有缓存', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
    })());
    return;
  }
  // Icons and manifest: cache first, refresh in the background.
  e.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(req, {ignoreSearch: true});
    const network = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    return cached || (await network) || new Response('', {status: 504});
  }));
});
