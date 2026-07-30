// Edge function: notify-question-submitted
// Fires after a visitor submits a question via the About page FAQ box
// (public INSERT into faq_questions — see faq_questions.sql). Notifies every
// s6 account (admin_roles.role='s6', never hardcoded to specific emails) by
// Resend email. The in-DISPATCH side of the notification (OverviewPanel
// "NEW FAQ QUESTIONS" card) reads faq_questions directly and needs no push
// from this function.
//
// Public-triggered, same as send-email: deploy with
//   supabase functions deploy notify-question-submitted --no-verify-jwt
// The row insert (RLS, public-insert) is the real gate on what gets stored;
// this function only sends a best-effort email on top of an already-committed
// row, so a failure here must not be treated as a failed submission by the
// caller.
import { json, preflight, escapeHtml, siteOrigin } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { question_id } = await req.json().catch(() => ({}));
    if (!question_id) return json({ error: "question_id required" }, 400);

    const svc = serviceClient();

    const { data: q, error: qErr } = await svc
      .from("faq_questions").select("*").eq("id", question_id).single();
    if (qErr || !q) return json({ error: "question not found" }, 404);

    const { data: s6, error: rErr } = await svc
      .from("admin_roles").select("email").eq("role", "s6");
    if (rErr) return json({ error: rErr.message }, 500);
    const recipients = (s6 ?? []).map((r: { email: string }) => r.email).filter(Boolean);
    if (!recipients.length) return json({ error: "no s6 accounts configured" }, 400);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);
    const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
    const origin = siteOrigin();
    const link = origin ? `${origin}/admin/questions` : null;

    const who = q.submitter_name || q.submitter_email
      ? `${escapeHtml(q.submitter_name || "Anonymous")}${q.submitter_email ? ` (${escapeHtml(q.submitter_email)})` : ""}`
      : "Anonymous visitor";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: recipients,
        subject: "New FAQ question submitted",
        html: `<p>A new question was submitted on the About page FAQ:</p>
<p><strong>${escapeHtml(q.question)}</strong></p>
<p>From: ${who}</p>
${link ? `<p><a href="${escapeHtml(link)}">Open DISPATCH</a> to review it.</p>` : ""}`,
        text: `New FAQ question from ${who}: ${q.question}${link ? `\n\n${link}` : ""}`,
      }),
    });

    if (!res.ok) {
      return json({ error: `Resend ${res.status}` }, 502);
    }
    return json({ ok: true, notified: recipients.length });
  } catch (e) {
    console.error("notify-question-submitted", e);
    return json({ error: "internal error" }, 500);
  }
});
