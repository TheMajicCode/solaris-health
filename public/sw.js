// Solaris Health service worker.
//
// IMPORTANT — why this is network-first for HTML:
// A cache-first strategy on the app shell (/, /index.html) pins the browser to a
// stale index.html that references an old, content-hashed JS bundle. After every
// redeploy that old bundle filename no longer exists on the server → 404 → the app
// never mounts → blank screen. This recurred on each deploy. Navigations therefore
// MUST be network-first so the freshly deployed index.html (which points at the
// current bundle) is always used; the cached shell is only a last-resort offline
// fallback. Hashed static assets remain cache-first (they are immutable).
const CACHE_NAME = 'solaris-v9';
const SHELL_URL = '/index.html';

self.addEventListener('install', () => {
  // Take over as soon as installed — don't wait for old tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // API calls: always network, with a friendly offline JSON fallback. Never cached.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(JSON.stringify({ error: 'You are offline. Please reconnect to continue.' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 503,
          })
      )
    );
    return;
  }

  const isHtml = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  // Navigations / HTML: NETWORK-FIRST. Always fetch fresh index.html so it points at
  // the current bundle. Cache a copy for offline; fall back to it only if the network fails.
  if (isHtml) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(SHELL_URL, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(SHELL_URL).then((c) => c || caches.match('/')))
    );
    return;
  }

  // Static assets (hashed JS/CSS/img/fonts): cache-first, populate cache at runtime.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
    )
  );
});


// ---------------------------------------------------------------------------
// Web Push. Payloads are generated server-side from generic, PHI-free
// templates ("You have a new secure message") — never message or health
// content. `data.url` tells us which page to open on click.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    if (event.data) payload = event.data.json() || {};
  } catch {
    /* malformed payload — fall back to generic copy */
  }
  const title = payload.title || 'Solaris Health';
  const body = payload.body || 'You have a new notification.';
  const url = payload.url || '/';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing Solaris tab (navigating it to the target page) if we
      // have one; otherwise open a new window.
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
