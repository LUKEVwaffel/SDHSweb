/* Service worker for /optic — the public event viewer. Scope is /optic, so it
 * never touches the rest of the site. Caches the app shell so an installed
 * launch renders instantly on venue wifi. Photo requests and Supabase calls
 * always go to the network (never stale). */
const CACHE = 'optic-shell-v1';

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
          const shell = await caches.match('/optic');
          if (shell) return shell;
        }
        throw err;
      }
    })(),
  );
});

// ── web push ──────────────────────────────────────────────────────────────
// Payload sent by supabase/functions/optic-send-push: { title, body, url }.
// A malformed/empty payload still shows a generic notification rather than
// silently doing nothing (a push with no visible notification gets browsers
// to revoke permission after enough occurrences).
self.addEventListener('push', (event) => {
  let data = { title: 'OPTIC', body: 'New photos are up.', url: '/optic' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch { /* plain text payload */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/optic-icon-192.png',
      badge: '/optic-icon-192.png',
      data: { url: data.url || '/optic' },
      tag: 'optic-photos', // collapses rapid-fire sends into one notification
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/optic';
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = clientsList.find((c) => c.url.includes('/optic'));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })(),
  );
});
