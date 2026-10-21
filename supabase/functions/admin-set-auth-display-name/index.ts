// Edge function: admin-set-auth-display-name
// S-6 ONLY. Names a raw Supabase Auth login that has no portal row yet —
// AuthAccountsTab.jsx shows "Unnamed" for any account created via
// admin-create-auth-user before it's granted a portal (which is normally
// where a display_name first shows up: admin_roles/email_reviewers/
// rifle_admins/ball_dress_staff). Writes to auth.users.raw_user_meta_data
// (svc.auth.admin.updateUserById) since there's no dedicated profile table
// for logins that don't have a portal row yet.
//
// admin_auth_directory.sql's coalesce() only falls back to this metadata
// value when every portal table's name is null — a name set here never
// overrides a portal's own display_name.
//
// Deploy WITH jwt verification (default):
//   supabase functions deploy admin-set-auth-display-name
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== "s6") return json({ error: "not authorized" }, 403);
    if (caller.mustChangePassword) return json({ error: "set your own password first" }, 403);

    const { user_id, display_name } = await req.json().catch(() => ({}));
    const userId = String(user_id || "").trim();
    const name = String(display_name || "").trim();
    if (!userId || !name) return json({ error: "user_id and display_name are required" }, 400);

    const svc = serviceClient();
    const { error } = await svc.auth.admin.updateUserById(userId, {
      user_metadata: { display_name: name },
    });
    if (error) {
      console.error("admin-set-auth-display-name updateUserById", error);
      return json({ error: "could not set the name" }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("admin-set-auth-display-name", e);
    return json({ error: "internal error" }, 500);
  }
});
