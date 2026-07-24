// Edge function: submit-for-review
// Admin (s6) submits an email draft to ONE chosen reviewer (Chief/SAI, Sgt
// Kaz, or 1SGT — picked in Messages.jsx, not auto-broadcast to all 3). Each
// reviewer has their own Supabase Auth account (email + password), so this
// just sends a plain Resend notification linking to the reviewer portal — no
// per-reviewer token to mint. Deploy WITH jwt verification (caller is an
// authed DISPATCH admin, not pre-auth like pin-login/passkey-login).
//
// assigned_reviewer_email is stored so ReviewPortal can show "assigned to
// you" first — see email_review_assignment.sql. Visibility/authorization
// (RLS + submit-review-decision) stay unscoped on purpose: any active
// reviewer can still act as a fallback even though only one was notified.
//
// STALE-METADATA REQUIREMENT (non-negotiable, from the original spec): every
// transition into pending_review — first submit OR resubmit after a denial —
// MUST null reviewed_by/reviewer_feedback/override_by. Otherwise a resubmitted
// draft would show a reviewer their own or a colleague's prior notes on a
// message they haven't looked at yet.
import { json, preflight, escapeHtml, siteOrigin } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";

const SUBMITTABLE_STATUSES = ["draft", "changes_requested"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== "s6") return json({ error: "not authorized" }, 403);

    const { message_id, reviewer_email } = await req.json().catch(() => ({}));
    if (!message_id) return json({ error: "message_id required" }, 400);
    if (!reviewer_email) return json({ error: "reviewer_email required" }, 400);

    const svc = serviceClient();

    const { data: msg, error: mErr } = await svc
      .from("email_messages").select("*").eq("id", message_id).single();
    if (mErr || !msg) return json({ error: "message not found" }, 404);
    if (!SUBMITTABLE_STATUSES.includes(msg.status)) {
      return json({ error: `cannot submit a message with status '${msg.status}'` }, 409);
    }

    // Look up exactly the one chosen reviewer — never all active reviewers.
    const { data: reviewer, error: rErr } = await svc
      .from("email_reviewers").select("email, display_name")
      .eq("email", reviewer_email).eq("active", true).maybeSingle();
    if (rErr) return json({ error: rErr.message }, 500);
    if (!reviewer) return json({ error: "chosen reviewer is not an active reviewer" }, 400);

    const { error: uErr } = await svc.from("email_messages").update({
      status: "pending_review",
      submitted_at: new Date().toISOString(),
      assigned_reviewer_email: reviewer.email,
      // Null every prior reviewer's fingerprint — a resubmit must look
      // untouched to the next reviewer who opens it.
      reviewed_by: null,
      reviewer_feedback: null,
      reviewed_at: null,
      override_by: null,
      override_at: null,
    }).eq("id", message_id);
    if (uErr) return json({ error: uErr.message }, 500);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
    const origin = siteOrigin();
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);
    if (!origin) return json({ error: "WEBAUTHN_ORIGIN not configured (reused as site origin)" }, 500);

    const link = `${origin}/#review?draft=${encodeURIComponent(message_id)}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [reviewer.email],
        subject: `Review needed: "${msg.subject}"`,
        html: `<p>${escapeHtml(reviewer.display_name)},</p>
<p>A DISPATCH email draft is awaiting your review:</p>
<p><strong>${escapeHtml(msg.subject)}</strong></p>
<p><a href="${escapeHtml(link)}">Open the review portal</a> to sign in and approve or request changes.</p>`,
        text: `${reviewer.display_name}, a DISPATCH email draft ("${msg.subject}") is awaiting your review: ${link}`,
      }),
    });

    if (!res.ok) {
      return json({ error: `failed to notify ${reviewer.email}: Resend ${res.status}` }, 502);
    }
    return json({ ok: true, notified: 1, reviewer: reviewer.display_name });
  } catch (e) {
    console.error("submit-for-review", e);
    return json({ error: "internal error" }, 500);
  }
});
