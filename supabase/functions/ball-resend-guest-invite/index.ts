// Edge function: ball-resend-guest-invite
// AUTHENTICATED, S-6-only (getCaller + role === "s6", same gate as
// admin-set-reviewer-pin — S-6 is NOT in the email_reviewers population, so
// getReviewer() would wrongly 403 the DISPATCH admin). Re-sends the guest
// invitation email for an existing signup: the same verify link (the guest's
// existing verification_token, unchanged), the same body, and the CURRENT
// field trip PDF from ball_config — so a resend after the form was swapped
// carries the new attachment.
//
// Fired from the DISPATCH Ball Signups overview ("Resend guest email" on a row
// with a guest). Safe to call repeatedly. If the guest has already verified we
// still allow the resend (S-6 may just want them to have the email again), but
// the caller is told.
//
// The email body here is intentionally a copy of the guest-invite block in
// ball-submit-signup/index.ts — keep the two in sync if the wording changes.
//
// Deploy WITH jwt verification (default):
//   supabase functions deploy ball-resend-guest-invite
import { json, preflight, escapeHtml, siteOrigin } from "../_shared/http.ts";
import { BALL_NOTIFY_BCC } from "../_shared/ballNotify.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";
import { ballEmailShell } from "../_shared/ballEmail.ts";
import type { BallEmailParticular } from "../_shared/ballEmail.ts";
import { loadBallTemplate, pick, paras } from "../_shared/ballTemplate.ts";

function fmtLongDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

interface BallCfg {
  ball_date: string | null;
  event_time_text: string | null;
  venue_address: string | null;
  field_trip_form_pdf_url: string | null;
}

function eventParticulars(cfg: BallCfg | null): BallEmailParticular[] {
  const rows: BallEmailParticular[] = [];
  if (cfg?.ball_date) rows.push({ label: "Date", value: escapeHtml(fmtLongDate(cfg.ball_date)) });
  if (cfg?.event_time_text) rows.push({ label: "Time", value: escapeHtml(cfg.event_time_text) });
  if (cfg?.venue_address) rows.push({ label: "Venue", value: escapeHtml(cfg.venue_address) });
  return rows;
}

function fieldTripAttachment(cfg: BallCfg | null): Array<{ filename: string; path: string }> {
  const url = cfg?.field_trip_form_pdf_url;
  return url ? [{ filename: "field-trip-permission-form.pdf", path: url }] : [];
}

