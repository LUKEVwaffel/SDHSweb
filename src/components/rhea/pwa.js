// PWA wiring for /lukepwa. Hand-rolled (no vite-plugin-pwa) so tonight's build
// touches zero build config. The manifest + apple meta tags are injected on
// mount rather than living in index.html, because this is a single-index SPA
// and only this one route should advertise itself as an installable app.

const MANIFEST_HREF = '/lukepwa.webmanifest';
const SW_URL = '/lukepwa-sw.js';
const SW_SCOPE = '/lukepwa';

const HEAD_TAGS = [
  { tag: 'link', attrs: { rel: 'manifest', href: MANIFEST_HREF }, key: 'lukepwa-manifest' },
  { tag: 'meta', attrs: { name: 'theme-color', content: '#06101F' }, key: 'lukepwa-theme' },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' }, key: 'lukepwa-apple-cap' },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }, key: 'lukepwa-apple-bar' },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: 'OPTIC Rhea' }, key: 'lukepwa-apple-title' },
  // Appended after index.html's global apple-touch-icon so iOS uses the OPTIC
  // mark for this route's home-screen icon (iOS takes the last one in <head>).
  { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/optic-icon-apple-180.png' }, key: 'lukepwa-apple-icon' },
];

/** Inject the head tags + register the service worker. Returns a cleanup fn. */
export function installPwaHooks() {
  const added = [];
  for (const { tag, attrs, key } of HEAD_TAGS) {
    if (document.head.querySelector(`[data-lukepwa="${key}"]`)) continue;
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    el.setAttribute('data-lukepwa', key);
    document.head.appendChild(el);
    added.push(el);
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE }).catch((err) => {
      // Non-fatal — the app works fine without the SW, it just won't cache the
      // shell for offline load.
      console.warn('[lukepwa] service worker registration failed:', err);
    });
  }

  // Leave the tags in place on unmount — removing the manifest link mid-session
  // would break an in-progress "Add to Home Screen". They are keyed/idempotent.
  return () => {};
}

/** True when the page is running as an installed standalone app. */
export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}
