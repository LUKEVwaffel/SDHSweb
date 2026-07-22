// Edge function: clear-reviewer-pin
// Removes the CALLING reviewer's own PIN (and its lockout state). No email
// param, no override path — same self-only shape as set-reviewer-pin.
// Deploy WITH JWT verification (default).
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getReviewer } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const reviewer = await getReviewer(req);
    if (!reviewer) return json({ error: "not authorized" }, 403);

    // Deleting the row clears the hash AND the fail/lock counters at once.
    const { error } = await serviceClient().from("reviewer_credentials").delete().eq("email", reviewer.email);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (e) {
    console.error("clear-reviewer-pin", e);
    return json({ error: "internal error" }, 500);
  }
});
