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
}

// Identify the signed-in caller from the request's Authorization bearer token.
// Returns null when there is no valid session. Used by the write functions
// (set-pin / clear-pin / revoke-passkeys) — NOT by the pre-auth login functions.
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
  const { data } = await svc
    .from("admin_roles")
    .select("role, can_override_review")
    .eq("email", email)
    .maybeSingle();

  return { email, role: data?.role ?? null, canOverride: !!data?.can_override_review };
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
