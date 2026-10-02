const VERSION = 'japan-2026-v2';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    const list = await (await fetch('assets.json', { cache: 'reload' })).json();
    // En i taget: en enda 404 skulle annars avbryta hela installationen.
    for (const url of list) {
      try { await cache.add(new Request(url, { cache: 'reload' })); }
      catch (err) { console.warn('Hoppade över', url, err); }
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // kartlänkar m.m. lämnas åt nätet

  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
      return res;
    } catch (err) {
      // Navigeringar utan nät får appskalet
      if (req.mode === 'navigate') return caches.match('./index.html');
      throw err;
    }
  })());
});
