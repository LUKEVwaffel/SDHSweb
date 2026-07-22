// Edge function: complete-first-login
// Clears a reviewer's must_change_password flag after they've successfully
// called supabase.auth.updateUser({ password }) on the client. AUTHENTICATED
// and SELF-ONLY via getReviewer() — a reviewer can only ever clear their own
// flag, and the write goes through the service-role client rather than a
// client-side UPDATE grant, same posture as every other credential mutation
// in this codebase (set-pin, clear-pin, submit-review-decision).
// Deploy WITH JWT verification (default).
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getReviewer } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const reviewer = await getReviewer(req);
    if (!reviewer) return json({ error: "not authorized" }, 403);

    const { error } = await serviceClient()
      .from("email_reviewers")
      .update({ must_change_password: false })
      .eq("email", reviewer.email);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (e) {
    console.error("complete-first-login", e);
    return json({ error: "internal error" }, 500);
  }
});
