// Edge function: rifle-admin-set
// S-6 ONLY. Provisions a rifle_admins account — previously this required
// Luke to hand-create the Supabase Auth user in the dashboard AND hand-insert
// the rifle_admins row via the SQL editor (see rifle_admin_portal.sql's
// original comment). This is that same two-step flow, just as one DISPATCH
// button: creates the Auth user with a random temp password if it doesn't
// exist yet, upserts the rifle_admins row (must_change_password stays true
// on a fresh create so RifleForcePasswordChange still forces a real password
// on first login), and hands the temp password back ONCE so S-6 can relay it
// — it is never stored or retrievable after this response.
// Deploy WITH jwt verification (default).
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

    const { email, name } = await req.json().catch(() => ({}));
    const targetEmail = String(email || "").trim().toLowerCase();
    const targetName = String(name || "").trim();
    if (!targetEmail || !targetName) return json({ error: "name and email are required" }, 400);

    const svc = serviceClient();

    let tempPassword: string | null = null;
    const { data: existingUsers } = await svc.auth.admin.listUsers();
    const already = existingUsers?.users?.some((u) => u.email?.toLowerCase() === targetEmail);
    if (!already) {
      tempPassword = randomTempPassword();
      const created = await svc.auth.admin.createUser({
        email: targetEmail, password: tempPassword, email_confirm: true,
      });
      if (created.error) {
        console.error("rifle-admin-set createUser", created.error);
        return json({ error: "could not create the sign-in account" }, 500);
      }
    }

    const { error } = await svc.from("rifle_admins").upsert({
      email: targetEmail,
      display_name: targetName,
      active: true,
      // Only re-arm the forced password change for a brand-new account —
      // re-adding/reactivating an existing admin must not throw away a
      // password they already set.
      ...(tempPassword ? { must_change_password: true } : {}),
    });
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, temp_password: tempPassword });
  } catch (e) {
    console.error("rifle-admin-set", e);
    return json({ error: "internal error" }, 500);
  }
});
