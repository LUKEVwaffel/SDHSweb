// Edge function: pin-login
// PRE-AUTH login: verify a 4-digit PIN, then mint a real Supabase session.
// Runs on the public anon key BEFORE the user has a session, so deploy WITHOUT
// jwt verification:  supabase functions deploy pin-login --no-verify-jwt
//
// SECURITY — this is the load-bearing control for a low-entropy PIN:
//   • reserve_pin_attempt() is called FIRST. It row-locks the credential row,
//     rejects locked accounts, and increments the fail counter optimistically
//     BEFORE the PIN is verified. Concurrent bursts serialize on that row lock,
//     so no more than 5 attempts can ever reach verification per lock window.
//   • On a correct PIN, reset_pin_attempts() clears the optimistic increment.
//   • On a wrong PIN, nothing further runs — the failure is already recorded.
//   • Hash comparison is constant-time (see _shared/pin.ts).
//   • Success returns a magic-link token_hash to exchange via
//     supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }).
import { json, preflight } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { verifyPin, PIN_RE } from "../_shared/pin.ts";
import { mintSessionToken } from "../_shared/session.ts";

const MAX_FAILS = 5;

// Round up to the next whole minute so the response doesn't hand out a
// to-the-second unlock time an attacker could pace bursts against.
function lockUntilMinute(ts: string): string {
  const d = new Date(ts);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  return d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { email, pin } = await req.json().catch(() => ({}));
    const account = String(email || "").toLowerCase();
    if (!account || !PIN_RE.test(String(pin ?? ""))) {
      // Generic — do not distinguish "bad format" from "wrong PIN".
      return json({ error: "invalid" }, 401);
    }

    const svc = serviceClient();

    // 1) Atomic gate: reserve this attempt BEFORE verifying anything.
    const reserve = await svc.rpc("reserve_pin_attempt", { p_email: account });
    if (reserve.error) { console.error("reserve_pin_attempt", reserve.error); return json({ error: "internal error" }, 500); }
    const r = Array.isArray(reserve.data) ? reserve.data[0] : reserve.data;

    if (!r?.allowed) {
      if (r?.locked_until && new Date(r.locked_until) > new Date()) {
        return json({ error: "locked", until: lockUntilMinute(r.locked_until) }, 423);
      }
      return json({ error: "invalid" }, 401);   // no PIN configured for this account
    }

    // 2) Verify (attempt already recorded as a failure by step 1).
    const { data: cred } = await svc
      .from("account_credentials").select("pin_hash").eq("email", account).maybeSingle();
    const ok = await verifyPin(String(pin), cred?.pin_hash ?? null);

    if (!ok) {
      if (r.locked_until && new Date(r.locked_until) > new Date()) {
        return json({ error: "locked", until: lockUntilMinute(r.locked_until) }, 423);
      }
      const remaining = Math.max(0, MAX_FAILS - (r.fail_count ?? MAX_FAILS));
      return json({ error: "invalid", remaining }, 401);
    }

    // 3) Correct PIN → clear the optimistic increment, then mint the session.
    await svc.rpc("reset_pin_attempts", { p_email: account });
    const token_hash = await mintSessionToken(account);
    return json({ ok: true, token_hash });
  } catch (e) {
    console.error("pin-login", e);
    return json({ error: "internal error" }, 500);
  }
});
