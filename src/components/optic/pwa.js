// Hand-rolled PWA wiring (no vite-plugin-pwa, zero build-config change). The
// manifest + apple meta tags are injected on mount rather than living in
// index.html, because this is a single-index SPA and each installable route
// (/lukepwa for Luke, /optic for the public viewer) must advertise ITS OWN app
// identity — only while that route is mounted.

const THEME = '#06101F';
const APPLE_ICON = '/optic-icon-apple-180.png';

function headTags({ ns, manifest, appleTitle }) {
  return [
    { tag: 'link', attrs: { rel: 'manifest', href: manifest }, key: `${ns}-manifest` },
    { tag: 'meta', attrs: { name: 'theme-color', content: THEME }, key: `${ns}-theme` },
    { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' }, key: `${ns}-apple-cap` },
    { tag: 'meta', attrs: { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }, key: `${ns}-apple-bar` },
    { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: appleTitle }, key: `${ns}-apple-title` },
    // Appended after index.html's global apple-touch-icon so iOS uses the OPTIC
    // mark for this route's home-screen icon (iOS takes the last one in <head>).
    { tag: 'link', attrs: { rel: 'apple-touch-icon', href: APPLE_ICON }, key: `${ns}-apple-icon` },
  ];
}

function registerPwa({ ns, manifest, swUrl, scope, appleTitle }) {
  // Only one manifest can be active. Drop any other route's before adding ours.
  document.head
    .querySelectorAll(`link[rel="manifest"][data-pwa]:not([data-pwa="${ns}-manifest"])`)
    .forEach((el) => el.remove());

  for (const { tag, attrs, key } of headTags({ ns, manifest, appleTitle })) {
    if (document.head.querySelector(`[data-pwa="${key}"]`)) continue;
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    el.setAttribute('data-pwa', key);
    document.head.appendChild(el);
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(swUrl, { scope }).catch((err) => {
      // Non-fatal — the app works without the SW, it just won't cache the shell.
      console.warn(`[pwa:${ns}] service worker registration failed:`, err);
    });
  }
}

/** Wire /lukepwa as an installable app. */
export function installPwaHooks() {
  registerPwa({
    ns: 'lukepwa',
    manifest: '/lukepwa.webmanifest',
    swUrl: '/lukepwa-sw.js',
    scope: '/lukepwa',
    appleTitle: 'OPTIC Console',
  });
}

/** Wire /optic as the installable public event viewer. */
export function installOpticPwaHooks() {
  registerPwa({
    ns: 'optic',
    manifest: '/optic.webmanifest',
    swUrl: '/optic-sw.js',
    scope: '/optic',
    appleTitle: 'OPTIC',
  });
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

// ── shared install-prompt capture ───────────────────────────────────────
// `beforeinstallprompt` fires once, early, and only ever hands you the event
// once — OpticOnboarding listens for it locally, but if the visitor skips
// onboarding before Chrome fires it (or comes back later, already onboarded)
// nobody is left listening. This module-scope singleton captures it once on
// page load and keeps it around so any component mounted later — like an
// install nudge shown in the main feed — can still trigger the native prompt.
let deferredInstallPrompt = null;
const installPromptListeners = new Set();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installPromptListeners.forEach((cb) => cb(e));
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installPromptListeners.forEach((cb) => cb(null));
  });
}

/** True once the browser has offered an installable-app prompt we can trigger on demand. */
export function hasInstallPrompt() {
  return !!deferredInstallPrompt;
}

/** Subscribe to install-prompt availability changes. Returns an unsubscribe fn. */
export function onInstallPromptChange(cb) {
  installPromptListeners.add(cb);
  return () => installPromptListeners.delete(cb);
}

/** Trigger the captured native install prompt. Returns 'accepted' | 'dismissed' | null. */
export async function promptInstall() {
  if (!deferredInstallPrompt) return null;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') deferredInstallPrompt = null;
  return outcome;
}
