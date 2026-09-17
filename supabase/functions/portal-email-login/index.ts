// Edge function: portal-email-login
// PRE-AUTH login for the unified /portal hub. NO PIN, NO PASSWORD — email is
// the only thing required, same shape as ball-dress-email-login /
// reviewer-email-login. Active in ANY of the non-DISPATCH staff tables
// (email_reviewers, ball_dress_staff, rifle_admins) is enough to mint a
// session; my_portals() (portal_hub.sql) then decides what that session
// actually gets to see. DISPATCH (admin_roles) is intentionally NOT checked
// here — /portal never grants DISPATCH access.
//
// Runs pre-auth, so deploy WITHOUT jwt verification:
//   supabase functions deploy portal-email-login --no-verify-jwt
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
    const [{ data: rev }, { data: dress }, { data: rifle }] = await Promise.all([
      svc.from("email_reviewers").select("email").eq("email", account).eq("active", true).maybeSingle(),
      svc.from("ball_dress_staff").select("email").eq("email", account).eq("active", true).maybeSingle(),
      svc.from("rifle_admins").select("email").eq("email", account).eq("active", true).maybeSingle(),
    ]);
    if (!rev && !dress && !rifle) return json({ error: "invalid" }, 401);

    const token_hash = await mintSessionToken(account);
    return json({ ok: true, token_hash });
  } catch (e) {
    console.error("portal-email-login", e);
    return json({ error: "internal error" }, 500);
  }
});
