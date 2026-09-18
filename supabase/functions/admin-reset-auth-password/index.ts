// Edge function: admin-reset-auth-password
// S-6 ONLY. Sets a new random temp password on an existing Supabase Auth
// user (svc.auth.admin.updateUserById) — the "reset password from the
// Supabase dashboard" step AccountsPanel.jsx used to point S-6 at, now doable
// from the AUTH tab (AuthAccountsTab.jsx) directly.
//
// Best-effort re-arms must_change_password on every portal-specific table
// that has a matching row (admin_roles, email_reviewers, rifle_admins) so the
// forced-first-login wall re-engages on the new temp password, same as a
// fresh account. A missing row in any one table is not an error — most
// people are in only one or two of these.
//
// Deploy WITH jwt verification (default):
//   supabase functions deploy admin-reset-auth-password
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";

function randomTempPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== "s6") return json({ error: "not authorized" }, 403);
    if (caller.mustChangePassword) return json({ error: "set your own password first" }, 403);

    const { user_id, email } = await req.json().catch(() => ({}));
    const userId = String(user_id || "").trim();
    const targetEmail = String(email || "").trim().toLowerCase();
    if (!userId || !targetEmail) return json({ error: "user_id and email are required" }, 400);

    const svc = serviceClient();
    const tempPassword = randomTempPassword();
    const { error: updErr } = await svc.auth.admin.updateUserById(userId, { password: tempPassword });
    if (updErr) {
      console.error("admin-reset-auth-password updateUserById", updErr);
      return json({ error: "could not reset the password" }, 500);
    }

    // Best-effort — none of these existing is an error, each table is
    // independent, and a failure here must not undo the password reset that
    // already succeeded.
    await Promise.all([
      svc.from("admin_roles").update({ must_change_password: true }).eq("email", targetEmail),
      svc.from("email_reviewers").update({ must_change_password: true }).eq("email", targetEmail),
      svc.from("rifle_admins").update({ must_change_password: true }).eq("email", targetEmail),
    ].map((p) => p.catch((e) => console.error("admin-reset-auth-password re-arm", e))));

    return json({ ok: true, temp_password: tempPassword });
  } catch (e) {
    console.error("admin-reset-auth-password", e);
    return json({ error: "internal error" }, 500);
  }
});
