// Edge function: reviewer-email-login
// PRE-AUTH login for the Email Review / Ball Ops reviewers (Chief/SAI, Sgt
// Kaz). NO PIN, NO PASSWORD — email is the only thing required. If the
// address is an active row in email_reviewers we mint a real GoTrue session
// for it; is_reviewer() (RLS) still enforces everything else afterward.
// Mirrors ball-dress-email-login exactly, just against email_reviewers
// instead of ball_dress_staff.
//
// This replaces password/PIN login (ReviewLogin.jsx, reviewer-pin-login —
// both kept on disk for rollback only). Runs pre-auth, so deploy WITHOUT jwt
// verification:
//   supabase functions deploy reviewer-email-login --no-verify-jwt
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
    const { data: rev } = await svc
      .from("email_reviewers")
      .select("email")
      .eq("email", account)
      .eq("active", true)
      .maybeSingle();
    if (!rev) return json({ error: "invalid" }, 401);

    const token_hash = await mintSessionToken(account);
    return json({ ok: true, token_hash });
  } catch (e) {
    console.error("reviewer-email-login", e);
    return json({ error: "internal error" }, 500);
  }
});
