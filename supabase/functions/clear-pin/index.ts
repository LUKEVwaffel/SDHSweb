// Edge function: clear-pin
// Removes an account's PIN (and its lockout state). AUTHENTICATED and SELF-ONLY
// — the caller may clear a PIN ONLY for their own account. No S-6 override.
// Deploy WITH JWT verification (default).
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

    // SELF-ONLY: no S-6 override — a caller may only clear their own PIN.
    if (caller.email !== target) return json({ error: "forbidden" }, 403);

    // Deleting the row clears the hash AND the fail/lock counters at once.
    const { error } = await serviceClient().from("account_credentials").delete().eq("email", target);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (e) {
    console.error("clear-pin", e);
    return json({ error: "internal error" }, 500);
  }
});
