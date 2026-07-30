// Edge function: set-pin
// Sets/replaces the 4-digit PIN for an account. AUTHENTICATED and SELF-ONLY —
// the caller may set a PIN ONLY for their own account. There is deliberately no
// S-6 override: no one can set another person's PIN, by design.
// The PIN is hashed server-side; the plaintext never touches the database.
// Deploy WITH JWT verification (default): supabase functions deploy set-pin
import { cors, json, preflight } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";
import { hashPin, PIN_RE } from "../_shared/pin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "not authenticated" }, 401);

    const { email, pin } = await req.json().catch(() => ({}));
    const target = String(email || "").toLowerCase();
    if (!target) return json({ error: "email required" }, 400);
    if (!PIN_RE.test(String(pin ?? ""))) return json({ error: "PIN must be exactly 4 digits" }, 400);

    // Authorization: SELF-ONLY. A caller may set a PIN only for their own
    // account — no S-6 override path. Compare the authenticated caller's email
    // (from the verified JWT) against the requested target.
    if (caller.email !== target) return json({ error: "forbidden" }, 403);

    // PIN setup is blocked until the forced password change is done — a PIN
    // is a secondary method layered on top of a real password, never a way
    // to skip setting one. clear-pin (removal) is deliberately NOT gated.
    if (caller.mustChangePassword) return json({ error: "password_change_required" }, 403);

    const svc = serviceClient();

    // Target must be a known admin account (FK-safe + avoids seeding stray rows).
    const { data: acct } = await svc.from("admin_roles").select("email").eq("email", target).maybeSingle();
    if (!acct) return json({ error: "no such account" }, 404);

    const pin_hash = await hashPin(String(pin));
    const { error } = await svc.from("account_credentials").upsert({
      email: target,
      pin_hash,
      pin_fail_count: 0,
      pin_locked_until: null,
      updated_at: new Date().toISOString(),
    });
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (e) {
    console.error("set-pin", e);
    return json({ error: "internal error" }, 500);
  }
});
