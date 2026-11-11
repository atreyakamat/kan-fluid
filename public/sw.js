/* Kan service worker — installable app shell + graceful offline.
 *
 * Strategies
 *   • App shell (index/styles/app/icons/manifest): stale-while-revalidate
 *   • Navigations: network-first, fall back to the cached shell when offline
 *   • /api GET requests: network-first, fall back to the last successful JSON
 *
 * Bump CACHE_VERSION whenever you ship changed static assets so every
 * client picks up the new shell on its next visit.
 */
const CACHE_VERSION = 'v2';
const SHELL_CACHE = `kan-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `kan-runtime-${CACHE_VERSION}`;
const API_CACHE = `kan-api-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, RUNTIME_CACHE, API_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function cacheableJson(response) {
  return response && response.ok && response.type === 'basic' ? response : null;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network first so logins/updates always hit the server,
  // cached shell when the network is unavailable.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  // API: never serve stale mutations, but remember successful GETs.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          const ok = await cacheableJson(response);
          if (ok) {
            const cache = await caches.open(API_CACHE);
            cache.put(request, ok.clone());
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return (
            cached ||
            new Response(JSON.stringify({ error: 'You are offline — showing cached data.' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }),
    );
    return;
  }

  // Static shell: serve fast from cache, refresh in the background.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
