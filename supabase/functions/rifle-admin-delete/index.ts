// Edge function: rifle-admin-delete
// S-6 ONLY. Fully removes a rifle_admins account: deletes the rifle_admins
// row (rifle_account_credentials cascades via its FK — see
// rifle_admin_portal.sql SECTION 2) and deletes the underlying Supabase Auth
// user too, not just deactivates. A stuck/misconfigured account (wrong temp
// password relayed, mid-broken first-login state) can't be fixed by
// reactivating — reactivating upserts onto the SAME auth user and keeps
// whatever password/session state it already has. Deleting both lets
// rifle-admin-set create a genuinely fresh account on the next add.
// Deploy WITH jwt verification (default).
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";

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

    const svc = serviceClient();

    const { error: delErr } = await svc.from("rifle_admins").delete().eq("email", targetEmail);
    if (delErr) {
      console.error("rifle-admin-delete row delete", delErr);
      return json({ error: delErr.message }, 500);
    }

    const { data: existingUsers } = await svc.auth.admin.listUsers();
    const authUser = existingUsers?.users?.find((u) => u.email?.toLowerCase() === targetEmail);
    if (authUser) {
      const { error: authErr } = await svc.auth.admin.deleteUser(authUser.id);
      if (authErr) {
        console.error("rifle-admin-delete auth delete", authErr);
        return json({ error: `row deleted, but auth user removal failed: ${authErr.message}` }, 500);
      }
    }

    return json({ ok: true });
  } catch (e) {
    console.error("rifle-admin-delete", e);
    return json({ error: "internal error" }, 500);
  }
});
