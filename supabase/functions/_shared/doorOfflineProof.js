// The signature binds a reviewer to one decision on one station.
function message(station, operation) {
  const { id, kind, person_id, action, occurred_at, payload } = operation;
  return new TextEncoder().encode(JSON.stringify([
    'ball-door-2026', station, id, kind, person_id, action, occurred_at,
    payload.reviewer_id, payload.approved, payload.expected,
  ]));
}

const algorithm = { name: 'ECDSA', namedCurve: 'P-256' };
const signatureAlgorithm = { name: 'ECDSA', hash: 'SHA-256' };
const encode = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const decode = value => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));

export async function createReviewerCode() {
  const keys = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
  const { x, y, d } = await crypto.subtle.exportKey('jwk', keys.privateKey);
  return { publicKey: { kty: 'EC', crv: 'P-256', x, y }, code: d };
}

export async function signDoorReview(publicKey, code, station, operation) {
  const key = await crypto.subtle.importKey('jwk', { ...publicKey, d: code }, algorithm, false, ['sign']);
  return encode(new Uint8Array(await crypto.subtle.sign(signatureAlgorithm, key, message(station, operation))));
}

export async function verifyDoorReview(publicKey, signature, station, operation) {
  try {
    if (!/^[\w-]{86}$/.test(signature || '')) return false;
    const key = await crypto.subtle.importKey('jwk', publicKey, algorithm, false, ['verify']);
    return await crypto.subtle.verify(signatureAlgorithm, key, decode(signature), message(station, operation));
  } catch { return false; }
}
