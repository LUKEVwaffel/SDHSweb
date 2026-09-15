// Edge function: ball-submit-vip-signup
// PUBLIC, pre-auth. No signupToken, no roster lookup — this is the entry
// point for attendees who can never pass ball-lookup-cadet: a visiting
// XO/BC/CSM from another Hamilton County JROTC unit, or a past Ball
// King/Queen. See ball_vip_signup.sql for why this is its own table instead
// of a bent row in ball_signups/ball_guests. Comped — no amount_due, no
// field trip form, no payment step.
//
// Only a King/Queen may bring a date (body.date) — enforced here, not just
// in the client, since the client check is trivially bypassable.
//
// Deploy WITHOUT jwt verification:
//   supabase functions deploy ball-submit-vip-signup --no-verify-jwt
import { json, preflight } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SCHOOL_EMAIL_DOMAINS = ["students.hcde.org", "hcde.org"];
function isSchoolEmail(e: string): boolean {
  const at = e.toLowerCase().lastIndexOf("@");
  if (at < 0) return false;
  const domain = e.slice(at + 1).toLowerCase();
  return SCHOOL_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}
function required(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const ROLES = new Set(["visiting_leadership", "past_king_queen"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const svc = serviceClient();

    const { data: cfg } = await svc
      .from("ball_config")
      .select("signup_deadline")
      .maybeSingle();

    // Same deadline gate as the cadet flow (ball-submit-signup) — no VIP
    // signups after the cutoff either.
    if (cfg?.signup_deadline) {
      const todayCentral = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
      if (todayCentral > cfg.signup_deadline) {
        return json({ error: "Signups are closed — the deadline has passed." }, 403);
      }
    }

    const name = required(body?.name);
    const role = required(body?.role);
    const homeSchool = required(body?.home_school);
    const age = Number(body?.age);
    const gender = required(body?.gender);
    const hasAllergy = body?.has_allergy === true;
    const allergyDetail = hasAllergy ? (required(body?.allergy_detail) || null) : null;
    const personalEmail = required(body?.personal_email).toLowerCase();
    const phone = required(body?.phone) || null;
    const dressCodeAccepted = body?.dress_code_accepted === true;

    if (!name || !ROLES.has(role) || !homeSchool) {
      return json({ error: "name, role, and home school/unit are required" }, 400);
    }
    if (!Number.isFinite(age) || age <= 0 || (gender !== "male" && gender !== "female")) {
      return json({ error: "age and gender are required" }, 400);
    }
    if (!personalEmail || !EMAIL_RE.test(personalEmail)) {
      return json({ error: "a valid email address is required" }, 400);
    }
    if (isSchoolEmail(personalEmail)) {
      return json({ error: "use a personal email, not a school one" }, 400);
    }
    // Only female attendees have a dress code to acknowledge — a male VIP
    // wears his own unit's Class A, nothing submitted here.
    if (gender === "female" && !dressCodeAccepted) {
      return json({ error: "you must acknowledge the dress code" }, 400);
    }

    // Only a King/Queen may bring a date. body.date is silently ignored for
    // any other role rather than erroring — the client never sends one for
    // visiting_leadership, so a populated date there means a tampered
    // request, and dropping it is simpler than surfacing that as a "bug".
    const bringingDate = role === "past_king_queen" && body?.date != null;
    const dateBody = bringingDate ? body.date : null;
    const dateName = dateBody ? required(dateBody.name) : "";
    const dateAge = dateBody ? Number(dateBody.age) : null;
    const dateGender = dateBody ? required(dateBody.gender) : "";
    const dateEmail = dateBody ? (required(dateBody.personal_email).toLowerCase() || null) : null;
    const datePhone = dateBody ? (required(dateBody.phone) || null) : null;

    if (bringingDate) {
      if (!dateName || !Number.isFinite(dateAge) || (dateAge as number) <= 0 || (dateGender !== "male" && dateGender !== "female")) {
        return json({ error: "your date's name, age, and gender are required" }, 400);
      }
      if (dateEmail && !EMAIL_RE.test(dateEmail)) {
        return json({ error: "that date's email address looks invalid" }, 400);
      }
    }

    const { data: signup, error: insertErr } = await svc.from("ball_vip_signups").insert({
      name,
      role,
      home_school: homeSchool,
      age,
      gender,
      has_allergy: hasAllergy,
      allergy_detail: allergyDetail,
      personal_email: personalEmail,
      phone,
      dress_code_accepted_at: gender === "female" ? new Date().toISOString() : null,
    }).select("id").single();
    if (insertErr || !signup) {
      console.error("ball-submit-vip-signup insert", insertErr);
      return json({ error: "internal error" }, 500);
    }

    if (bringingDate) {
      const { error: dateErr } = await svc.from("ball_vip_dates").insert({
        vip_signup_id: signup.id,
        name: dateName,
        age: dateAge,
        gender: dateGender,
        personal_email: dateEmail,
        phone: datePhone,
      });
      if (dateErr) {
        console.error("ball-submit-vip-signup insert date", dateErr);
        await svc.from("ball_vip_signups").delete().eq("id", signup.id); // roll back the orphaned signup row
        return json({ error: "internal error" }, 500);
      }
    }

    return json({ ok: true });
  } catch (e) {
    console.error("ball-submit-vip-signup", e);
    return json({ error: "internal error" }, 500);
  }
});
