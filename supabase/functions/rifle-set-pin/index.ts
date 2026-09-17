// Edge function: rifle-set-pin
// Sets/replaces Makaio's 4-digit PIN. AUTHENTICATED and SELF-ONLY — direct
// port of set-pin onto rifle_admins/rifle_account_credentials. No S-6/admin
// override, same as the account-picker version.
// Deploy WITH JWT verification (default): supabase functions deploy rifle-set-pin
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getRifleAdmin } from "../_shared/supabase.ts";
import { hashPin, PIN_RE } from "../_shared/pin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getRifleAdmin(req);
    if (!caller) return json({ error: "not authenticated" }, 401);

    const { email, pin } = await req.json().catch(() => ({}));
    const target = String(email || "").toLowerCase();
    if (!target) return json({ error: "email required" }, 400);
    if (!PIN_RE.test(String(pin ?? ""))) return json({ error: "PIN must be exactly 4 digits" }, 400);

    if (caller.email !== target) return json({ error: "forbidden" }, 403);
    // PIN is a secondary method layered on a real password — never a way to
    // skip the forced password change.
    if (caller.mustChangePassword) return json({ error: "password_change_required" }, 403);

    const svc = serviceClient();
    const { data: acct } = await svc.from("rifle_admins").select("email").eq("email", target).maybeSingle();
    if (!acct) return json({ error: "no such account" }, 404);

    const pin_hash = await hashPin(String(pin));
    const { error } = await svc.from("rifle_account_credentials").upsert({
      email: target,
      pin_hash,
      pin_fail_count: 0,
      pin_locked_until: null,
      updated_at: new Date().toISOString(),
    });
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (e) {
    console.error("rifle-set-pin", e);
    return json({ error: "internal error" }, 500);
  }
});
