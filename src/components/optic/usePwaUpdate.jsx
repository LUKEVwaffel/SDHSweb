import { useState, useEffect } from 'react';

// Detect when a newer build has been deployed while the installed PWA is
// running. The service workers (rhea-sw.js / lukepwa-sw.js) already call
// skipWaiting() + clients.claim(), and their fetch handler is network-first,
// so a plain reload always pulls the fresh, content-hashed bundle. All this
// hook does is notice the new version and let the UI offer a one-tap reload
// instead of the parent sitting on stale code with no signal that anything
// changed.
//
// Bad-signal safe: reg.update() failures are swallowed; the app keeps running
// on the last cached shell and simply never raises the prompt.

const CHECK_EVERY_MS = 60_000;

export function usePwaUpdate() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;

    let cancelled = false;
    let intervalId;

    const flag = () => { if (!cancelled) setUpdateReady(true); };

    const watchWorker = (worker) => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        // 'installed' while a controller already exists == this is an update,
        // not the very first install.
        if (worker.state === 'installed' && navigator.serviceWorker.controller) flag();
      });
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (cancelled || !reg) return;
      if (reg.waiting && navigator.serviceWorker.controller) flag();
      watchWorker(reg.installing);
      reg.addEventListener('updatefound', () => watchWorker(reg.installing));
      // A PWA left open all day won't navigate, so poll for a new SW.
      intervalId = setInterval(() => { reg.update().catch(() => {}); }, CHECK_EVERY_MS);
    }).catch(() => {});

    // The new SW has taken control — the next reload serves fresh assets.
    const onControllerChange = () => flag();
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return updateReady;
}

/**
 * One-tap "new version" bar. Fixed to the bottom so it never shoves layout.
 * Rendered only when `updateReady` is true.
 */
export function PwaUpdateBar({ show }) {
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      style={{
        position: 'fixed', left: '50%', bottom: 14, transform: 'translateX(-50%)',
        zIndex: 9999, maxWidth: 'calc(100vw - 24px)',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px', borderRadius: 999, border: '1px solid #C9A961',
        background: '#0A1628', color: '#F4ECD8', cursor: 'pointer',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12, letterSpacing: '0.06em',
        boxShadow: '0 10px 30px -8px rgba(0,0,0,0.6)',
      }}
    >
      <span aria-hidden="true">↻</span>
      UPDATE AVAILABLE — TAP TO REFRESH
    </button>
  );
}
