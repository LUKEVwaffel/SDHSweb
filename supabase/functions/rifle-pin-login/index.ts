// Edge function: rifle-pin-login
// PRE-AUTH login: verify Makaio's 4-digit PIN, then mint a real Supabase
// session. Direct port of pin-login onto rifle_admins/rifle_account_credentials
// — see account_picker.sql for the concurrency-proof lockout rationale this
// mirrors exactly (reserve-before-verify, 5 fails -> 15-minute lock).
// Deploy WITHOUT jwt verification: supabase functions deploy rifle-pin-login --no-verify-jwt
import { json, preflight } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { verifyPin, PIN_RE } from "../_shared/pin.ts";
import { mintSessionToken } from "../_shared/session.ts";

const MAX_FAILS = 5;

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
      return json({ error: "invalid" }, 401);
    }

    const svc = serviceClient();

    const reserve = await svc.rpc("reserve_rifle_pin_attempt", { p_email: account });
    if (reserve.error) { console.error("reserve_rifle_pin_attempt", reserve.error); return json({ error: "internal error" }, 500); }
    const r = Array.isArray(reserve.data) ? reserve.data[0] : reserve.data;

    if (!r?.allowed) {
      if (r?.locked_until && new Date(r.locked_until) > new Date()) {
        return json({ error: "locked", until: lockUntilMinute(r.locked_until) }, 423);
      }
      return json({ error: "invalid" }, 401);
    }

    const { data: cred, error: credErr } = await svc
      .from("rifle_account_credentials").select("pin_hash").eq("email", account).maybeSingle();
    if (credErr) { console.error("rifle-pin-login cred lookup", credErr); return json({ error: "internal error" }, 500); }
    const ok = await verifyPin(String(pin), cred?.pin_hash ?? null);

    if (!ok) {
      if (r.locked_until && new Date(r.locked_until) > new Date()) {
        return json({ error: "locked", until: lockUntilMinute(r.locked_until) }, 423);
      }
      const remaining = Math.max(0, MAX_FAILS - (r.fail_count ?? MAX_FAILS));
      return json({ error: "invalid", remaining }, 401);
    }

    await svc.rpc("reset_rifle_pin_attempts", { p_email: account });

    // Also require active=true — an admin deactivated by Luke should not be
    // able to slide in on a still-valid PIN.
    const { data: gate, error: gateErr } = await svc
      .from("rifle_admins").select("must_change_password, active").eq("email", account).maybeSingle();
    if (gateErr) { console.error("rifle-pin-login gate check", gateErr); return json({ error: "internal error" }, 500); }
    if (!gate?.active) return json({ error: "invalid" }, 401);
    if (gate.must_change_password) return json({ error: "password_change_required" }, 403);

    const token_hash = await mintSessionToken(account);
    return json({ ok: true, token_hash });
  } catch (e) {
    console.error("rifle-pin-login", e);
    return json({ error: "internal error" }, 500);
  }
});
