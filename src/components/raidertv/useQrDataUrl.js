import { useState, useEffect } from 'react';

// Client-side QR, same dynamic-import pattern as RaiderParentWelcome.jsx —
// no storage round-trip. Used on /raidertv so a phone can scan straight into
// /raiderremote?code=XXXXXX instead of typing the pair code.
export function useQrDataUrl(value) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (!value) { setSrc(null); return undefined; }
    let cancelled = false;
    import('qrcode')
      .then(({ toDataURL }) =>
        toDataURL(value, { margin: 1, width: 420, color: { dark: '#06101F', light: '#F4ECD8' } }),
      )
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setSrc(null); });
    return () => { cancelled = true; };
  }, [value]);
  return src;
}
