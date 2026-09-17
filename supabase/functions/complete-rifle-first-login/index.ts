// Edge function: complete-rifle-first-login
// Clears Makaio's must_change_password flag after he's successfully called
// supabase.auth.updateUser({ password }) on the client. Direct port of
// complete-admin-first-login onto rifle_admins. AUTHENTICATED and SELF-ONLY.
// Deliberately does NOT check caller.mustChangePassword before running — this
// is the one path that clears it.
// Deploy WITH JWT verification (default).
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getRifleAdmin } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getRifleAdmin(req);
    if (!caller) return json({ error: "not authorized" }, 403);

    const { error } = await serviceClient()
      .from("rifle_admins")
      .update({ must_change_password: false })
      .eq("email", caller.email);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (e) {
    console.error("complete-rifle-first-login", e);
    return json({ error: "internal error" }, 500);
  }
});
