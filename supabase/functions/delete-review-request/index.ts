// Edge function: delete-review-request
// A reviewer deletes a pending review request from the review portal side.
// Reviewers have NO delete RLS policy on email_messages by design (only the
// scoped SELECT in email_review.sql's email_messages_read_reviewer) — this is
// the sanctioned write path, mirroring submit-review-decision's shape exactly:
// getReviewer() auth, must_change_password gate, service-role client, and a
// status check so a stale/reused link can't delete a message that already
// moved on (approved/denied/sent) since the reviewer opened it.
//
// Any active reviewer may delete any pending_review row, not just ones
// assigned to them — same "any reviewer can act as fallback" posture as
// submit-review-decision.
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getReviewer } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const reviewer = await getReviewer(req);
    if (!reviewer) return json({ error: "not authorized" }, 403);
    if (reviewer.mustChangePassword) {
      return json({ error: "password change required before reviewing" }, 403);
    }

    const { message_id } = await req.json().catch(() => ({}));
    if (!message_id) return json({ error: "message_id required" }, 400);

    const svc = serviceClient();

    // Delete constrained to status='pending_review' in the query itself (not
    // a separate SELECT-then-DELETE) — no window for a race to slip through.
    // subject comes back off the DELETE...RETURNING so the audit row below
    // can snapshot it without a second round trip.
    const { data: deleted, error } = await svc
      .from("email_messages")
      .delete()
      .eq("id", message_id)
      .eq("status", "pending_review")
      .select("id, subject");
    if (error) return json({ error: error.message }, 500);
    if (!deleted || deleted.length === 0) {
      return json({ error: "request already gone or no longer pending review" }, 409);
    }

    // Audit trail — same append-only log submit-review-decision writes to,
    // so a deletion shows up in the reviewer's own "My History" tab instead
    // of vanishing with zero record of who removed it. Best-effort: the
    // delete itself already landed above regardless of this insert.
    const { error: logErr } = await svc.from("email_review_decisions").insert({
      message_id: null, // the row is gone; nothing to reference
      subject: deleted[0].subject,
      reviewer_email: reviewer.email,
      decision: "delete",
    });
    if (logErr) console.error("email_review_decisions delete-log insert failed", logErr);

    return json({ ok: true });
  } catch (e) {
    console.error("delete-review-request", e);
    return json({ error: "internal error" }, 500);
  }
});
