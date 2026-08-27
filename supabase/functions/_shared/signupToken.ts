// Short-lived HMAC-signed "signup session" token for the Ball signup flow.
// NOT a Supabase session — a lightweight, server-verifiable proof that "this
// browser just verified as cadet X" (ball-lookup-cadet), so ball-search-roster
// and ball-submit-signup can require it instead of being reachable by anyone
// with the URL. Format: base64url(payload_json).base64url(hmac_sig) — same
// "self-describing, no external dependency" spirit as _shared/pin.ts.
//
// SIGNUP_SESSION_SECRET must be set as an edge function secret
// (`supabase secrets set SIGNUP_SESSION_SECRET=...`, a long random string —
// NOT reused from any other secret). Rotating it invalidates all outstanding
// tokens, which is fine: they're 15-20 min lived by design.
const TOKEN_TTL_MS = 18 * 60 * 1000; // 18 minutes

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("SIGNUP_SESSION_SECRET");
  if (!secret) throw new Error("SIGNUP_SESSION_SECRET not configured");
  return crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
  );
}

export interface SignupTokenPayload {
  email: string;   // lowercased cadet school email, the identity this token proves
  exp: number;      // epoch ms
}

export async function mintSignupToken(email: string): Promise<string> {
  const payload: SignupTokenPayload = { email: email.toLowerCase(), exp: Date.now() + TOKEN_TTL_MS };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const key = await hmacKey();
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, payloadBytes));
  return `${b64url(payloadBytes)}.${b64url(sig)}`;
}

// Returns the verified payload, or null on any failure (malformed, bad
// signature, expired) — callers should treat null as a uniform 401, never
// distinguish "expired" from "forged" in the response (no reason to help an
// attacker debug their forgery attempt).
export async function verifySignupToken(token: unknown): Promise<SignupTokenPayload | null> {
  if (typeof token !== "string" || !token.includes(".")) return null;
  try {
    const [payloadPart, sigPart] = token.split(".");
    const payloadBytes = unb64url(payloadPart);
    const sig = unb64url(sigPart);
    const key = await hmacKey();
    const ok = await crypto.subtle.verify("HMAC", key, sig, payloadBytes);
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SignupTokenPayload;
    if (typeof payload.email !== "string" || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
