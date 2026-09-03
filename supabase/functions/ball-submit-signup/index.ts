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
import { ballEmailShell } from "../_shared/ballEmail.ts";
import type { BallEmailParticular } from "../_shared/ballEmail.ts";

function required(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function fmtLongDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

interface BallCfg {
  signup_deadline: string | null;
  ball_date: string | null;
  event_time_text: string | null;
  venue_address: string | null;
  price_cadet: number | null;
  price_couple: number | null;
}

function money(n: number | null): string | null {
  return n == null ? null : `$${Number(n).toFixed(Number.isInteger(Number(n)) ? 0 : 2)}`;
}

// Event particulars shared by both emails — pre-escaped label/value rows.
function eventParticulars(cfg: BallCfg | null): BallEmailParticular[] {
  const rows: BallEmailParticular[] = [];
  if (cfg?.ball_date) rows.push({ label: "Date", value: escapeHtml(fmtLongDate(cfg.ball_date)) });
  if (cfg?.event_time_text) rows.push({ label: "Time", value: escapeHtml(cfg.event_time_text) });
  if (cfg?.venue_address) rows.push({ label: "Venue", value: escapeHtml(cfg.venue_address) });
  return rows;
}

interface ConfirmInfo {
  name: string;
  letLevel: string | null;
  company: string | null;
  isFemale: boolean;
  hasGuest: boolean;
  hasAllergy: boolean;
  cfg: BallCfg | null;
  amountDue: number | null;
  fieldTripFormRequired: boolean;
  guestType: "date" | "friend" | null;
  friendName: string | null;
  friendAmountDue: number | null;
  friendPaymentMethod: "host_delivers" | "self_pays" | null;
}

// Registration receipt for the cadet. Not a click-to-verify link (that's the
// guest flow) — a formal "your registration is received, here is what remains"
// notice, rendered in the shared Ball email shell (SDHSweb design system).
async function sendCadetConfirmation(to: string, info: ConfirmInfo): Promise<void> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
  if (!RESEND_API_KEY) {
    console.error("ball-submit-signup: RESEND_API_KEY not configured, cadet confirmation not sent");
    return;
  }

  const amount = money(info.amountDue);
  const todo: string[] = [];
  if (info.fieldTripFormRequired) {
    todo.push("Submit your <strong>signed field trip permission form</strong> (physical signature only) to 1SG Kaz or Chief.");
  }
  todo.push(
    amount
      ? `Render payment of <strong>${amount}</strong> in full, by cash or check, to 1SG Kaz or Chief.`
      : "Render payment <strong>in full</strong>, by cash or check, to 1SG Kaz or Chief.",
  );
  if (info.guestType === "friend" && info.friendName) {
    const fa = money(info.friendAmountDue);
    const how = info.friendPaymentMethod === "host_delivers"
      ? "which you will bring in with your own"
      : "which they will pay or deliver themselves";
    todo.push(
      `Your friend <strong>${escapeHtml(info.friendName)}</strong> owes their own${fa ? ` <strong>${fa}</strong>` : " payment"}, ${how}. This is separate from your total above.`,
    );
  }
  if (info.isFemale) {
    todo.push("Obtain <strong>dress approval</strong>: text a photograph of your attire to one of the approvers listed on the registration page.");
  } else {
    todo.push("Report in your <strong>full Class A uniform</strong> (JROTC-issued). Direct any questions to Weston.");
  }
  if (info.hasGuest) {
    todo.push("Your <strong>guest</strong> has been sent a separate notice. Your registration is not fully verified until they complete it.");
  }
  if (info.hasAllergy) {
    todo.push("<strong>S-5 will contact you</strong> regarding food accommodations for your allergy.");
  }

  const meta = [info.letLevel ? `LET ${escapeHtml(info.letLevel)}` : "", info.company ? `${escapeHtml(info.company)} Company` : ""]
    .filter(Boolean).join(" &middot; ");

  const deadlinePretty = info.cfg?.signup_deadline
    ? escapeHtml(new Date(`${info.cfg.signup_deadline}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))
    : null;

  const html = ballEmailShell({
    preheader: "Your Military Ball registration has been received.",
    heading: "Registration Received",
    introHtml: `<p style="margin:0 0 12px;">${escapeHtml(info.name)},</p>
<p style="margin:0;">Your registration for the Trojan Battalion Military Ball has been received and recorded${meta ? ` (${meta})` : ""}.</p>`,
    particulars: eventParticulars(info.cfg),
    listTitle: "What Remains",
    listItems: todo,
    noticeHtml: deadlinePretty
      ? `All items above must be completed on or before <strong>${deadlinePretty}</strong>.`
      : undefined,
    closingHtml: `<p style="margin:0;">You will receive further notice as your payment${info.fieldTripFormRequired ? " and permission form are" : " is"} recorded${info.hasGuest ? ", and once your guest confirms" : ""}.</p>`,
    siteUrl: siteOrigin() ? `${siteOrigin()}/ball` : undefined,
  });

  const text = `${info.name},

Your registration for the Trojan Battalion Military Ball has been received${meta ? ` (${meta.replace(/&middot;/g, "·")})` : ""}.

${info.cfg?.ball_date ? `Date:  ${fmtLongDate(info.cfg.ball_date)}\n` : ""}${info.cfg?.event_time_text ? `Time:  ${info.cfg.event_time_text}\n` : ""}${info.cfg?.venue_address ? `Venue: ${info.cfg.venue_address}\n` : ""}
What remains:
${todo.map((t) => `- ${t.replace(/<[^>]+>/g, "")}`).join("\n")}
${deadlinePretty ? `\nAll items due on or before ${deadlinePretty}.` : ""}`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: "Trojan Battalion Military Ball: Registration Received",
      html,
      text,
    }),
  });
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

    const { data: cfg } = await svc
      .from("ball_config")
      .select("signup_deadline, ball_date, event_time_text, venue_address, price_cadet, price_couple")
      .maybeSingle();

    // Item 1: server-side deadline enforcement. The landing page disables its
    // CTA when closed, but /ball/signup is a direct route with no gate, so this
    // is the authoritative stop. signup_deadline is a DATE — compare on the
    // calendar day in the event's local zone (US Central), and treat the
    // deadline day itself as still open.
    if (cfg?.signup_deadline) {
      const todayCentral = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
      if (todayCentral > cfg.signup_deadline) {
        return json({ error: "Signups are closed — the deadline has passed." }, 403);
      }
    }

    const cadetAge = Number(body?.cadet_age);
    const cadetGender = required(body?.cadet_gender);
    const notificationEmail = required(body?.notification_email) || null;

    // Item 2: allergy is a yes/no flag — NO details collected here. If yes, a
    // personal (non-school) email is REQUIRED so S-5 can follow up directly.
    const cadetHasAllergy = body?.cadet_has_allergy === true;
    const cadetAllergyEmail = required(body?.cadet_allergy_email) || null;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cadetGender || !Number.isFinite(cadetAge) || cadetAge <= 0) {
      return json({ error: "cadet age and gender are required" }, 400);
    }
    if (cadetHasAllergy && (!cadetAllergyEmail || !EMAIL_RE.test(cadetAllergyEmail))) {
      return json({ error: "a personal email is required when a food allergy is flagged" }, 400);
    }

    const hasGuest = body?.guest != null;
    const guest = body?.guest || {};
    // 'date' → couple rate, may be in-program (roster tag) or out-of-program.
    // 'friend' → OUT-OF-PROGRAM ONLY, host pays only their own rate, friend
    // owes their own separately.
    const guestType: "date" | "friend" | null = hasGuest
      ? (guest.guest_type === "friend" ? "friend" : "date")
      : null;
    // A friend is out-of-program by definition — never trust an is_sdhs flag on
    // a friend, and never carry a roster match for one.
    const isSdhsJrotc = guestType === "date" && !!guest.is_sdhs_jrotc;
    const friendPaymentMethod: "host_delivers" | "self_pays" | null = guestType === "friend"
      ? (guest.friend_payment_method === "host_delivers" || guest.friend_payment_method === "self_pays"
        ? guest.friend_payment_method
        : null)
      : null;
    const guestName = required(guest.name);
    const guestAge = Number(guest.age);
    const guestGender = required(guest.gender);
    // A non-roster guest (manual date or any friend) who attends SDHS but is
    // NOT a cadet: school is fixed, the other-school questions don't apply.
    const goesToSdhs = !isSdhsJrotc && guest.goes_to_sdhs === true;
    const otherJrotc = !isSdhsJrotc && !goesToSdhs && !!guest.other_jrotc;
    const otherJrotcSchool = otherJrotc ? required(guest.other_jrotc_school) : null;
    const schoolAttended = isSdhsJrotc
      ? null
      : (goesToSdhs ? "Soddy Daisy High School" : required(guest.school_attended));
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
      if (guestType === "friend") {
        if (guest.is_sdhs_jrotc || guest.sdhs_matched_cadet_id) {
          return json({ error: "a friend guest can't be an SDHS JROTC cadet — a cadet who wants to attend registers on their own" }, 400);
        }
        if (!friendPaymentMethod) {
          return json({ error: "select how your friend's payment will reach the school" }, 400);
        }
        // Identity backstop: the friend's own email must not belong to a
        // program member (roster cadet or DISPATCH admin).
        const pe = personalEmail.toLowerCase();
        const [{ data: rosterHit }, { data: adminHit }] = await Promise.all([
          svc.from("cadet_consent").select("id").eq("school_email", pe).maybeSingle(),
          svc.from("admin_roles").select("email").eq("email", pe).maybeSingle(),
        ]);
        if (rosterHit || adminHit) {
          return json({ error: "that email belongs to a program member — they must register on their own, not as a friend" }, 400);
        }
      }
    }

    // Pricing snapshot (item 2/3): date → couple rate covers both; friend or
    // solo → host pays only their own rate and a friend owes theirs
    // separately. Null prices (config not filled yet) snapshot as null.
    const priceCadet = cfg?.price_cadet != null ? Number(cfg.price_cadet) : null;
    const priceCouple = cfg?.price_couple != null ? Number(cfg.price_couple) : null;
    const hostAmountDue = (!hasGuest || guestType === "friend") ? priceCadet : priceCouple;
    const friendAmountDue = guestType === "friend" ? priceCadet : null;
    // Permission form: host always needs one when solo; with a guest, only
    // when the date is an in-program SDHS student.
    const fieldTripFormRequired = !hasGuest || (guestType === "date" && isSdhsJrotc);

    // Item 4: burn the signup token so it can't be replayed for the rest of
    // its ~18-minute TTL. The primary-key collision on `jti` is what actually
    // blocks a double-submit — it holds even across concurrent requests and
    // multiple edge-function instances, unlike an in-memory guard. Reserved
    // here (after every 4xx-returning validation above, so a rejected attempt
    // doesn't spend the token) and rolled back below if the write fails.
    const { error: jtiErr } = await svc
      .from("ball_signup_tokens_used")
      .insert({ jti: payload.jti, email: payload.email });
    if (jtiErr) {
      return json({ error: "This signup link was already used. Start again from step 1." }, 409);
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
        cadet_has_allergy: cadetHasAllergy,
        cadet_allergy_email: cadetHasAllergy ? cadetAllergyEmail : null,
        notification_email: notificationEmail,
        amount_due: hostAmountDue,
        field_trip_form_required: fieldTripFormRequired,
        // No guest → nothing else pending, so this is fully verified at
        // creation. With a guest, verification happens on their own timeline
        // (ball-guest-verify flips this once they finish their part).
        status: hasGuest ? "guest_pending" : "fully_verified",
      })
      .select("id")
      .single();
    if (signupErr || !signup) {
      console.error("ball-submit-signup insert signup", signupErr);
      // Free the token again so a genuine retry (e.g. transient DB error) isn't
      // permanently locked out.
      await svc.from("ball_signup_tokens_used").delete().eq("jti", payload.jti);
      // Item 4: the unique(lower(cadet_school_email)) index rejects a second
      // signup for the same cadet (double-submit via two separately-verified
      // tokens). Surface that as a clear 409, not a generic 500.
      if (signupErr?.code === "23505") {
        return json({ error: "You already have a Ball signup on file. See 1SG Kaz or Chief to change it." }, 409);
      }
      return json({ error: "internal error" }, 500);
    }

    // Item 2: alert S-5 on a new allergy flag (fire-and-forget, same pattern
    // as the guest-invite email below — a failure here must not fail the
    // signup, which is already committed).
    if (cadetHasAllergy) {
      svc.functions.invoke("notify-ball-allergy", { body: { signup_id: signup.id } })
        .catch((e) => console.error("ball-submit-signup notify-ball-allergy", e));
    }

    // Confirmation / receipt email to the cadet (fire-and-forget). Address is
    // notification_email, which equals the required allergy email whenever a
    // food allergy was flagged. No address → the cadet opted out of emails.
    if (notificationEmail) {
      sendCadetConfirmation(notificationEmail, {
        name: cadet.name,
        letLevel: cadet.let_level,
        company: cadet.company,
        isFemale: cadetGender === "female",
        hasGuest,
        hasAllergy: cadetHasAllergy,
        cfg: cfg ?? null,
        amountDue: hostAmountDue,
        fieldTripFormRequired,
        guestType,
        friendName: guestType === "friend" ? guestName : null,
        friendAmountDue,
        friendPaymentMethod,
      }).catch((e) => console.error("ball-submit-signup cadet confirmation email", e));
    }

    const resultPayload = {
      ok: true,
      signup_id: signup.id,
      amount_due: hostAmountDue,
      field_trip_form_required: fieldTripFormRequired,
      guest_type: guestType,
      friend_amount_due: friendAmountDue,
      friend_payment_method: friendPaymentMethod,
      guest_name: hasGuest ? guestName : null,
    };

    if (!hasGuest) {
      return json(resultPayload);
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
      guest_type: guestType,
      friend_payment_method: friendPaymentMethod,
      friend_amount_due: friendAmountDue,
    });
    if (guestErr) {
      console.error("ball-submit-signup insert guest", guestErr);
      await svc.from("ball_signups").delete().eq("id", signup.id); // roll back the orphaned signup row
      await svc.from("ball_signup_tokens_used").delete().eq("jti", payload.jti); // free the token for a clean retry
      return json({ error: "internal error" }, 500);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
    const origin = siteOrigin();
    if (RESEND_API_KEY && origin) {
      const link = `${origin}/ball/guest/${verificationToken}`;
      const guestHtml = ballEmailShell({
        preheader: `${cadet.name} has invited you to the Trojan Battalion Military Ball.`,
        heading: "You Are Invited",
        introHtml: `<p style="margin:0 0 12px;">${escapeHtml(guestName)},</p>
<p style="margin:0;"><strong style="color:#F4ECD8;">${escapeHtml(cadet.name)}</strong> has requested the honor of your company at the Trojan Battalion Military Ball.</p>`,
        particulars: eventParticulars(cfg ?? null),
        cta: { label: "Confirm Your Attendance", url: escapeHtml(link) },
        closingHtml: `<p style="margin:0 0 10px;">This step confirms any food allergies and your review of the attire requirements. Your host's registration is not complete until it is done.</p>
<p style="margin:0;font-size:12px;color:#8A8266;">If the button does not work, use this link:<br />${escapeHtml(link)}</p>`,
        siteUrl: `${origin}/ball`,
      });
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [personalEmail],
          subject: "Trojan Battalion Military Ball: Invitation",
          html: guestHtml,
          text: `${guestName},

${cadet.name} has requested the honor of your company at the Trojan Battalion Military Ball.
${cfg?.ball_date ? `\nDate:  ${fmtLongDate(cfg.ball_date)}` : ""}${cfg?.event_time_text ? `\nTime:  ${cfg.event_time_text}` : ""}${cfg?.venue_address ? `\nVenue: ${cfg.venue_address}` : ""}

Confirm your attendance here:
${link}

This step confirms any food allergies and your review of the attire requirements. The registration is not complete until it is done.`,
        }),
      }).catch((e) => console.error("ball-submit-signup guest email send", e));
    } else {
      console.error("ball-submit-signup: RESEND_API_KEY or WEBAUTHN_ORIGIN not configured, guest email not sent");
    }

    return json(resultPayload);
  } catch (e) {
    console.error("ball-submit-signup", e);
    return json({ error: "internal error" }, 500);
  }
});
