// Edge function: ball-dress-set-pin
// S-6 ONLY. Provisions/resets a dress-staff account's PIN — unlike
// set-reviewer-pin (self-service, no email param), S-6 is setting this up
// for one of the 3 dress verifiers, not for themself, so email + name are
// caller-supplied and the target is upserted into ball_dress_staff. Deploy
// WITH jwt verification (default).
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";
import { hashPin, PIN_RE } from "../_shared/pin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== "s6") return json({ error: "not authorized" }, 403);

    const { email, name, pin } = await req.json().catch(() => ({}));
    const targetEmail = String(email || "").trim().toLowerCase();
    const targetName = String(name || "").trim();
    if (!targetEmail || !targetName) return json({ error: "name and email are required" }, 400);
    if (!PIN_RE.test(String(pin ?? ""))) return json({ error: "PIN must be exactly 4 digits" }, 400);

    const pin_hash = await hashPin(String(pin));
    const { error } = await serviceClient().from("ball_dress_staff").upsert({
      email: targetEmail,
      name: targetName,
      active: true,
      pin_hash,
      pin_fail_count: 0,
      pin_locked_until: null,
      updated_at: new Date().toISOString(),
    });
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (e) {
    console.error("ball-dress-set-pin", e);
    return json({ error: "internal error" }, 500);
  }
});
