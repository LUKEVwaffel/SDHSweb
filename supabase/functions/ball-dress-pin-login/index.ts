// Edge function: ball-dress-pin-login
// PRE-AUTH login for the 3 dress verifiers. Verbatim copy of
// reviewer-pin-login/index.ts's shape, swapping email_reviewers/
// reviewer_credentials for ball_dress_staff and the two RPC names. Runs on
// the public anon key BEFORE the user has a session, so deploy WITHOUT jwt
// verification:
//   supabase functions deploy ball-dress-pin-login --no-verify-jwt
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

    const { data: staff } = await svc
      .from("ball_dress_staff").select("email").eq("email", account).eq("active", true).maybeSingle();
    if (!staff) return json({ error: "invalid" }, 401);

    const reserve = await svc.rpc("ball_dress_reserve_pin_attempt", { p_email: account });
    if (reserve.error) { console.error("ball_dress_reserve_pin_attempt", reserve.error); return json({ error: "internal error" }, 500); }
    const r = Array.isArray(reserve.data) ? reserve.data[0] : reserve.data;

    if (!r?.allowed) {
      if (r?.locked_until && new Date(r.locked_until) > new Date()) {
        return json({ error: "locked", until: lockUntilMinute(r.locked_until) }, 423);
      }
      return json({ error: "invalid" }, 401);
    }

    const { data: cred } = await svc
      .from("ball_dress_staff").select("pin_hash").eq("email", account).maybeSingle();
    const ok = await verifyPin(String(pin), cred?.pin_hash ?? null);

    if (!ok) {
      if (r.locked_until && new Date(r.locked_until) > new Date()) {
        return json({ error: "locked", until: lockUntilMinute(r.locked_until) }, 423);
      }
      const remaining = Math.max(0, MAX_FAILS - (r.fail_count ?? MAX_FAILS));
      return json({ error: "invalid", remaining }, 401);
    }

    await svc.rpc("ball_dress_reset_pin_attempts", { p_email: account });
    const token_hash = await mintSessionToken(account);
    return json({ ok: true, token_hash });
  } catch (e) {
    console.error("ball-dress-pin-login", e);
    return json({ error: "internal error" }, 500);
  }
});
