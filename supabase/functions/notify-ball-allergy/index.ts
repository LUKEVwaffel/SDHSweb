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
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { signup_id } = await req.json().catch(() => ({}));
    if (!signup_id) return json({ error: "signup_id required" }, 400);

    const svc = serviceClient();

    const { data: signup, error } = await svc
      .from("ball_signups")
      .select("cadet_name, cadet_has_allergy")
      .eq("id", signup_id)
      .maybeSingle();
    if (error) { console.error("notify-ball-allergy lookup", error); return json({ error: "internal error" }, 500); }
    if (!signup) return json({ error: "not_found" }, 404);
    if (!signup.cadet_has_allergy) return json({ ok: true, notified: 0 });

    const { data: s5, error: rErr } = await svc
      .from("admin_roles").select("email").eq("role", "s5");
    if (rErr) return json({ error: rErr.message }, 500);
    const recipients = (s5 ?? []).map((r: { email: string }) => r.email).filter(Boolean);
    if (!recipients.length) return json({ ok: true, notified: 0 });

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);
    const origin = siteOrigin();
    const link = origin ? `${origin}/admin/ballallergy` : null;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: recipients,
        subject: `New Ball allergy flag: ${signup.cadet_name}`,
        html: `<p><strong>${escapeHtml(signup.cadet_name)}</strong> flagged a food allergy on their Military Ball signup.</p>
<p>Follow up with them directly about food options.${link ? ` <a href="${escapeHtml(link)}">Open the Ball allergy list in DISPATCH</a>.` : ""}</p>`,
        text: `${signup.cadet_name} flagged a food allergy on their Military Ball signup. Follow up directly.${link ? `\n\n${link}` : ""}`,
      }),
    });

    return json({ ok: true, notified: res.ok ? recipients.length : 0 });
  } catch (e) {
    console.error("notify-ball-allergy", e);
    return json({ error: "internal error" }, 500);
  }
});
