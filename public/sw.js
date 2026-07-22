const CACHE_NAME = 'solaris-v1';
const SHELL_ASSETS = ['/', '/index.html'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle GET requests; let the browser handle everything else.
  if (req.method !== 'GET') return;

  // Network-first for API calls, with a friendly offline JSON fallback.
  if (req.url.includes('/api/')) {
    event.respondWith(
      fetch(req).catch(() =>
        new Response(
          JSON.stringify({ error: 'You are offline. Please reconnect to continue.' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        )
      )
    );
    return;
  }

  // Cache-first for the app shell / static assets, falling back to network.
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});