// A stored guest counts as an SDHS student (→ needs the field trip form) when
// they're an in-program cadet OR their school is Soddy Daisy High School.
function guestIsSdhs(guest: { is_sdhs_jrotc: boolean | null; school_attended: string | null }): boolean {
  return !!guest.is_sdhs_jrotc || /soddy\s*daisy/i.test(guest.school_attended ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== "s6") return json({ error: "not authorized" }, 403);
    // Service-role client below bypasses RLS — enforce the admin password gate
    // here, same as admin-set-reviewer-pin / ball-dress-set-pin.
    if (caller.mustChangePassword) return json({ error: "set your own password first" }, 403);

    const { signup_id } = await req.json().catch(() => ({}));
    if (!signup_id) return json({ error: "signup_id is required" }, 400);

    const svc = serviceClient();

    const { data: signup, error: sErr } = await svc
      .from("ball_signups")
      .select("id, cadet_name")
      .eq("id", signup_id)
      .maybeSingle();
    if (sErr) { console.error("ball-resend-guest-invite signup lookup", sErr); return json({ error: "internal error" }, 500); }
    if (!signup) return json({ error: "not_found" }, 404);

    const { data: guest, error: gErr } = await svc
      .from("ball_guests")
      .select("name, personal_email, verification_token, is_sdhs_jrotc, school_attended, verified_at")
      .eq("signup_id", signup_id)
      .maybeSingle();
    if (gErr) { console.error("ball-resend-guest-invite guest lookup", gErr); return json({ error: "internal error" }, 500); }
    if (!guest) return json({ error: "this signup has no guest" }, 400);
    if (!guest.personal_email) return json({ error: "no guest email on file" }, 400);
    if (!guest.verification_token) return json({ error: "guest has no verification link" }, 400);

    const { data: cfg } = await svc
      .from("ball_config")
      .select("ball_date, event_time_text, venue_address, field_trip_form_pdf_url")
      .maybeSingle();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
    const origin = siteOrigin();
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);
    if (!origin) return json({ error: "WEBAUTHN_ORIGIN not configured" }, 500);

    const link = `${origin}/ball/guest/${guest.verification_token}`;
    const needsForm = guestIsSdhs(guest);
    const formAttach = needsForm ? fieldTripAttachment(cfg ?? null) : [];
    const formHtml = needsForm
      ? (cfg?.field_trip_form_pdf_url
        ? `<p style="margin:0 0 10px;"><strong style="color:#F4ECD8;">You attend Soddy Daisy High School</strong>, so a signed field trip permission form is also required. It is attached to this email &mdash; print it, sign it (physical signature only), and return it to Chief or 1SG.</p>`
        : `<p style="margin:0 0 10px;"><strong style="color:#F4ECD8;">You attend Soddy Daisy High School</strong>, so a signed field trip permission form is also required. It will be sent separately &mdash; or pick one up from Chief's desk.</p>`)
      : "";
    const formText = needsForm
      ? `\n\nYou attend Soddy Daisy High School, so a signed field trip permission form is also required${cfg?.field_trip_form_pdf_url ? " (attached to this email)" : " — it will be sent separately or picked up from Chief's desk"}. Physical signature only; return it to Chief or 1SG.`
      : "";

    const tGuest = await loadBallTemplate(svc, "guest_invitation");
    const guestName = guest.name ?? "";
    const gVars: Record<string, string> = {
      guest_name: escapeHtml(guestName),
      cadet_name: `<strong style="color:#F4ECD8;">${escapeHtml(signup.cadet_name ?? "")}</strong>`,
      verify_url: escapeHtml(link),
    };
    const guestClosing = paras(pick(
      tGuest,
      "closing_html",
      "This step confirms any food allergies and your review of the attire requirements. Your host's registration is not complete until it is done.",
      gVars,
    ), { lastMargin: "10px" });
    const html = ballEmailShell({
      preheader: `${signup.cadet_name ?? "A cadet"} has invited you to the Trojan Battalion Military Ball.`,
      heading: pick(tGuest, "heading", "You Are Invited", gVars),
      introHtml: paras(pick(
        tGuest,
        "intro_html",
        "{{guest_name}},\n\n{{cadet_name}} has requested the honor of your company at the Trojan Battalion Military Ball.",
        gVars,
      )),
      particulars: eventParticulars(cfg ?? null),
      cta: { label: "Confirm Your Attendance", url: escapeHtml(link) },
      noticeHtml: pick(tGuest, "notice_html", "", gVars) || undefined,
      closingHtml: `${guestClosing}
${formHtml}<p style="margin:0;font-size:12px;color:#8A8266;">If the button does not work, use this link:<br />${escapeHtml(link)}</p>`,
      siteUrl: `${origin}/ball`,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        bcc: BALL_NOTIFY_BCC,
        to: [guest.personal_email],
        subject: pick(tGuest, "subject", "Trojan Battalion Military Ball: Invitation", {
          guest_name: guestName, cadet_name: signup.cadet_name ?? "",
        }),
        html,
        ...(formAttach.length ? { attachments: formAttach } : {}),
        text: `${guestName},

${signup.cadet_name ?? "A cadet"} has requested the honor of your company at the Trojan Battalion Military Ball.
${cfg?.ball_date ? `\nDate:  ${fmtLongDate(cfg.ball_date)}` : ""}${cfg?.event_time_text ? `\nTime:  ${cfg.event_time_text}` : ""}${cfg?.venue_address ? `\nVenue: ${cfg.venue_address}` : ""}

Confirm your attendance here:
${link}

This step confirms any food allergies and your review of the attire requirements. The registration is not complete until it is done.${formText}`,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("ball-resend-guest-invite resend send failed", res.status, detail);
      return json({ error: "the email service rejected the send" }, 502);
    }

    return json({
      ok: true,
      sent_to: guest.personal_email,
      attached_form: formAttach.length > 0,
      already_verified: !!guest.verified_at,
    });
  } catch (e) {
    console.error("ball-resend-guest-invite", e);
    return json({ error: "internal error" }, 500);
  }
});
