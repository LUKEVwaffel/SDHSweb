// Edge function: admin-change-email
// S-6 ONLY, one-off. Changes a DISPATCH admin account's LOGIN email (Supabase
// Auth) plus every DB row keyed on the old address, in that order:
//   1. auth.users.email via auth.admin.updateUserById(id, { email_confirm: true })
//      — no verification email, password untouched (see admin_change_email.sql
//      header for why email_confirm:true is required here).
//   2. admin_change_email_migrate(old, new) — the atomic DB half (admin_roles
//      row + PIN/passkey creds + DISPATCH chat + presence + AAR ownership).
//
// Built for the 2026-09-02 Danielle/Aaron S-5 move off school addresses, but
// generic. Accepts a batch:
//   { pairs: [{ old: "...", new: "..." }, ...] }
//
// Deploy WITH jwt verification (default):
//   supabase functions deploy admin-change-email
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function findUserByEmail(svc: ReturnType<typeof serviceClient>, email: string) {
  // supabase-js admin has no get-by-email; page through (user base is tiny).
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== "s6") return json({ error: "not authorized" }, 403);
    if (caller.mustChangePassword) return json({ error: "set your own password first" }, 403);

    const body = await req.json().catch(() => ({}));
    const pairs: Array<{ old?: unknown; new?: unknown }> = Array.isArray(body?.pairs) ? body.pairs : [];
    if (!pairs.length) return json({ error: "pairs: [{ old, new }] required" }, 400);

    const svc = serviceClient();
    const results: Array<Record<string, unknown>> = [];

    for (const p of pairs) {
      const oldEmail = String(p?.old ?? "").trim().toLowerCase();
      const newEmail = String(p?.new ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(oldEmail) || !EMAIL_RE.test(newEmail) || oldEmail === newEmail) {
        results.push({ old: oldEmail, ok: false, error: "invalid or identical emails" });
        continue;
      }

      try {
        const user = await findUserByEmail(svc, oldEmail);
        if (!user) {
          // Maybe the auth side was already changed on a previous run — still
          // try to reconcile the DB half so a partial run can be finished.
          const { data: mig, error: migErr } = await svc.rpc("admin_change_email_migrate", {
            p_old: oldEmail, p_new: newEmail,
          });
          results.push({ old: oldEmail, ok: !migErr, auth: "no auth user for old email", db: migErr?.message ?? mig });
          continue;
        }

        const { error: authErr } = await svc.auth.admin.updateUserById(user.id, {
          email: newEmail,
          email_confirm: true,
        });
        if (authErr) {
          results.push({ old: oldEmail, ok: false, error: `auth update failed: ${authErr.message}` });
          continue;
        }

        const { data: mig, error: migErr } = await svc.rpc("admin_change_email_migrate", {
          p_old: oldEmail, p_new: newEmail,
        });
        if (migErr) {
          results.push({
            old: oldEmail, ok: false,
            error: `AUTH EMAIL CHANGED but DB migrate failed: ${migErr.message}. Re-run this function; the migrate step is idempotent.`,
          });
          continue;
        }

        results.push({ old: oldEmail, new: newEmail, ok: true, db: mig });
      } catch (e) {
        results.push({ old: oldEmail, ok: false, error: (e as Error).message });
      }
    }

    const allOk = results.every((r) => r.ok);
    return json({ ok: allOk, results }, allOk ? 200 : 207);
  } catch (e) {
    console.error("admin-change-email", e);
    return json({ error: "internal error" }, 500);
  }
});
