// Edge function: set-reviewer-pin
// Sets/replaces the 4-digit PIN for the CALLING reviewer's own account only.
// No email param, no override path — the target is always the caller
// identified via getReviewer() (checks the JWT against email_reviewers,
// active=true). The PIN is hashed server-side; plaintext never touches the
// database. Deploy WITH JWT verification (default).
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getReviewer } from "../_shared/supabase.ts";
import { hashPin, PIN_RE } from "../_shared/pin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const reviewer = await getReviewer(req);
    if (!reviewer) return json({ error: "not authorized" }, 403);

    const { pin } = await req.json().catch(() => ({}));
    if (!PIN_RE.test(String(pin ?? ""))) return json({ error: "PIN must be exactly 4 digits" }, 400);

    const pin_hash = await hashPin(String(pin));
    const { error } = await serviceClient().from("reviewer_credentials").upsert({
      email: reviewer.email,
      pin_hash,
      pin_fail_count: 0,
      pin_locked_until: null,
      updated_at: new Date().toISOString(),
    });
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (e) {
    console.error("set-reviewer-pin", e);
    return json({ error: "internal error" }, 500);
  }
});
