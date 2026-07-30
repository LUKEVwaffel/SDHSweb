// Edge function: passkey-login
// PRE-AUTH login via WebAuthn passkey (Touch ID). Verifies the assertion against
// the account's stored public key, then mints a real Supabase session.
// Runs before any session, so deploy WITHOUT jwt verification:
//   supabase functions deploy passkey-login --no-verify-jwt
//
// Two-step (client sends {action}):
//   start  -> issue authentication options (allowCredentials for this email) +
//             store the challenge
//   finish -> verify the assertion, bump the signature counter, mint session
//
// SECURITY: the signature counter guards against cloned authenticators — a
// verified assertion whose counter did not advance is rejected by the library.
// The challenge is single-use (consumeChallenge deletes it). Success returns a
// magic-link token_hash for supabase.auth.verifyOtp({ token_hash, type:'magiclink' }).
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "https://esm.sh/@simplewebauthn/server@9.0.3";
import { json, preflight } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { rpID, rpOrigin, saveChallenge, consumeChallenge, b64urlToBytes } from "../_shared/webauthn.ts";
import { mintSessionToken } from "../_shared/session.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    if (!rpID() || !rpOrigin()) return json({ error: "WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN not configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").toLowerCase();
    if (!email) return json({ error: "email required" }, 400);

    const svc = serviceClient();
    const { data: creds, error: credsErr } = await svc
      .from("webauthn_credentials")
      .select("credential_id, public_key, counter, transports")
      .eq("account_email", email);

    // Fail CLOSED on a lookup error — a query failure must not fall through
    // to "no passkey for this account," which callers may treat as a benign
    // signal to try another method.
    if (credsErr) { console.error("passkey-login creds lookup", credsErr); return json({ error: "internal error" }, 500); }
    if (!creds || creds.length === 0) return json({ error: "no passkey for this account" }, 404);

    if (body.action === "start") {
      const options = await generateAuthenticationOptions({
        rpID: rpID(),
        allowCredentials: creds.map((c) => ({
          id: c.credential_id, type: "public-key", transports: c.transports ?? undefined,
        })),
        userVerification: "required",
      });
      await saveChallenge(email, options.challenge, "login");
      return json({ options });
    }

    if (body.action === "finish") {
      const expectedChallenge = await consumeChallenge(email, "login");
      if (!expectedChallenge) return json({ error: "challenge expired — start again" }, 400);

      // Match the credential the authenticator actually used.
      const used = creds.find((c) => c.credential_id === body.response?.id);
      if (!used) return json({ error: "unknown credential" }, 400);

      const verification = await verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge,
        expectedOrigin: rpOrigin(),
        expectedRPID: rpID(),
        requireUserVerification: true,
        authenticator: {
          credentialID: b64urlToBytes(used.credential_id),
          credentialPublicKey: b64urlToBytes(used.public_key),
          counter: Number(used.counter) || 0,
        },
      });
      if (!verification.verified) return json({ error: "assertion could not be verified" }, 401);

      await svc.from("webauthn_credentials")
        .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
        .eq("credential_id", used.credential_id);

      // Passkey is a secondary factor layered on top of an account that must
      // already have a real (non-temp) password — same gate as pin-login.
      // See admin_password_gate.sql.
      const { data: gate, error: gateErr } = await svc
        .from("admin_roles").select("must_change_password").eq("email", email).maybeSingle();
      // Fail CLOSED on a lookup error — same reasoning as pin-login: this is
      // the ONLY control blocking passkey login for a gated account
      // (webauthn_credentials has no RLS policies at all, service-role only).
      if (gateErr) { console.error("passkey-login gate check", gateErr); return json({ error: "internal error" }, 500); }
      if (gate?.must_change_password) return json({ error: "password_change_required" }, 403);

      const token_hash = await mintSessionToken(email);
      return json({ ok: true, token_hash });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("passkey-login", e);
    return json({ error: "internal error" }, 500);
  }
});
