// Cache the static app shell. Model file caching is managed by Transformers.js.
// Works with manual static deployments and relative asset URLs.
const CACHE = 'ttt-shell-__VERSION__';
const ROOT = new URL('./', self.registration.scope);
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const manifest = await fetch(new URL('precache.json', ROOT), { cache: 'no-store' });
    if (!manifest.ok) throw new Error('App manifest unavailable');
    const files = await manifest.json();
    const urls = [ROOT.href, ...files.map((path) => new URL(path, ROOT).href)];
    const cache = await caches.open(CACHE);
    await cache.addAll(urls);
  })());
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('ttt-shell-') && key !== CACHE).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(ROOT.href, response.clone()));
      return response;
    }).catch(() => caches.match(ROOT.href)));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  })));
});
