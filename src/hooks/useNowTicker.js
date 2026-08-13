import { useState, useEffect, useRef } from 'react';

/** Reads the `?previewAt=<ISO>` query param (TV Remote's Preview Mode control) and returns the
 * offset from real time it represents, or 0 if absent/invalid. Real kiosks always load the bare
 * route with no query string, so this only ever fires in a tab an admin explicitly opened. */
function getPreviewOffsetMs() {
  if (typeof window === 'undefined') return 0;
  const previewAt = new URLSearchParams(window.location.search).get('previewAt');
  if (!previewAt) return 0;
  const parsed = Date.parse(previewAt);
  return Number.isNaN(parsed) ? 0 : parsed - Date.now();
}

export function getPreviewAt() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('previewAt');
}

/** Shared 1s-interval clock tick. One instance per consumer (cheap, no context needed at this
 * scale). When a preview offset is present, ticks forward in real time from that instant instead
 * of actual now — countdowns/phase transitions still animate naturally in a preview tab. */
export function useNowTicker() {
  const offsetRef = useRef(null);
  if (offsetRef.current === null) offsetRef.current = getPreviewOffsetMs();
  const [now, setNow] = useState(() => new Date(Date.now() + offsetRef.current));

  useEffect(() => {
    const id = setInterval(() => setNow(new Date(Date.now() + offsetRef.current)), 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}
