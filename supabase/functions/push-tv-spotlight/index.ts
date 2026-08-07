// Edge function: push-tv-spotlight
// Single-photo Push-to-TV. Luke-only (hardcoded — see register-tv-terminal),
// JWT-verified, step-up PIN re-entry, AND a trusted-device fingerprint match
// — all three checked in one atomic request rather than handing back a
// separate step-up token, since there's nothing else this token would ever
// authorize. tv_daily_settings.spotlight_* columns are guarded at the DB
// level (tv_daily_settings_guard trigger, tv_broadcast.sql) to service-role
// only, so this function's service-role write is the ONLY legitimate path —
// even a signed-in Luke session cannot set spotlight_active via a direct
// authenticated UPDATE.
//
// { clear: true } skips PIN/device verification entirely — a one-click
// revert back to the normal carousel needs to be trivial, not re-gated. It
// still requires a valid Luke session (getCaller), just not a fresh PIN.
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";
import { verifyPin, PIN_RE } from "../_shared/pin.ts";

const LUKE_EMAIL = "lukevetsch77@gmail.com";
const ROW_ID = "default";
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
    const caller = await getCaller(req);
    if (!caller) return json({ error: "unauthorized" }, 401);
    if (caller.email !== LUKE_EMAIL) return json({ error: "forbidden" }, 403);
    if (caller.mustChangePassword) return json({ error: "password_change_required" }, 403);

    const body = await req.json().catch(() => ({}));
    const svc = serviceClient();

    if (body?.clear === true) {
      const { error } = await svc.from("tv_daily_settings").update({
        spotlight_active: false,
        spotlight_photo_url: null,
        spotlight_set_at: new Date().toISOString(),
        spotlight_set_by: caller.email,
      }).eq("id", ROW_ID);
      if (error) { console.error("push-tv-spotlight clear", error); return json({ error: "internal error" }, 500); }
      return json({ ok: true });
    }

    const { photo_url, pin, fingerprint } = body;
    if (
      !PIN_RE.test(String(pin ?? "")) ||
      !fingerprint || typeof fingerprint !== "string" ||
      !photo_url || typeof photo_url !== "string"
    ) {
      return json({ error: "invalid" }, 401);
    }

    // 1) Atomic PIN gate — same reserve-then-verify shape as pin-login.
    const reserve = await svc.rpc("reserve_pin_attempt", { p_email: caller.email });
    if (reserve.error) { console.error("reserve_pin_attempt", reserve.error); return json({ error: "internal error" }, 500); }
    const r = Array.isArray(reserve.data) ? reserve.data[0] : reserve.data;

    if (!r?.allowed) {
      if (r?.locked_until && new Date(r.locked_until) > new Date()) {
        return json({ error: "locked", until: lockUntilMinute(r.locked_until) }, 423);
      }
      return json({ error: "invalid" }, 401);
    }

    const { data: cred, error: credErr } = await svc
      .from("account_credentials").select("pin_hash").eq("email", caller.email).maybeSingle();
    if (credErr) { console.error("push-tv-spotlight cred lookup", credErr); return json({ error: "internal error" }, 500); }
    const ok = await verifyPin(String(pin), cred?.pin_hash ?? null);

    if (!ok) {
      if (r.locked_until && new Date(r.locked_until) > new Date()) {
        return json({ error: "locked", until: lockUntilMinute(r.locked_until) }, 423);
      }
      const remaining = Math.max(0, MAX_FAILS - (r.fail_count ?? MAX_FAILS));
      return json({ error: "invalid", remaining }, 401);
    }

    await svc.rpc("reset_pin_attempts", { p_email: caller.email });

    // 2) Trusted-device gate — fires only after a correct PIN, so a wrong PIN
    // from an untrusted device reports as "invalid PIN," never leaking
    // whether the device itself would have passed.
    const { data: device, error: deviceErr } = await svc
      .from("trusted_devices").select("id").eq("email", caller.email).eq("fingerprint", fingerprint).maybeSingle();
    if (deviceErr) { console.error("push-tv-spotlight device lookup", deviceErr); return json({ error: "internal error" }, 500); }
    if (!device) return json({ error: "device_not_trusted" }, 403);

    // 3) Write — service role, bypasses the guard trigger by design.
    const { error: updateErr } = await svc.from("tv_daily_settings").update({
      spotlight_photo_url: photo_url,
      spotlight_active: true,
      spotlight_set_at: new Date().toISOString(),
      spotlight_set_by: caller.email,
    }).eq("id", ROW_ID);
    if (updateErr) { console.error("push-tv-spotlight write", updateErr); return json({ error: "internal error" }, 500); }

    return json({ ok: true });
  } catch (e) {
    console.error("push-tv-spotlight", e);
    return json({ error: "internal error" }, 500);
  }
});
