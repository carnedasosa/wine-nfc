const CACHE_NAME = 'vino-passport-static-v7-fiera';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css?v=4',
  '/app.js',
  '/manifest.json',
  '/src/api.js',
  '/src/outbox.js',
  '/src/router.js',
  '/src/state.js',
  '/src/utils.js',
  '/src/ui/dna.js',
  '/src/ui/home.js',
  '/src/ui/leaderboard.js',
  '/src/ui/onboarding.js',
  '/src/ui/settings.js',
  '/src/ui/tutorial.js',
  '/src/ui/wine.js'
];

// L'aggiornamento si attiva quando le vecchie schede vengono chiuse: nessun reload durante un voto.
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('vino-passport-') && key !== CACHE_NAME).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  // Solo il grafo statico installato insieme, mai dati personali o risposte API.
  const asset = event.request.mode === 'navigate' && ['/', '/index.html'].includes(url.pathname)
    ? '/index.html' : url.pathname + url.search;
  if (!ASSETS_TO_CACHE.includes(asset)) return;
  event.respondWith(caches.open(CACHE_NAME).then(async cache => (await cache.match(asset)) || fetch(event.request)));
});
