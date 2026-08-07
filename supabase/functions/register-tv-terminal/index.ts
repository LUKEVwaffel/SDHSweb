// Edge function: register-tv-terminal
// PIN-gated self-registration of a trusted device for Push-to-TV. Luke-only
// (hardcoded, matching public.is_luke() in tv_photos.sql — belt and
// suspenders: the DB RLS already blocks anyone else's INSERT since there is
// no insert policy at all, but failing fast here avoids leaking timing/PIN-
// lockout signal to a non-Luke authenticated caller).
//
// JWT-verified (default deploy, do NOT add --no-verify-jwt) — the caller must
// already have a real DISPATCH session; this only proves "you still know your
// own PIN," the same step-up shape as push-tv-spotlight.
//
// Deliberately requires only a correct PIN, not the OLD trusted device — this
// is the recovery path for a new machine / cleared browser the spec asked
// for. Re-running it just adds/updates the (email, fingerprint) row; it never
// needs to know about, or revoke, any previously registered device.
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";
import { verifyPin, PIN_RE } from "../_shared/pin.ts";

const LUKE_EMAIL = "lukevetsch77@gmail.com";
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

    const { pin, fingerprint, label } = await req.json().catch(() => ({}));
    if (!PIN_RE.test(String(pin ?? "")) || !fingerprint || typeof fingerprint !== "string") {
      return json({ error: "invalid" }, 401);
    }

    const svc = serviceClient();

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
    if (credErr) { console.error("register-tv-terminal cred lookup", credErr); return json({ error: "internal error" }, 500); }
    const ok = await verifyPin(String(pin), cred?.pin_hash ?? null);

    if (!ok) {
      if (r.locked_until && new Date(r.locked_until) > new Date()) {
        return json({ error: "locked", until: lockUntilMinute(r.locked_until) }, 423);
      }
      const remaining = Math.max(0, MAX_FAILS - (r.fail_count ?? MAX_FAILS));
      return json({ error: "invalid", remaining }, 401);
    }

    await svc.rpc("reset_pin_attempts", { p_email: caller.email });

    const { error: upsertErr } = await svc.from("trusted_devices")
      .upsert(
        { email: caller.email, fingerprint, label: label || null },
        { onConflict: "email,fingerprint" },
      );
    if (upsertErr) { console.error("register-tv-terminal upsert", upsertErr); return json({ error: "internal error" }, 500); }

    return json({ ok: true });
  } catch (e) {
    console.error("register-tv-terminal", e);
    return json({ error: "internal error" }, 500);
  }
});
