import { serviceClient } from "./supabase.ts";

// WebAuthn relying-party config. MUST be set as edge-function secrets and match
// the deployed site EXACTLY or every assertion verification fails:
//   supabase secrets set WEBAUTHN_RP_ID=sdhsjrotc.com
//   supabase secrets set WEBAUTHN_ORIGIN=https://www.sdhsjrotc.com
// RP_ID = the registrable domain (no scheme, no port). ORIGIN = the exact
// scheme+host the browser reports (include www/subdomain if that's what loads).
export const rpID = (): string => Deno.env.get("WEBAUTHN_RP_ID") ?? "";
export const rpOrigin = (): string => Deno.env.get("WEBAUTHN_ORIGIN") ?? "";
export const RP_NAME = "DISPATCH · Trojan Battalion";

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// base64url <-> bytes. WebAuthn credential ids / public keys are stored as
// base64url text; the lib hands us Uint8Array on the server side.
export function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// One challenge per (email, kind) at a time. Keyed by (email, kind) so a
// pre-auth login-start can't clobber a signed-in admin's in-flight register
// challenge (or vice-versa).
export async function saveChallenge(email: string, challenge: string, kind: "register" | "login") {
  const expires_at = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  const { error } = await serviceClient()
    .from("webauthn_challenges")
    .upsert({ email, challenge, kind, expires_at }, { onConflict: "email,kind" });
  if (error) throw new Error(error.message);
}

// Single-use: atomically DELETE the (email, kind) row and RETURN it in one
// statement. A concurrent second caller gets zero rows back — closing the
// SELECT-then-DELETE race that would otherwise let a captured assertion replay.
export async function consumeChallenge(email: string, kind: "register" | "login"): Promise<string | null> {
  const { data } = await serviceClient()
    .from("webauthn_challenges")
    .delete()
    .eq("email", email)
    .eq("kind", kind)
    .select("challenge, expires_at")
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at) <= new Date()) return null;
  return data.challenge;
}
