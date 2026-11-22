// Only a deliberately prepared check-in page installs an offline shell.
const SHELL = 'ball-checkin-shell-v1';
const CHECKIN = '/ball/checkin';

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('message', event => {
  if (event.data?.type !== 'prepare-ball-checkin') return;
  const port = event.ports[0];
  event.waitUntil((async () => {
    try {
      const shell = await fetch(CHECKIN, { cache: 'reload' });
      if (!shell.ok || !shell.headers.get('content-type')?.includes('text/html')) throw new Error('Could not download check-in page.');
      const html = await shell.clone().text();
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]);
      if (!assets.some(asset => asset.endsWith('.js'))) throw new Error('Offline preparation needs a production build.');
      const cache = await caches.open(SHELL);
      // Store the HTML last so every script and style it references is already available.
      await cache.addAll([...new Set(assets)]);
      await cache.put(CHECKIN, shell);
      port.postMessage({ ready: true });
    } catch (error) {
      port.postMessage({ error: error.message || 'Could not download check-in for offline use.' });
    }
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && (url.pathname === CHECKIN || url.pathname.startsWith(CHECKIN + '/'))) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      const saved = await cache.match(CHECKIN);
      if (!saved) return fetch(request);
      try {
        const response = await fetch(request, { signal: AbortSignal.timeout(2500) });
        return response.ok ? response : saved;
      } catch { return saved; }
    })());
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      // The same-origin, hashed build assets are prefetched by URL. Match that
      // URL so module requests carrying an Origin header use the same copy.
      return (await cache.match(url.pathname)) || fetch(request);
    })());
  }
});
