// PIN hashing for DISPATCH. PBKDF2-SHA256 via native Web Crypto — no external
// dependency, works on Deno Deploy. A 4-digit PIN is only 10k combinations, so
// the hash is NOT the primary defense (the server-side lockout is); this exists
// so a leaked DB row is not instantly plaintext, and to force per-guess work.
const ITERATIONS = 210_000;
const KEY_BITS = 256;

function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, KEY_BITS,
  );
  return new Uint8Array(bits);
}

// Constant-time comparison — never short-circuit on first mismatch.
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Format: pbkdf2$<iterations>$<salt_b64>$<hash_b64> — self-describing so the
// iteration count can be raised later without breaking old hashes.
export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPin(pin: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  try {
    const parts = stored.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
    const iterations = parseInt(parts[1], 10);
    if (!Number.isFinite(iterations) || iterations < 1) return false;
    // unb64/atob throw on malformed base64 — fail CLOSED to a uniform `false`
    // rather than letting a corrupt stored hash bubble up as a 500.
    const salt = unb64(parts[2]);
    const expected = unb64(parts[3]);
    const actual = await derive(pin, salt, iterations);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export const PIN_RE = /^\d{4}$/;
