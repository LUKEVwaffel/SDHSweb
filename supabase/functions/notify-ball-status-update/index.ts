// Edge function: notify-ball-status-update
// AUTHENTICATED, is_reviewer()-gated (Backend #1 / Ball ops reuses the
// existing reviewer population). The ops portal's cash/form toggles write
// directly to ball_signups under RLS (see ball_signup.sql's column-guard
// trigger) — this function only sends the optional notification email
// afterward, since RESEND_API_KEY must stay server-side. Fired
// fire-and-forget by BallOpsPortal.jsx right after each toggle succeeds.
// Deploy WITH jwt verification (default).
import { json, preflight, escapeHtml, siteOrigin } from "../_shared/http.ts";
import { serviceClient, getReviewer } from "../_shared/supabase.ts";

const FIELD_LABEL: Record<string, string> = {
  cash: "Cash/check payment has been marked received",
  form: "Your field trip permission form has been marked received",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const reviewer = await getReviewer(req);
    if (!reviewer) return json({ error: "not authorized" }, 403);

    const { signup_id, field } = await req.json().catch(() => ({}));
    if (!signup_id || !FIELD_LABEL[field]) return json({ error: "signup_id and a valid field are required" }, 400);

    const svc = serviceClient();
    const { data: signup, error } = await svc
      .from("ball_signups")
      .select("cadet_name, notification_email")
      .eq("id", signup_id)
      .maybeSingle();
    if (error) { console.error("notify-ball-status-update lookup", error); return json({ error: "internal error" }, 500); }
    if (!signup) return json({ error: "not_found" }, 404);
    if (!signup.notification_email) return json({ ok: true, notified: false });

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
    const origin = siteOrigin();
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [signup.notification_email],
        subject: "Military Ball signup update",
        html: `<p>${escapeHtml(FIELD_LABEL[field])} for ${escapeHtml(signup.cadet_name)}.</p>${origin ? `<p><a href="${escapeHtml(origin)}/ball">${escapeHtml(origin)}/ball</a></p>` : ""}`,
        text: `${FIELD_LABEL[field]} for ${signup.cadet_name}.`,
      }),
    });

    return json({ ok: true, notified: res.ok });
  } catch (e) {
    console.error("notify-ball-status-update", e);
    return json({ error: "internal error" }, 500);
  }
});
