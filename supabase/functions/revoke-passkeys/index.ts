// Edge function: revoke-passkeys
// Deletes ALL passkeys (WebAuthn credentials) for an account. AUTHENTICATED and
// SELF-ONLY — the caller may revoke passkeys ONLY for their own account. No S-6
// override. Deploy WITH JWT verification (default).
// The register/verify halves of the passkey flow arrive with the WebAuthn edge
// functions; revoke is safe to ship now so the Accounts panel button works.
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "not authenticated" }, 401);

    const { email } = await req.json().catch(() => ({}));
    const target = String(email || "").toLowerCase();
    if (!target) return json({ error: "email required" }, 400);

    // SELF-ONLY: no S-6 override — a caller may only revoke their own passkeys.
    if (caller.email !== target) return json({ error: "forbidden" }, 403);

    const { error, count } = await serviceClient()
      .from("webauthn_credentials")
      .delete({ count: "exact" })
      .eq("account_email", target);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, revoked: count ?? 0 });
  } catch (e) {
    console.error("revoke-passkeys", e);
    return json({ error: "internal error" }, 500);
  }
});
