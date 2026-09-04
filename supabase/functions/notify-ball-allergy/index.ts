// Edge function: notify-ball-allergy
// Fires after a cadet submits a Ball signup with cadet_has_allergy = true.
// ball-submit-signup invokes this fire-and-forget right after the insert,
// same shape as notify-question-submitted (which pings every s6 on a new FAQ
// question) — here it pings every s5 (S-5 owns food logistics). The in-
// DISPATCH side (S-5's Ball allergy panel pending badge) reads
// ball_allergy_list() directly and needs no push from this function.
//
// Public-triggered (chained off a pre-auth submit). Deploy WITHOUT jwt:
//   supabase functions deploy notify-ball-allergy --no-verify-jwt
import { json, preflight, escapeHtml, siteOrigin } from "../_shared/http.ts";
import { BALL_NOTIFY_BCC } from "../_shared/ballNotify.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { ballEmailShell } from "../_shared/ballEmail.ts";
import { loadBallTemplate, isDisabled, pick, paras } from "../_shared/ballTemplate.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { signup_id } = await req.json().catch(() => ({}));
    if (!signup_id) return json({ error: "signup_id required" }, 400);

    const svc = serviceClient();

    const { data: signup, error } = await svc
      .from("ball_signups")
      .select("cadet_name, cadet_has_allergy, cadet_allergy_email")
      .eq("id", signup_id)
      .maybeSingle();
    if (error) { console.error("notify-ball-allergy lookup", error); return json({ error: "internal error" }, 500); }
    if (!signup) return json({ error: "not_found" }, 404);
    if (!signup.cadet_has_allergy) return json({ ok: true, notified: 0 });

    // Phone in a separate best-effort read so this still works before
    // ball_phone_numbers.sql is run.
    let cadetPhone = "";
    const { data: pRow } = await svc.from("ball_signups").select("cadet_phone").eq("id", signup_id).maybeSingle();
    if (pRow && typeof pRow.cadet_phone === "string") cadetPhone = pRow.cadet_phone;

    const { data: s5, error: rErr } = await svc
      .from("admin_roles").select("email").eq("role", "s5");
    if (rErr) return json({ error: rErr.message }, 500);
    const recipients = (s5 ?? []).map((r: { email: string }) => r.email).filter(Boolean);
    if (!recipients.length) return json({ ok: true, notified: 0 });

    const t = await loadBallTemplate(svc, "allergy_flag");
    if (isDisabled(t)) return json({ ok: true, notified: 0, skipped: true });

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);
    const origin = siteOrigin();
    const link = origin ? `${origin}/admin/ballallergy` : null;

    const cadet = escapeHtml(signup.cadet_name);
    const contactBits: string[] = [];
    if (cadetPhone.replace(/\D/g, "").length >= 10) contactBits.push(`phone <strong>${escapeHtml(cadetPhone)}</strong> (call or text)`);
    if (signup.cadet_allergy_email) contactBits.push(`email ${escapeHtml(signup.cadet_allergy_email)}`);
    const contact = contactBits.length
      ? contactBits.join(" &middot; ")
      : "no phone or email on file — reach them through 1SG Kaz / Chief";
    const vars = { cadet_name: cadet, dispatch_url: link ? escapeHtml(link) : "", contact };
    const defaultIntro = "{{cadet_name}} flagged a food allergy on their Military Ball signup.\n\nReach them: {{contact}}. Call or text is fastest.";
    const closing = pick(t, "closing_html", "", vars);

    const html = ballEmailShell({
      preheader: `${signup.cadet_name} flagged a food allergy on their Ball signup.`,
      heading: pick(t, "heading", "Food Allergy Flagged", vars),
      introHtml: paras(pick(t, "intro_html", defaultIntro, vars)),
      noticeHtml: pick(t, "notice_html", "", vars) || undefined,
      closingHtml: closing ? paras(closing) : undefined,
      cta: link ? { label: "Open the Ball allergy list", url: link } : null,
      siteUrl: origin ? `${origin}/ball` : undefined,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        bcc: BALL_NOTIFY_BCC,
        to: recipients,
        subject: pick(t, "subject", "New Ball allergy flag: {{cadet_name}}", { cadet_name: signup.cadet_name }),
        html,
        text: `${signup.cadet_name} flagged a food allergy on their Military Ball signup. Follow up directly.${link ? `\n\n${link}` : ""}`,
      }),
    });

    return json({ ok: true, notified: res.ok ? recipients.length : 0 });
  } catch (e) {
    console.error("notify-ball-allergy", e);
    return json({ error: "internal error" }, 500);
  }
});
