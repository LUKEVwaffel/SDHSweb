// Edge function: passkey-register
// Registers a WebAuthn passkey (Touch ID / platform authenticator) for the
// CALLER'S OWN account. AUTHENTICATED, self-only — a passkey binds to the device
// present at registration, so you can only register your own. Deploy WITH jwt
// verification (default):  supabase functions deploy passkey-register
//
// Two-step (client sends {action}):
//   start  -> issue registration options + store the challenge
//   finish -> verify the attestation, persist the credential public key
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "https://esm.sh/@simplewebauthn/server@9.0.3";
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";
import { rpID, rpOrigin, RP_NAME, saveChallenge, consumeChallenge, bytesToB64url } from "../_shared/webauthn.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    if (!rpID() || !rpOrigin()) return json({ error: "WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN not configured" }, 500);

    const caller = await getCaller(req);
    if (!caller) return json({ error: "not authenticated" }, 401);
    const email = caller.email; // self only — never a body-supplied target

    const body = await req.json().catch(() => ({}));
    const svc = serviceClient();

    if (body.action === "start") {
      const { data: existing } = await svc
        .from("webauthn_credentials").select("credential_id, transports").eq("account_email", email);
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: rpID(),
        userID: new TextEncoder().encode(email),
        userName: email,
        attestationType: "none",
        excludeCredentials: (existing ?? []).map((c) => ({
          id: c.credential_id, type: "public-key", transports: c.transports ?? undefined,
        })),
        // Sole primary factor → demand the local biometric/PIN unlock, not just
        // device possession.
        authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      });
      await saveChallenge(email, options.challenge, "register");
      return json({ options });
    }

    if (body.action === "finish") {
      const expectedChallenge = await consumeChallenge(email, "register");
      if (!expectedChallenge) return json({ error: "challenge expired — start again" }, 400);

      const verification = await verifyRegistrationResponse({
        response: body.response,
        expectedChallenge,
        expectedOrigin: rpOrigin(),
        expectedRPID: rpID(),
        requireUserVerification: true,
      });
      if (!verification.verified || !verification.registrationInfo) {
        return json({ error: "registration could not be verified" }, 400);
      }
      const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
      const { error } = await svc.from("webauthn_credentials").insert({
        account_email: email,
        credential_id: bytesToB64url(credentialID),
        public_key: bytesToB64url(credentialPublicKey),
        counter,
        transports: body.response?.response?.transports ?? null,
        label: body.label ?? null,
      });
      if (error) { console.error("passkey-register insert", error); return json({ error: "could not store credential" }, 500); }
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("passkey-register", e);
    return json({ error: "internal error" }, 500);
  }
});
