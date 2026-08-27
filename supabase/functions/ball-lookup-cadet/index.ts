// Edge function: ball-lookup-cadet
// PUBLIC, pre-auth. Ball signup Step 1 — verify a cadet's school email
// against the roster and, on a match, mint a short-lived signed "signup
// token" (see _shared/signupToken.ts) that later steps must present. Deploy
// WITHOUT jwt verification:
//   supabase functions deploy ball-lookup-cadet --no-verify-jwt
import { json, preflight } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { mintSignupToken } from "../_shared/signupToken.ts";
import { displayName } from "../_shared/name.ts";

const SCHOOL_DOMAIN = "@students.hcde.org";
const USERNAME_RE = /^[a-z0-9._-]{1,64}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { username } = await req.json().catch(() => ({}));
    const uname = String(username || "").trim();
    if (!uname || !USERNAME_RE.test(uname)) return json({ error: "invalid" }, 401);

    const email = `${uname.toLowerCase()}${SCHOOL_DOMAIN}`;
    const svc = serviceClient();

    const { data: cadet } = await svc
      .from("cadet_consent")
      .select("name, let_level, company")
      .eq("school_email", email)
      .maybeSingle();

    if (!cadet) return json({ error: "not_found" }, 401);

    const signupToken = await mintSignupToken(email);
    return json({
      name: displayName(cadet.name),
      let_level: cadet.let_level,
      company: cadet.company,
      signupToken,
    });
  } catch (e) {
    console.error("ball-lookup-cadet", e);
    return json({ error: "internal error" }, 500);
  }
});
