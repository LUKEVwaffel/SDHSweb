// Edge function: ball-dress-set-pin
// S-6 ONLY. Provisions a dress / male-guest-attire approver. Attire login is
// now EMAIL-ONLY (ball-dress-email-login) so a PIN is no longer required —
// name + email + role is enough. A PIN may still be passed (kept for the old
// PIN login path / rollback) but it is optional.
//
// Also creates the Supabase Auth user for the address if it does not exist
// yet, so there is no separate "make the account in the dashboard first" step
// — email is genuinely the only thing S-6 needs to type. Deploy WITH jwt
// verification (default).
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";
import { hashPin, PIN_RE } from "../_shared/pin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== "s6") return json({ error: "not authorized" }, 403);
    // Item 9: this bypasses RLS via the service-role client, so per the
    // getCaller() contract in _shared/supabase.ts it must also enforce the
    // password gate itself — RLS's admin_role() check does not cover
    // service-role calls. Same guard as send-allergy-email.
    if (caller.mustChangePassword) return json({ error: "set your own password first" }, 403);

    const { email, name, pin, role } = await req.json().catch(() => ({}));
    const targetEmail = String(email || "").trim().toLowerCase();
    const targetName = String(name || "").trim();
    // 'female_dress' = the female-attire approvers; 'male_guest_attire' =
    // Weston's male-guest queue (see ball_finalize.sql SECTION 3). Default
    // keeps every existing caller (no role param) on the female-dress role.
    const targetRole = role === "male_guest_attire" ? "male_guest_attire" : "female_dress";
    if (!targetEmail || !targetName) return json({ error: "name and email are required" }, 400);

    // PIN is optional now. Only validate/hash it when one was actually sent.
    const rawPin = pin == null ? "" : String(pin);
    let pin_hash: string | null = null;
    if (rawPin) {
      if (!PIN_RE.test(rawPin)) return json({ error: "PIN must be exactly 4 digits" }, 400);
      pin_hash = await hashPin(rawPin);
    }

    const svc = serviceClient();

    // Make the GoTrue user if it is not there yet. "already registered" is the
    // normal path on a re-provision / role change — swallow it.
    const created = await svc.auth.admin.createUser({ email: targetEmail, email_confirm: true });
    if (created.error) {
      const msg = (created.error.message || "").toLowerCase();
      const dup = msg.includes("already") || msg.includes("registered") || msg.includes("exists");
      if (!dup) {
        console.error("ball-dress-set-pin createUser", created.error);
        return json({ error: "could not create the sign-in account" }, 500);
      }
    }

    const row: Record<string, unknown> = {
      email: targetEmail,
      name: targetName,
      active: true,
      role: targetRole,
      pin_fail_count: 0,
      pin_locked_until: null,
      updated_at: new Date().toISOString(),
    };
    if (pin_hash) row.pin_hash = pin_hash;

    const { error } = await svc.from("ball_dress_staff").upsert(row);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (e) {
    console.error("ball-dress-set-pin", e);
    return json({ error: "internal error" }, 500);
  }
});
