// Edge function: ball-guest-verify
// PUBLIC, pre-auth. The guest's one-time tokenized page (/ball/guest/:token)
// submits here: sets allergies + dress_code_accepted_at + verified_at on the
// ball_guests row, flips the parent ball_signups.status to 'fully_verified',
// and — if the cadet gave a notification_email — emails them that their
// guest is verified. No login of any kind; the unguessable token IS the auth.
//
// Deploy WITHOUT jwt verification:
//   supabase functions deploy ball-guest-verify --no-verify-jwt
import { json, preflight, escapeHtml, siteOrigin } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { ballEmailShell } from "../_shared/ballEmail.ts";
import { loadBallTemplate, isDisabled, pick, paras } from "../_shared/ballTemplate.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { token, allergies, accepted_dress_code } = await req.json().catch(() => ({}));
    const tok = String(token || "").trim();
    if (!tok) return json({ error: "invalid" }, 400);
    if (!accepted_dress_code) return json({ error: "must accept the dress code" }, 400);

    const svc = serviceClient();

    const { data: guest } = await svc
      .from("ball_guests")
      .select("id, signup_id, verified_at, name")
      .eq("verification_token", tok)
      .maybeSingle();
    if (!guest) return json({ error: "not_found" }, 404);
    if (guest.verified_at) return json({ ok: true, already_verified: true });

    const now = new Date().toISOString();
    const { error: guestErr } = await svc
      .from("ball_guests")
      .update({
        allergies: typeof allergies === "string" ? allergies.trim() || null : null,
        dress_code_accepted_at: now,
        verified_at: now,
      })
      .eq("id", guest.id);
    if (guestErr) { console.error("ball-guest-verify update guest", guestErr); return json({ error: "internal error" }, 500); }

    const { data: signup, error: signupErr } = await svc
      .from("ball_signups")
      .update({ status: "fully_verified" })
      .eq("id", guest.signup_id)
      .select("cadet_name, notification_email")
      .single();
    if (signupErr) { console.error("ball-guest-verify update signup", signupErr); return json({ error: "internal error" }, 500); }

    if (signup?.notification_email) {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
      const origin = siteOrigin();
      const t = await loadBallTemplate(svc, "guest_verified");
      if (RESEND_API_KEY && !isDisabled(t)) {
        const vars = {
          cadet_name: escapeHtml(signup.cadet_name ?? ""),
          guest_name: escapeHtml(guest.name ?? "your guest"),
          site_url: origin ? escapeHtml(`${origin}/ball`) : "",
        };
        const defaultIntro = "Your guest has finished their part of the Military Ball signup. Your entry is now fully verified.";
        const closing = pick(t, "closing_html", "", vars);
        const html = ballEmailShell({
          preheader: "Your Military Ball guest has been verified.",
          heading: pick(t, "heading", "Guest Confirmed", vars),
          introHtml: paras(pick(t, "intro_html", defaultIntro, vars)),
          noticeHtml: pick(t, "notice_html", "", vars) || undefined,
          closingHtml: closing ? paras(closing) : undefined,
          siteUrl: origin ? `${origin}/ball` : undefined,
        });
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM,
            to: [signup.notification_email],
            subject: pick(t, "subject", "Your Ball guest is verified", { cadet_name: signup.cadet_name ?? "", guest_name: guest.name ?? "" }),
            html,
            text: "Your guest has finished their part of the Military Ball signup — your entry is now fully verified.",
          }),
        }).catch((e) => console.error("ball-guest-verify notify cadet email send", e));
      }
    }

    return json({ ok: true });
  } catch (e) {
    console.error("ball-guest-verify", e);
    return json({ error: "internal error" }, 500);
  }
});
