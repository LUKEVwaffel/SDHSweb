/* Service worker for /rhea — the public event viewer. Scope is /rhea, so it
 * never touches the rest of the site. Caches the app shell so an installed
 * launch renders instantly on venue wifi. Photo requests and Supabase calls
 * always go to the network (never stale). */
const CACHE = 'rhea-shell-v1';

self.addEventListener('install', () => { self.skipWaiting(); });

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
  if (url.origin !== self.location.origin) return;          // Supabase / storage
  if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/realtime/')) return;

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
          const shell = await caches.match('/rhea');
          if (shell) return shell;
        }
        throw err;
      }
    })(),
  );
});
