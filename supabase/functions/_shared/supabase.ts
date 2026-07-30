import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Service-role client — bypasses RLS. Use ONLY inside edge functions, never the
// browser. Reads the auto-injected secrets.
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export interface Caller {
  email: string;              // lowercased
  role: string | null;        // 's6' | 's5' | null
  canOverride: boolean;
  mustChangePassword: boolean;
}

// Identify the signed-in caller from the request's Authorization bearer token.
// Returns null when there is no valid session. Used by the write functions
// (set-pin / clear-pin / revoke-passkeys) — NOT by the pre-auth login functions.
//
// mustChangePassword is returned but NOT enforced here — same reasoning as
// getReviewer() below: some self-only actions (clear-pin, revoke-passkeys)
// stay allowed while gated by product decision, so each call site decides.
// Any s6-gated action that bypasses RLS via the service-role client (e.g.
// answer-faq-question, submit-for-review, which check caller.role === "s6"
// directly) MUST also check !caller.mustChangePassword itself — RLS's
// admin_role() gate (admin_password_gate.sql) does not protect service-role
// calls.
export async function getCaller(req: Request): Promise<Caller | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const scoped = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: { user } } = await scoped.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!email) return null;

  // Role lookup uses the service client with an exact (lowercased) match.
  // NB: do NOT use ilike here — reviewer/admin emails contain underscores,
  // which ilike treats as a single-char wildcard.
  const svc = serviceClient();
  const { data, error } = await svc
    .from("admin_roles")
    .select("role, can_override_review, must_change_password")
    .eq("email", email)
    .maybeSingle();

  // Fail CLOSED on a lookup error rather than defaulting mustChangePassword
  // to false — set-pin/passkey-register have no RLS backstop of their own
  // (account_credentials/webauthn_credentials are service-role only), so a
  // silently-false gate here would let a gated caller register new
  // credentials during a transient DB error. Every current caller of
  // getCaller() already treats a null return as "not authorized," so this is
  // a safe default across the board, not just for the gate check.
  if (error) { console.error("getCaller admin_roles lookup", error); return null; }

  return {
    email,
    role: data?.role ?? null,
    canOverride: !!data?.can_override_review,
    mustChangePassword: !!data?.must_change_password,
  };
}

export interface Reviewer {
  email: string;
  mustChangePassword: boolean;
}

// Identify the signed-in caller as a REVIEWER (email_reviewers, not
// admin_roles — separate population, per email_review.sql). Used by
// submit-review-decision, set-reviewer-pin, clear-reviewer-pin, and
// complete-first-login. Returns null when there is no valid session or the
// caller isn't an active reviewer.
//
// mustChangePassword is returned but NOT enforced here — complete-first-login
// legitimately must be callable regardless of its current value (it's the
// only path that ever clears it), and set-/clear-reviewer-pin are low-stakes
// enough to allow before the forced change completes. submit-review-decision
// is the one caller that checks this field itself before allowing a real
// approve/deny decision — see that function for why.
export async function getReviewer(req: Request): Promise<Reviewer | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const scoped = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: { user } } = await scoped.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!email) return null;

  const svc = serviceClient();
  const { data } = await svc
    .from("email_reviewers")
    .select("email, must_change_password")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();

  return data ? { email, mustChangePassword: !!data.must_change_password } : null;
}
