/* Service worker for /lukepwa. Scope is /lukepwa, so it never intercepts the
 * rest of the site. Goal for tonight: cache the app shell so an installed
 * launch renders even on a flaky venue connection. NOT an offline data layer —
 * tag/publish/delete actions still require a live connection (by design).
 */
const CACHE = 'lukepwa-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;      // never touch Supabase / storage
  if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/realtime/')) return;

  // Network-first, fall back to cache. Keeps the shell fresh when online,
  // still boots when offline.
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(request);
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = await caches.match('/lukepwa');
          if (shell) return shell;
        }
        throw err;
      }
    })(),
  );
});
