import FingerprintJS from '@fingerprintjs/fingerprintjs';

// Device-level identity for one-vote-per-category-per-device.
// Composite = FingerprintJS visitorId + a persisted localStorage nonce, so a
// cleared fingerprint still keeps stickiness within the same browser profile.
// Not bulletproof (incognito / different browser = new id) — acceptable for a
// JROTC photo contest per product decision.

const LS_KEY = 'tb_device_nonce';

let cached = null;
let inflight = null;

function localNonce() {
  let n = localStorage.getItem(LS_KEY);
  if (!n) {
    n = `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(LS_KEY, n);
  }
  return n;
}

/** Resolve a stable device fingerprint string. Cached after first call. */
export async function getDeviceId() {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    let visitorId = 'nofp';
    try {
      const fp = await FingerprintJS.load();
      const res = await fp.get();
      visitorId = res.visitorId;
    } catch {
      // FingerprintJS unavailable — fall back to the localStorage nonce alone.
    }
    cached = `${visitorId}.${localNonce()}`;
    return cached;
  })();

  return inflight;
}
