// Edge function: ball-submit-signup
// PUBLIC, pre-auth. Ball signup Step 4 final submit. Requires a valid
// signupToken (see _shared/signupToken.ts) and re-verifies the cadet
// server-side via the SAME cadet_consent.school_email lookup ball-lookup-cadet
// uses — the client's name/LET/company are never trusted for the row we
// actually write, only used for optimistic display before this call.
//
// Not every cadet brings a guest — `body.guest` is null/omitted for a
// solo signup. When there IS a guest: creates ball_signups
// (status='guest_pending') + ball_guests (generates verification_token),
// then emails the guest their verification link (${siteOrigin()}/ball/guest/
// <token>) via Resend inline — same fetch-to-resend.com shape as
// notify-new-message. When there is NO guest, ball_signups is created
// straight at status='fully_verified' — there's nothing else pending.
//
// Deploy WITHOUT jwt verification:
//   supabase functions deploy ball-submit-signup --no-verify-jwt
import { json, preflight, escapeHtml, siteOrigin } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { verifySignupToken } from "../_shared/signupToken.ts";

function required(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const payload = await verifySignupToken(body?.signupToken);
    if (!payload) return json({ error: "invalid or expired signup session" }, 401);

    const svc = serviceClient();

    // Re-verify identity server-side — never trust client-sent name/LET/company.
    const { data: cadet } = await svc
      .from("cadet_consent")
      .select("id, name, let_level, company")
      .eq("school_email", payload.email)
      .maybeSingle();
    if (!cadet) return json({ error: "cadet not found" }, 401);

    const cadetAge = Number(body?.cadet_age);
    const cadetGender = required(body?.cadet_gender);
    const cadetAllergies = required(body?.cadet_allergies) || null;
    const notificationEmail = required(body?.notification_email) || null;

    if (!cadetGender || !Number.isFinite(cadetAge) || cadetAge <= 0) {
      return json({ error: "cadet age and gender are required" }, 400);
    }

    const hasGuest = body?.guest != null;
    const guest = body?.guest || {};
    const guestName = required(guest.name);
    const guestAge = Number(guest.age);
    const guestGender = required(guest.gender);
    const isSdhsJrotc = !!guest.is_sdhs_jrotc;
    const otherJrotc = !!guest.other_jrotc;
    const otherJrotcSchool = otherJrotc ? required(guest.other_jrotc_school) : null;
    const schoolAttended = isSdhsJrotc ? null : required(guest.school_attended);
    const pocName = isSdhsJrotc ? null : required(guest.poc_name);
    const pocEmail = isSdhsJrotc ? null : required(guest.poc_email);
    const pocPhone = isSdhsJrotc ? null : required(guest.poc_phone);
    const personalEmail = required(guest.personal_email);
    const sdhsMatchedCadetId = isSdhsJrotc ? (required(guest.sdhs_matched_cadet_id) || null) : null;

    if (hasGuest) {
      if (!guestName || !Number.isFinite(guestAge) || guestAge <= 0 || !guestGender || !personalEmail) {
        return json({ error: "guest name, age, gender, and personal email are required" }, 400);
      }
      if (!isSdhsJrotc && (!schoolAttended || !pocName || !pocEmail || !pocPhone)) {
        return json({ error: "school attended and POC name/email/phone are required for a non-SDHS guest" }, 400);
      }
    }

    const { data: signup, error: signupErr } = await svc
      .from("ball_signups")
      .insert({
        cadet_school_email: payload.email,
        cadet_name: cadet.name,
        cadet_let_level: cadet.let_level,
        cadet_company: cadet.company,
        cadet_age: cadetAge,
        cadet_gender: cadetGender,
        cadet_allergies: cadetAllergies,
        notification_email: notificationEmail,
        // No guest → nothing else pending, so this is fully verified at
        // creation. With a guest, verification happens on their own timeline
        // (ball-guest-verify flips this once they finish their part).
        status: hasGuest ? "guest_pending" : "fully_verified",
      })
      .select("id")
      .single();
    if (signupErr || !signup) { console.error("ball-submit-signup insert signup", signupErr); return json({ error: "internal error" }, 500); }

    if (!hasGuest) {
      return json({ ok: true, signup_id: signup.id });
    }

    const verificationToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

    const { error: guestErr } = await svc.from("ball_guests").insert({
      signup_id: signup.id,
      name: guestName,
      age: guestAge,
      gender: guestGender,
      is_sdhs_jrotc: isSdhsJrotc,
      sdhs_matched_cadet_id: sdhsMatchedCadetId,
      other_jrotc: otherJrotc,
      other_jrotc_school: otherJrotcSchool,
      school_attended: schoolAttended,
      poc_name: pocName,
      poc_email: pocEmail,
      poc_phone: pocPhone,
      personal_email: personalEmail,
      verification_token: verificationToken,
    });
    if (guestErr) {
      console.error("ball-submit-signup insert guest", guestErr);
      await svc.from("ball_signups").delete().eq("id", signup.id); // roll back the orphaned signup row
      return json({ error: "internal error" }, 500);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
    const origin = siteOrigin();
    if (RESEND_API_KEY && origin) {
      const link = `${origin}/ball/guest/${verificationToken}`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [personalEmail],
          subject: `You're invited to the Trojan Battalion Military Ball`,
          html: `<p>${escapeHtml(guestName)},</p>
<p><strong>${escapeHtml(cadet.name)}</strong> has invited you to the Trojan Battalion Military Ball as their guest.</p>
<p>Finish your part here: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
<p>This confirms your allergies and that you've read the dress code. The signup isn't complete until you do.</p>`,
          text: `${cadet.name} has invited you to the Trojan Battalion Military Ball as their guest.\n\nFinish your part here: ${link}\n\nThis confirms your allergies and that you've read the dress code. The signup isn't complete until you do.`,
        }),
      }).catch((e) => console.error("ball-submit-signup guest email send", e));
    } else {
      console.error("ball-submit-signup: RESEND_API_KEY or WEBAUTHN_ORIGIN not configured, guest email not sent");
    }

    return json({ ok: true, signup_id: signup.id });
  } catch (e) {
    console.error("ball-submit-signup", e);
    return json({ error: "internal error" }, 500);
  }
});
