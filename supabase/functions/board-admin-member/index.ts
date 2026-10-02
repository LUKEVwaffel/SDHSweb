// Edge function: board-admin-member
// S-6 ONLY. Provisions board accounts (company CO/XO/1SG, SAI, viewers) and
// their PINs. Creates the Supabase Auth user if missing, like
// ball-dress-set-pin, so S-6 never touches the Auth dashboard.
//
// Body: { action: 'upsert', email, display_name, board_role, company?, cadet_id?, pin? }
//     | { action: 'set_pin', email, pin }
//     | { action: 'clear_pin', email }
//     | { action: 'set_active', email, active }
// Deploy WITH jwt verification (default).
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";
import { hashPin, PIN_RE } from "../_shared/pin.ts";

const ROLES = ["co", "xo", "1sg", "sai", "viewer"];
const COMPANIES = ["alpha", "bravo", "charlie", "delta"];

async function writePin(email: string, pin: string) {
  const pin_hash = await hashPin(pin);
  return serviceClient().from("board_credentials").upsert({
    email, pin_hash, pin_fail_count: 0, pin_locked_until: null, updated_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== "s6") return json({ error: "not authorized" }, 403);
    if (caller.mustChangePassword) return json({ error: "set your own password first" }, 403);

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) return json({ error: "valid email required" }, 400);
    const svc = serviceClient();

    if (body.action === "upsert") {
      const display_name = String(body.display_name || "").trim();
      const board_role = String(body.board_role || "");
      const isSeat = ["co", "xo", "1sg"].includes(board_role);
      const company = isSeat ? String(body.company || "") : null;
      if (!display_name) return json({ error: "name required" }, 400);
      if (!ROLES.includes(board_role)) return json({ error: "bad role" }, 400);
      if (isSeat && !COMPANIES.includes(company!)) return json({ error: "company required for CO/XO/1SG" }, 400);
      const pin = body.pin == null || body.pin === "" ? null : String(body.pin);
      if (pin && !PIN_RE.test(pin)) return json({ error: "PIN must be exactly 4 digits" }, 400);

      const created = await svc.auth.admin.createUser({ email, email_confirm: true });
      if (created.error) {
        const msg = (created.error.message || "").toLowerCase();
        if (!(msg.includes("already") || msg.includes("registered") || msg.includes("exists"))) {
          console.error("board-admin-member createUser", created.error);
          return json({ error: "could not create the sign-in account" }, 500);
        }
      }

      // Taking a seat retires whoever held it before (one active per seat).
      if (isSeat) {
        await svc.from("board_members").update({ active: false, updated_at: new Date().toISOString() })
          .eq("company", company).eq("board_role", board_role).eq("active", true).neq("email", email);
      }

      const { error } = await svc.from("board_members").upsert({
        email, display_name, board_role, company,
        cadet_id: isSeat && body.cadet_id ? String(body.cadet_id) : null,
        active: true, updated_at: new Date().toISOString(),
      });
      if (error) return json({ error: error.message }, 500);
      if (pin) {
        const { error: pErr } = await writePin(email, pin);
        if (pErr) return json({ error: pErr.message }, 500);
      }
      return json({ ok: true });
    }

    const { data: member } = await svc.from("board_members").select("email").eq("email", email).maybeSingle();
    if (!member) return json({ error: "no such board account" }, 404);

    if (body.action === "set_pin") {
      const pin = String(body.pin ?? "");
      if (!PIN_RE.test(pin)) return json({ error: "PIN must be exactly 4 digits" }, 400);
      const { error } = await writePin(email, pin);
      return error ? json({ error: error.message }, 500) : json({ ok: true });
    }
    if (body.action === "clear_pin") {
      const { error } = await svc.from("board_credentials").delete().eq("email", email);
      return error ? json({ error: error.message }, 500) : json({ ok: true });
    }
    if (body.action === "set_active") {
      const { error } = await svc.from("board_members")
        .update({ active: !!body.active, updated_at: new Date().toISOString() }).eq("email", email);
      if (error?.code === "23505") return json({ error: "that seat already has an active holder" }, 409);
      return error ? json({ error: error.message }, 500) : json({ ok: true });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("board-admin-member", e);
    return json({ error: "internal error" }, 500);
  }
});
