// Edge function: admin-delete-auth-user
// S-6 ONLY. Full purge, not a deactivate: removes the person's row from
// every portal table this system has (email_reviewers, ball_dress_staff,
// rifle_admins, admin_roles — each best-effort, a missing row in any one is
// not an error) and then deletes the underlying Supabase Auth user itself.
// Deleting the Auth user alone already ends every session and blocks every
// future sign-in for that email; the table cleanup is just hygiene so no
// pin_hash / credentials rows are left behind pointing at a login that no
// longer exists.
//
// Unlike admin-set-portal-active, this DOES include admin_roles — "delete
// entirely" means entirely, DISPATCH access included. This is the one AUTH
// tab action that crosses into the People panel's population; every other
// action in this file stays out of it.
//
// Refuses to delete the caller's own account — no recovery path exists for
// an S-6 who locks themselves out this way.
//
// Deploy WITH jwt verification (default):
//   supabase functions deploy admin-delete-auth-user
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";

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
    if (targetEmail === caller.email) return json({ error: "you can't delete your own account from here" }, 400);

    const svc = serviceClient();

    await Promise.all([
      svc.from("email_reviewers").delete().eq("email", targetEmail),
      svc.from("ball_dress_staff").delete().eq("email", targetEmail),
      svc.from("rifle_admins").delete().eq("email", targetEmail),
      svc.from("admin_roles").delete().eq("email", targetEmail),
    ].map((p) => p.catch((e) => console.error("admin-delete-auth-user table cleanup", e))));

    const { error: authErr } = await svc.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error("admin-delete-auth-user deleteUser", authErr);
      return json({ error: `portal rows removed, but auth login removal failed: ${authErr.message}` }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("admin-delete-auth-user", e);
    return json({ error: "internal error" }, 500);
  }
});
