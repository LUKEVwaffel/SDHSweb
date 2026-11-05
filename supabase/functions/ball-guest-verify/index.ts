// Edge function: ball-guest-verify
// PUBLIC, pre-auth. The guest's one-time tokenized page (/ball/guest/:token)
// submits here: sets allergies + dress_code_accepted_at + verified_at on the
// ball_guests row, flips the parent ball_signups.status to 'fully_verified',
// and — if the cadet gave a notification_email — emails them that their
// guest is verified. No login of any kind; the unguessable token IS the auth.
//
// Deploy WITHOUT jwt verification:
//   supabase functions deploy ball-guest-verify --no-verify-jwt
import { escapeHtml, json, preflight, siteOrigin } from "../_shared/http.ts";
import { BALL_NOTIFY_BCC } from "../_shared/ballNotify.ts";
import { completeBallGuestVerification } from "../_shared/ballGuestVerification.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { ballEmailShell } from "../_shared/ballEmail.ts";
import {
  isDisabled,
  loadBallTemplate,
  paras,
  pick,
} from "../_shared/ballTemplate.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { token, allergies, accepted_dress_code, phone, peek } = await req
      .json().catch(() => ({}));
    const tok = String(token || "").trim();
    const phoneClean = String(phone || "").trim();
    if (!tok) return json({ error: "invalid" }, 400);

    // peek: read-only context for the verify page (no mutation). Lets the page
    // scope the dress code + approver contacts to THIS guest's gender so a male
    // guest never sees the female rules and vice versa.
    if (peek === true) {
      const svcPeek = serviceClient();
      const { data: g, error: peekError } = await svcPeek
        .from("ball_guests")
        .select("gender, name, verified_at, ball_signups(cadet_name)")
        .eq("verification_token", tok)
        .maybeSingle();
      if (peekError) throw peekError;
      if (!g) return json({ error: "not_found" }, 404);
      const host =
        (g as { ball_signups?: { cadet_name?: string } }).ball_signups
          ?.cadet_name ?? null;
      return json({
        ok: true,
        gender: g.gender ?? null,
        name: g.name ?? null,
        cadet_name: host,
        verified: !!g.verified_at,
      });
    }

    if (accepted_dress_code !== true) {
      return json({ error: "must accept the dress code" }, 400);
    }
    if (phoneClean.replace(/\D/g, "").length < 10) {
      return json({ error: "a phone number is required" }, 400);
    }

    const svc = serviceClient();

    const { guest, signup, alreadyVerified } =
      await completeBallGuestVerification(svc, tok, {
        phone: phoneClean,
        allergies: typeof allergies === "string"
          ? allergies.trim() || null
          : null,
      });

    try {
      if (!alreadyVerified && signup?.notification_email) {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        const FROM = Deno.env.get("FROM_EMAIL") ??
          "Trojan Battalion <onboarding@resend.dev>";
        const origin = siteOrigin();
        const t = await loadBallTemplate(svc, "guest_verified");
        if (RESEND_API_KEY && !isDisabled(t)) {
          const vars = {
            cadet_name: escapeHtml(signup.cadet_name ?? ""),
            guest_name: escapeHtml(guest.name ?? "your guest"),
            site_url: origin ? escapeHtml(`${origin}/ball`) : "",
          };
          const defaultIntro =
            "Your guest has finished their part of the Military Ball signup. Your guest registration step is complete. Payment, signed forms, and attire approval remain separate requirements.";
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
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: FROM,
              bcc: BALL_NOTIFY_BCC,
              to: [signup.notification_email],
              subject: pick(t, "subject", "Your Ball guest is verified", {
                cadet_name: signup.cadet_name ?? "",
                guest_name: guest.name ?? "",
              }),
              html,
              text:
                "Your guest has finished their part of the Military Ball signup — your guest registration step is complete. Payment, signed forms, and attire approval remain separate requirements.",
            }),
          }).catch((e) =>
            console.error("ball-guest-verify notify cadet email send", e)
          );
        }
      }
    } catch (notificationError) {
      console.error(
        "ball-guest-verify optional notification failed",
        notificationError,
      );
    }
    return json({ ok: true, already_verified: alreadyVerified });
  } catch (e) {
    console.error("ball-guest-verify", e);
    const message=e instanceof Error?e.message:'';
    if(message.startsWith('Invitation not found'))return json({error:message},404);
    if(message.startsWith('This invitation changed'))return json({error:message},409);
    return json({ error: "Could not confirm the reservation. Please retry; a previous save may need to finish." }, 500);
  }
});
