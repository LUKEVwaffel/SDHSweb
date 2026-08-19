import { useEffect, useRef, useState } from 'react';

// Kiosks stay open on the same tab for days — a new deploy ships new JS/CSS
// under new hashed /assets/ filenames, but the tab keeps running whatever it
// loaded at boot until someone refreshes it. This polls the server's actual
// index.html and compares its hashed asset filenames against what this tab
// loaded, so a stale kiosk can tell the person standing in front of it that
// it's showing old code/content instead of silently drifting.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

function assetSignature(html) {
  const matches = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)];
  return matches.map((m) => m[1]).sort().join('|');
}

export function useTvRefreshNotice() {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const bootSignature = useRef(null);

  useEffect(() => {
    // What THIS tab actually has loaded right now, not a re-fetch — filtered
    // to the same /assets/ pattern as assetSignature() so third-party tags
    // injected into <head> after mount (PostHog's loader adds several) never
    // count as a mismatch. In dev (unbundled, no hashed /assets/) this is
    // empty, which harmlessly disables the check below.
    bootSignature.current = assetSignature(document.documentElement.outerHTML);

    if (!bootSignature.current) return;

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch('/', { cache: 'no-store' });
        const html = await res.text();
        const latest = assetSignature(html);
        if (!cancelled && latest && latest !== bootSignature.current) {
          setNeedsRefresh(true);
        }
      } catch {
        // Offline or blocked — try again next tick, say nothing meanwhile.
      }
    }

    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return needsRefresh;
}
