// Edge function: rifle-clear-pin
// Removes Makaio's PIN (and its lockout state). AUTHENTICATED and SELF-ONLY,
// direct port of clear-pin onto rifle_admins/rifle_account_credentials.
// Deploy WITH JWT verification (default).
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getRifleAdmin } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getRifleAdmin(req);
    if (!caller) return json({ error: "not authenticated" }, 401);

    const { email } = await req.json().catch(() => ({}));
    const target = String(email || "").toLowerCase();
    if (!target) return json({ error: "email required" }, 400);
    if (caller.email !== target) return json({ error: "forbidden" }, 403);

    const { error } = await serviceClient().from("rifle_account_credentials").delete().eq("email", target);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (e) {
    console.error("rifle-clear-pin", e);
    return json({ error: "internal error" }, 500);
  }
});
