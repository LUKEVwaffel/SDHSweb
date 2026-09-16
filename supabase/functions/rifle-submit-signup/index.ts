// Edge function: rifle-submit-signup
// PUBLIC, pre-auth. Rifle team interest signup for new/JV cadets — see
// rifle_signup.sql. Only identifying field is school_email (the cadet's full
// profile already lives in DISPATCH's roster, keyed off that); everything
// else here is contact info the roster doesn't carry.
//
// Deploy WITHOUT jwt verification:
//   supabase functions deploy rifle-submit-signup --no-verify-jwt
import { json, preflight } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mirrored client-side in src/lib/schoolEmail.js.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const svc = serviceClient();

    const schoolEmail = required(body?.school_email).toLowerCase();
    const personalEmail = required(body?.personal_email).toLowerCase();
    const parentEmail = required(body?.parent_email).toLowerCase();
    const phone = required(body?.phone);

    if (!schoolEmail || !EMAIL_RE.test(schoolEmail) || !isSchoolEmail(schoolEmail)) {
      return json({ error: "a valid @students.hcde.org email is required" }, 400);
    }
    if (!personalEmail || !EMAIL_RE.test(personalEmail)) {
      return json({ error: "a valid personal email address is required" }, 400);
    }
    if (isSchoolEmail(personalEmail)) {
      return json({ error: "personal email must not be a school email" }, 400);
    }
    if (!parentEmail || !EMAIL_RE.test(parentEmail)) {
      return json({ error: "a valid parent/guardian email address is required" }, 400);
    }
    if (!phone || phone.replace(/\D/g, "").length < 7) {
      return json({ error: "a valid phone number is required" }, 400);
    }

    const { error: insertErr } = await svc.from("rifle_signups").insert({
      school_email: schoolEmail,
      personal_email: personalEmail,
      parent_email: parentEmail,
      phone,
    });
    if (insertErr) {
      if (insertErr.code === "23505") {
        return json({ error: "that school email has already signed up for rifle" }, 409);
      }
      console.error("rifle-submit-signup insert", insertErr);
      return json({ error: "internal error" }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("rifle-submit-signup", e);
    return json({ error: "internal error" }, 500);
  }
});
