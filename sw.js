// Generated alongside the bundles; changes to this import also update the worker.
importScripts('./assets/precache.js');
const ROOT = new URL('./', self.registration.scope);
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const urls = [ROOT.href, ...FILES.map((path) => new URL(path, ROOT).href)];
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
  if (request.mode === 'navigate' && [ROOT.href, new URL('index.html', ROOT).href].includes(request.url.split('?')[0])) {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok) await (await caches.open(CACHE)).put(ROOT.href, response.clone());
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
