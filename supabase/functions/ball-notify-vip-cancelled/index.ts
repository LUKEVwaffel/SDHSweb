// Edge function: ball-notify-vip-cancelled
// One-off admin action: notify a VIP guest that their Military Ball signup
// was cancelled/removed from ball_vip_signups (see ball-vip-signup memory).
// Takes name/email directly rather than a signup_id lookup, since the caller
// deletes the row separately (before or after this call) — no DB dependency.
//
// Service-role invoked only (default jwt verification, no --no-verify-jwt):
// this is a DISPATCH-triggered action, not a public-facing signup step.
import { json, preflight, escapeHtml } from "../_shared/http.ts";
import { BALL_NOTIFY_BCC } from "../_shared/ballNotify.ts";
import { ballEmailShell } from "../_shared/ballEmail.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { name, email, cc } = await req.json().catch(() => ({}));
    if (!name || !email) return json({ error: "name and email required" }, 400);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);

    const safeName = escapeHtml(name);
    const html = ballEmailShell({
      preheader: "Your Military Ball signup has been cancelled.",
      heading: "Ball Signup Cancelled",
      introHtml: `<p style="margin:0;">Hi ${safeName},</p><p style="margin:12px 0 0;">This confirms your Trojan Battalion Military Ball signup has been cancelled — you're no longer on the guest list.</p>`,
      closingHtml: `<p style="margin:0;">If this was a mistake or you'd like to sign back up, reply to this email or reach out to Chief directly.</p>`,
    });

    const to = [email, ...(Array.isArray(cc) ? cc : [])];
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        bcc: BALL_NOTIFY_BCC,
        to,
        subject: "Military Ball Signup Cancelled",
        html,
        text: `Hi ${name},\n\nThis confirms your Trojan Battalion Military Ball signup has been cancelled — you're no longer on the guest list.\n\nIf this was a mistake or you'd like to sign back up, reply to this email or reach out to Chief directly.`,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("ball-notify-vip-cancelled resend error", body);
      return json({ error: "send failed" }, 502);
    }

    return json({ ok: true, sent_to: to });
  } catch (e) {
    console.error("ball-notify-vip-cancelled", e);
    return json({ error: "internal error" }, 500);
  }
});
