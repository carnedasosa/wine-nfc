const CACHE_NAME = 'vino-passport-static-v6-m2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/src/api.js',
  '/src/router.js',
  '/src/state.js',
  '/src/utils.js',
  '/src/ui/dna.js',
  '/src/ui/home.js',
  '/src/ui/leaderboard.js',
  '/src/ui/onboarding.js',
  '/src/ui/settings.js',
  '/src/ui/wine.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(cacheName => cacheName !== CACHE_NAME)
        .map(cacheName => caches.delete(cacheName))
    );
    await self.clients.claim();

    // Ponte di rollout M1: forza i client ancora caricati dalla cache JWT v3
    // a rileggere l'intero grafo ESM già installato atomicamente sopra.
    const clients = await self.clients.matchAll({ type: 'window' });
    await Promise.all(clients.map(client => (
      typeof client.navigate === 'function' ? client.navigate(client.url) : undefined
    )));
  })());
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-tastings') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'FLUSH_OUTBOX' });
        });
      })
    );
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/wines' && event.request.method === 'GET') {
      event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
          return cache.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
              if (networkResponse.ok) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            });
            return cachedResponse || fetchPromise;
          });
        })
      );
    }
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, response.clone());
          return response;
        });
      })
      .catch(() => {
        return caches.match(event.request, { ignoreSearch: true });
      })
  );
});
