import { useEffect } from 'react';

/**
 * Kiosk anti-sleep for the wall-mounted TV PCs.
 *
 * The display machine dozes off on the plain web kiosk but never during a
 * PowerPoint slideshow — because active media playback makes the OS hold a
 * "prevent display sleep" power assertion. This hook recreates that, plus the
 * modern API, in three best-effort layers (no dependencies):
 *
 *   1. Screen Wake Lock API — the real fix on Chrome/Edge. The lock is dropped
 *      whenever the tab is hidden, so it is re-acquired on visibilitychange and
 *      on the slow activity tick below.
 *   2. A muted, looping, ~1fps canvas-capture <video> that is genuinely
 *      playing. This is the PowerPoint trick: a playing <video> makes the
 *      browser take the same OS assertion, covering browsers without Wake Lock
 *      and OSes that still sleep the panel with only Wake Lock held.
 *   3. A low-frequency synthetic mousemove + a 1px off-screen node that nudges
 *      its transform. A browser cannot move the real OS cursor (security), so
 *      this only defeats in-page screensavers/idle timers — layer 2 is what
 *      actually keeps the monitor on. Kept as cheap insurance.
 *
 * Every layer is wrapped so an unsupported/blocked API degrades to the next.
 */
export function useStayAwake(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    let wakeLock = null;

    const acquireWakeLock = async () => {
      if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener?.('release', () => { wakeLock = null; });
      } catch {
        // Denied or unsupported — the video layer below carries it.
        wakeLock = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquireWakeLock();
    };

    acquireWakeLock();
    document.addEventListener('visibilitychange', onVisibility);

    // --- Layer 2: an actually-playing video holds the OS awake assertion ---
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext('2d');
    let frame = 0;
    const paint = () => {
      if (!ctx) return;
      frame = (frame + 1) % 2;
      ctx.fillStyle = frame ? '#000000' : '#010101';
      ctx.fillRect(0, 0, 2, 2);
    };
    paint();

    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    Object.assign(video.style, {
      position: 'fixed', right: '0', bottom: '0',
      width: '1px', height: '1px', opacity: '0', pointerEvents: 'none',
    });

    let stream = null;
    try {
      stream = canvas.captureStream(1);
      video.srcObject = stream;
      document.body.appendChild(video);
      const played = video.play();
      if (played && typeof played.catch === 'function') played.catch(() => {});
    } catch {
      // captureStream unsupported — Wake Lock + layer 3 remain.
    }
    const paintTimer = window.setInterval(paint, 1000);

    // --- Layer 3: synthetic activity for in-page idle timers ---
    const nudge = document.createElement('div');
    Object.assign(nudge.style, {
      position: 'fixed', top: '0', left: '0',
      width: '1px', height: '1px', opacity: '0', pointerEvents: 'none',
    });
    document.body.appendChild(nudge);

    let step = 0;
    const activityTimer = window.setInterval(() => {
      step = (step + 1) % 2;
      nudge.style.transform = `translate3d(${step}px, ${step}px, 0)`;
      try {
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: step, clientY: step }));
      } catch {
        // Ignore — synthetic event construction unsupported.
      }
      if (!wakeLock) acquireWakeLock();
    }, 20000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(paintTimer);
      window.clearInterval(activityTimer);
      try { wakeLock?.release?.(); } catch { /* already released */ }
      wakeLock = null;
      try { video.pause(); } catch { /* not playing */ }
      stream?.getTracks?.().forEach((track) => track.stop());
      video.srcObject = null;
      video.remove();
      nudge.remove();
    };
  }, [enabled]);
}
