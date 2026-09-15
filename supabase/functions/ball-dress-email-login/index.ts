// Edge function: ball-dress-email-login
// PRE-AUTH login for the dress + male-guest-attire approvers. NO PIN, NO
// PASSWORD — email is the only thing required. If the address is an active
// row in ball_dress_staff we mint a real GoTrue session for it; role scoping
// (female_dress vs male_guest_attire) is still enforced afterward by
// is_ball_dress() / is_ball_attire() on every read + the column guards.
//
// This replaces ball-dress-pin-login (kept on disk for rollback only). Runs
// on the public anon key BEFORE the user has a session, so deploy WITHOUT jwt
// verification:
//   supabase functions deploy ball-dress-email-login --no-verify-jwt
import { json, preflight } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { mintSessionToken } from "../_shared/session.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { email } = await req.json().catch(() => ({}));
    const account = String(email || "").trim().toLowerCase();
    if (!account || !account.includes("@")) return json({ error: "invalid" }, 401);

    const svc = serviceClient();
    const { data: staff } = await svc
      .from("ball_dress_staff")
      .select("email")
      .eq("email", account)
      .eq("active", true)
      .maybeSingle();
    if (!staff) return json({ error: "invalid" }, 401);

    const token_hash = await mintSessionToken(account);
    return json({ ok: true, token_hash });
  } catch (e) {
    console.error("ball-dress-email-login", e);
    return json({ error: "internal error" }, 500);
  }
});
