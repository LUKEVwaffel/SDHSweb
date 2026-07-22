// Edge function: submit-review-decision
// A reviewer (Chief/SAI, Sgt Kaz, or 1SGT) approves or denies a pending draft.
// Reviewer already holds a real Supabase session (signed in with their own
// email+password account via the ReviewLogin form), so this deploys WITH jwt
// verification — same posture as set-pin/clear-pin/revoke-passkeys. getReviewer
// only checks the JWT email against email_reviewers, so it works the same
// regardless of how the session was authenticated.
//
// reviewed_by is ALWAYS derived from the caller's JWT (getReviewer), never
// from client input — a reviewer cannot attribute a decision to someone else.
import { json, preflight, escapeHtml } from "../_shared/http.ts";
import { serviceClient, getReviewer } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const reviewer = await getReviewer(req);
    if (!reviewer) return json({ error: "not authorized" }, 403);
    // Server-side enforcement of the first-login gate — the client's
    // ForcePasswordChange screen is a UI nicety, not a control. A session
    // minted from a leaked/guessed dashboard-issued temp password must not be
    // able to approve or deny real outgoing DISPATCH email before the
    // reviewer has ever set their own password. RLS-level reads are gated via
    // is_reviewer() (see email_reviewer_first_login.sql); this is the
    // matching check for the write path, which runs on the service-role
    // client and therefore bypasses RLS entirely.
    if (reviewer.mustChangePassword) {
      return json({ error: "password change required before reviewing" }, 403);
    }

    const { message_id, decision, feedback } = await req.json().catch(() => ({}));
    if (!message_id || !["approve", "deny"].includes(decision)) {
      return json({ error: "message_id and decision ('approve'|'deny') required" }, 400);
    }
    const feedbackText = String(feedback ?? "").trim();
    if (decision === "deny" && !feedbackText) {
      return json({ error: "feedback is required when denying" }, 400);
    }

    const svc = serviceClient();
    const { data: msg, error: mErr } = await svc
      .from("email_messages").select("id, subject, created_by, status").eq("id", message_id).single();
    if (mErr || !msg) return json({ error: "message not found" }, 404);
    // Defense in depth beyond the RLS keyhole (email_messages_read_reviewer):
    // a stale/reused review link can't act on a message that already moved on.
    if (msg.status !== "pending_review") {
      return json({ error: `message is no longer pending review (status: ${msg.status})` }, 409);
    }

    const nowIso = new Date().toISOString();
    const update = decision === "approve"
      ? { status: "approved", reviewed_by: reviewer.email, reviewed_at: nowIso, reviewer_feedback: null }
      : { status: "changes_requested", reviewed_by: reviewer.email, reviewed_at: nowIso, reviewer_feedback: feedbackText };

    // Compare-and-swap on status, not just id: the SELECT above and this UPDATE
    // are two round-trips, so a concurrent second request (double-submit,
    // retried invoke()) could otherwise pass the same pending_review check and
    // both write — last write silently clobbering the other's decision. Tying
    // the UPDATE's WHERE to status='pending_review' makes only the first
    // writer succeed; the loser sees zero rows affected and 409s instead of
    // overwriting.
    const { data: updated, error: uErr } = await svc
      .from("email_messages")
      .update(update)
      .eq("id", message_id)
      .eq("status", "pending_review")
      .select("id");
    if (uErr) return json({ error: uErr.message }, 500);
    if (!updated || updated.length === 0) {
      return json({ error: "message is no longer pending review" }, 409);
    }

    // Append to the permanent decision log (email_review_history.sql). Unlike
    // the columns above — which submit-for-review nulls on every resubmit —
    // nothing ever overwrites this, so it's the only place "what have I
    // personally said on any draft" can be answered from. subject is
    // snapshotted here (not read via join later) so history survives even if
    // the message row is ever deleted — message_id is ON DELETE SET NULL for
    // the same reason. Best-effort: the decision itself already landed above
    // regardless of this insert.
    const { error: logErr } = await svc.from("email_review_decisions").insert({
      message_id,
      subject: msg.subject,
      reviewer_email: reviewer.email,
      decision,
      feedback: decision === "deny" ? feedbackText : null,
    });
    if (logErr) console.error("email_review_decisions insert failed", logErr);

    // Notify the submitting admin. Best-effort — the decision itself already
    // landed above regardless of notification delivery.
    if (msg.created_by) {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
      if (RESEND_API_KEY) {
        const verb = decision === "approve" ? "APPROVED" : "CHANGES REQUESTED";
        const feedbackHtml = decision === "deny"
          ? `<p><strong>Feedback:</strong> ${escapeHtml(feedbackText)}</p>`
          : "";
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM,
            to: [msg.created_by],
            subject: `${verb}: "${msg.subject}"`,
            html: `<p>Your draft "<strong>${escapeHtml(msg.subject)}</strong>" was reviewed.</p><p><strong>${verb}</strong></p>${feedbackHtml}`,
            text: `Your draft "${msg.subject}" was reviewed: ${verb}.${decision === "deny" ? ` Feedback: ${feedbackText}` : ""}`,
          }),
        }).catch((e) => console.error("submit-review-decision notify admin failed", e));
      }
    }

    return json({ ok: true, status: update.status });
  } catch (e) {
    console.error("submit-review-decision", e);
    return json({ error: "internal error" }, 500);
  }
});
