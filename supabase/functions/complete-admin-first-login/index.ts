// Edge function: complete-admin-first-login
// Clears a DISPATCH admin's must_change_password flag after they've
// successfully called supabase.auth.updateUser({ password }) on the client.
// Direct port of complete-first-login (reviewer version) onto admin_roles.
// AUTHENTICATED and SELF-ONLY via getCaller() — an admin can only ever clear
// their own flag, and the write goes through the service-role client rather
// than a client-side UPDATE grant, same posture as every other credential
// mutation in this codebase (set-pin, clear-pin, submit-review-decision).
// Deliberately does NOT check caller.mustChangePassword before running — this
// is the one path that clears it, so it must be callable regardless of its
// current value.
// Deploy WITH JWT verification (default).
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "not authorized" }, 403);

    const { error } = await serviceClient()
      .from("admin_roles")
      .update({ must_change_password: false })
      .eq("email", caller.email);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (e) {
    console.error("complete-admin-first-login", e);
    return json({ error: "internal error" }, 500);
  }
});
