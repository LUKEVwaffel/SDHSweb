// Edge function: send-allergy-email
// S-5 (or S-6) ONLY. Sends a food-allergy / accommodation email to ONE flagged
// cadet's personal (non-school) address and marks that record 'contacted'.
//
// This deliberately does NOT go through send-email / the 3-reviewer approval
// portal: that pipeline (Chief/Kaz/1SGT) is for broadcast battalion mail and
// hard-refuses anything not status='approved'. Allergy follow-up is 1:1 food
// logistics, so it gets its own narrow, role-gated path (confirmed with Luke,
// option A1). It reuses Resend and the same FROM_EMAIL secret — only the send
// trigger is separate.
//
// Body: { signup_id, subject, html }  (html is the composed message body)
//
// Deploy WITH jwt verification (default):
//   supabase functions deploy send-allergy-email
import { json, preflight, siteOrigin } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";
import { ballEmailShell } from "../_shared/ballEmail.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller || (caller.role !== "s5" && caller.role !== "s6")) {
      return json({ error: "not authorized" }, 403);
    }
    if (caller.mustChangePassword) return json({ error: "set your own password first" }, 403);

    const { signup_id, subject, html: messageHtml } = await req.json().catch(() => ({}));
    if (!signup_id) return json({ error: "signup_id required" }, 400);
    const subjectClean = String(subject ?? "").trim() || "Military Ball food allergy follow-up";
    const bodyHtml = String(messageHtml ?? "").trim();
    if (!bodyHtml) return json({ error: "message body required" }, 400);

    const svc = serviceClient();
    const { data: signup, error } = await svc
      .from("ball_signups")
      .select("id, cadet_name, cadet_has_allergy, cadet_allergy_email")
      .eq("id", signup_id)
      .maybeSingle();
    if (error) { console.error("send-allergy-email lookup", error); return json({ error: "internal error" }, 500); }
    if (!signup) return json({ error: "not_found" }, 404);
    if (!signup.cadet_has_allergy || !signup.cadet_allergy_email) {
      return json({ error: "that signup has no allergy flag / contact email" }, 400);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);
    const origin = siteOrigin();

    // The S-5 author's message body already carries its own greeting and
    // sign-off — drop it into the shared formal Ball shell as the intro.
    const html = ballEmailShell({
      preheader: "Regarding food accommodations for the Military Ball.",
      heading: "Food Accommodations",
      introHtml: bodyHtml,
      closingHtml: `<p style="margin:0;">You may reply directly to this message to reach S-5.</p>`,
      siteUrl: origin ? `${origin}/ball` : undefined,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [signup.cadet_allergy_email],
        reply_to: caller.email,
        subject: subjectClean,
        html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return json({ error: `send failed (${res.status})`, detail }, 502);
    }

    const { error: updErr } = await svc
      .from("ball_signups")
      .update({ allergy_status: "contacted", allergy_contacted_at: new Date().toISOString() })
      .eq("id", signup.id);
    if (updErr) {
      console.error("send-allergy-email status update", updErr);
      return json({ ok: true, sent: true, status_updated: false, error: updErr.message });
    }

    return json({ ok: true, sent: true, status_updated: true });
  } catch (e) {
    console.error("send-allergy-email", e);
    return json({ error: "internal error" }, 500);
  }
});
