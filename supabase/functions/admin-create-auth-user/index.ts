// Edge function: admin-create-auth-user
// S-6 ONLY. Creates a bare Supabase Auth user with a random temp password —
// the generic version of the same auth.admin.createUser() step
// rifle-admin-set / ball-dress-set-pin already do inline for their own
// portal. This is the standalone version for the new Portal Access "AUTH"
// tab (AuthAccountsTab.jsx), so S-6 never has to open the Supabase dashboard
// just to clear the "must already exist as a Supabase Auth user" prerequisite
// ahead of provisioning a reviewer / admin_roles / any other account.
//
// Does NOT touch any portal-specific table (email_reviewers, rifle_admins,
// admin_roles, ball_dress_staff) — this only ensures the login itself exists.
// Assigning it to a portal is a separate step (Portal Access → ASSIGN, or the
// People panel for DISPATCH access).
//
// Deploy WITH jwt verification (default):
//   supabase functions deploy admin-create-auth-user
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

    const { email } = await req.json().catch(() => ({}));
    const targetEmail = String(email || "").trim().toLowerCase();
    if (!targetEmail) return json({ error: "email is required" }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(targetEmail)) return json({ error: "email looks malformed" }, 400);

    const svc = serviceClient();

    const { data: existingUsers, error: listErr } = await svc.auth.admin.listUsers();
    if (listErr) {
      console.error("admin-create-auth-user listUsers", listErr);
      return json({ error: "internal error" }, 500);
    }
    if (existingUsers?.users?.some((u) => u.email?.toLowerCase() === targetEmail)) {
      return json({ ok: true, created: false, temp_password: null });
    }

    const tempPassword = randomTempPassword();
    const { error: createErr } = await svc.auth.admin.createUser({
      email: targetEmail, password: tempPassword, email_confirm: true,
    });
    if (createErr) {
      console.error("admin-create-auth-user createUser", createErr);
      return json({ error: "could not create the sign-in account" }, 500);
    }

    return json({ ok: true, created: true, temp_password: tempPassword });
  } catch (e) {
    console.error("admin-create-auth-user", e);
    return json({ error: "internal error" }, 500);
  }
});
