// Edge function: admin-clear-reviewer-pin
// S-6 ONLY. Removes a review-portal account's 4-digit PIN and its lockout
// state by deleting the reviewer_credentials row (clears pin_hash +
// pin_fail_count + pin_locked_until at once). The email_reviewers roster row
// is left intact — use the plain PostgREST update (email_reviewers_admin_all
// RLS) to deactivate a reviewer; this only drops the PIN credential.
//
// Doubles as the "reset lockout" action: after this the reviewer has no PIN
// and S-6 sets a fresh one via admin-set-reviewer-pin.
//
// Mirrors clear-reviewer-pin (self-service) but s6-gated with an email param.
// Deploy WITH jwt verification (default):
//   supabase functions deploy admin-clear-reviewer-pin
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

    const { error } = await serviceClient()
      .from("reviewer_credentials").delete().eq("email", targetEmail);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (e) {
    console.error("admin-clear-reviewer-pin", e);
    return json({ error: "internal error" }, 500);
  }
});
