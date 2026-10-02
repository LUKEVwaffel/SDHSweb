// Edge function: rifle-lookup-cadet
// PUBLIC, pre-auth. Rifle signup Step 1 — verify a cadet's school email
// against DISPATCH's roster before the rest of the signup form unlocks.
// Without this gate, rifle-submit-signup only checked email *format*, so
// anyone could type a made-up username and get a bogus signup in (e.g. the
// "Karma Cope" no-roster-match entries seen in the reviewer portal). On
// match, mints a short-lived signed "signup token" (see
// ../_shared/signupToken.ts) that rifle-submit-signup now requires.
//
// Deploy WITHOUT jwt verification:
//   supabase functions deploy rifle-lookup-cadet --no-verify-jwt
import { json, preflight } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { mintSignupToken } from "../_shared/signupToken.ts";
import { displayName } from "../_shared/name.ts";
import { normalizeSchoolUsername, SCHOOL_DOMAIN } from "../_shared/schoolEmail.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { username } = await req.json().catch(() => ({}));
    // Accepts "jsmith", " JSmith ", or the full school address.
    const uname = normalizeSchoolUsername(username);
    if (!uname) return json({ error: "invalid" }, 401);

    const email = `${uname}${SCHOOL_DOMAIN}`;
    const svc = serviceClient();

    const { data: cadet, error: lookupErr } = await svc
      .from("cadet_consent")
      .select("id, name, let_level, company")
      .eq("school_email", email)
      .maybeSingle();
    if (lookupErr) console.error("cadet lookup", lookupErr);

    if (!cadet) return json({ error: "not_found" }, 401);

    const signupToken = await mintSignupToken(email);
    return json({
      name: displayName(cadet.name),
      let_level: cadet.let_level,
      company: cadet.company,
      signupToken,
    });
  } catch (e) {
    console.error("rifle-lookup-cadet", e);
    return json({ error: "internal error" }, 500);
  }
});
