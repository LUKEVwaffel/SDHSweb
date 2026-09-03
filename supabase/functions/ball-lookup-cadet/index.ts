// Edge function: ball-lookup-cadet
// PUBLIC, pre-auth. Ball signup Step 1 — verify a cadet's school email
// against the roster and, on a match, mint a short-lived signed "signup
// token" (see _shared/signupToken.ts) that later steps must present.
//
// Also returns `date_tag` when this cadet is already tagged as an in-program
// DATE under someone else's reservation (item 5): the cadet sees their own
// guest status right here at Step 1 instead of it only surfacing to S-6. It
// does NOT block them from starting their own separate signup.
//
// Deploy WITHOUT jwt verification:
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
      .select("id, name, let_level, company")
      .eq("school_email", email)
      .maybeSingle();

    if (!cadet) return json({ error: "not_found" }, 401);

    // Are they already someone's in-program date? Match on roster identity
    // (cadet_consent.id), not a name string. Most recent tag wins.
    let dateTag: { host_name: string; status: string } | null = null;
    const { data: tag } = await svc
      .from("ball_guests")
      .select("verified_at, created_at, ball_signups(cadet_name)")
      .eq("sdhs_matched_cadet_id", cadet.id)
      .eq("guest_type", "date")
      .eq("is_sdhs_jrotc", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tag) {
      const host = (tag as { ball_signups?: { cadet_name?: string } }).ball_signups?.cadet_name;
      dateTag = {
        host_name: host ? displayName(host) : "another cadet",
        status: tag.verified_at ? "verified" : "awaiting your verification",
      };
    }

    const signupToken = await mintSignupToken(email);
    return json({
      name: displayName(cadet.name),
      let_level: cadet.let_level,
      company: cadet.company,
      signupToken,
      date_tag: dateTag,
    });
  } catch (e) {
    console.error("ball-lookup-cadet", e);
    return json({ error: "internal error" }, 500);
  }
});
