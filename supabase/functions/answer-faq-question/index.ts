// Edge function: answer-faq-question
// s6 admin writes an answer in QuestionsPanel.jsx and sends it directly to
// the submitter's email (submitter_email is required — see faq_questions.sql)
// as a real 1:1 reply, then marks the row status='answered'. This is the
// only path to 'answered' — there is no separate "mark answered without
// emailing" action, since the point of requiring email was to make replying
// possible.
//
// Deploy WITH jwt verification (caller is an authed DISPATCH admin, same
// posture as submit-for-review / submit-review-decision) — NOT
// --no-verify-jwt like notify-question-submitted, which fires pre-auth from
// the public FAQ form.
import { json, preflight, escapeHtml } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== "s6") return json({ error: "not authorized" }, 403);
    if (caller.mustChangePassword) return json({ error: "password_change_required" }, 403);

    const { question_id, answer_text } = await req.json().catch(() => ({}));
    const answer = String(answer_text ?? "").trim();
    if (!question_id) return json({ error: "question_id required" }, 400);
    if (!answer) return json({ error: "answer_text required" }, 400);

    const svc = serviceClient();
    const { data: q, error: qErr } = await svc
      .from("faq_questions").select("*").eq("id", question_id).single();
    if (qErr || !q) return json({ error: "question not found" }, 404);
    if (q.status === "answered") return json({ error: "question already answered" }, 409);
    if (!q.submitter_email) return json({ error: "question has no submitter_email to reply to" }, 400);

    const nowIso = new Date().toISOString();
    // Compare-and-swap on the status this row was fetched at (same technique
    // as submit-review-decision) — a concurrent second admin answering the
    // same question sees zero rows affected and gets a 409 instead of
    // clobbering the first admin's answer or double-sending the reply.
    const { data: updated, error: uErr } = await svc
      .from("faq_questions")
      .update({ status: "answered", answer_text: answer, answered_by: caller.email, answered_at: nowIso })
      .eq("id", question_id)
      .eq("status", q.status)
      .select("id");
    if (uErr) return json({ error: uErr.message }, 500);
    if (!updated || updated.length === 0) {
      return json({ error: "question was updated by someone else — refresh and try again" }, 409);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
    if (!RESEND_API_KEY) {
      // Row is already marked answered — the write is the real state change.
      // A missing key is a config problem to surface, not a reason to undo it.
      return json({ ok: true, emailSent: false, error: "RESEND_API_KEY not configured" });
    }

    const greeting = q.submitter_name ? escapeHtml(q.submitter_name) : "there";
    const html = `<p>Hi ${greeting},</p>
<p>You asked:</p>
<p style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #C9A961;color:#444;">${escapeHtml(q.question)}</p>
<p>${escapeHtml(answer).replace(/\n/g, "<br/>")}</p>
<p>— Trojan Battalion</p>`;
    const text = `Hi ${q.submitter_name || "there"},

You asked:
"${q.question}"

${answer}

— Trojan Battalion`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [q.submitter_email],
        subject: "Re: your question to Trojan Battalion",
        html,
        text,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("answer-faq-question resend failed", res.status, detail);
      // Best-effort, same posture as notify-question-submitted: the answer
      // and status change already landed above regardless of send outcome.
      return json({ ok: true, emailSent: false, error: `Resend ${res.status}` });
    }

    return json({ ok: true, emailSent: true });
  } catch (e) {
    console.error("answer-faq-question", e);
    return json({ error: "internal error" }, 500);
  }
});
