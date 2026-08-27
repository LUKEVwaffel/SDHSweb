// Edge function: ball-search-roster
// PUBLIC, pre-auth. Ball signup Step 3 — "is your guest an SDHS cadet"
// typeahead. Requires a valid signupToken (minted by ball-lookup-cadet) on
// every call, closing the gap where this search was reachable by anyone with
// the URL with no identity check at all. Two actions:
//   • list:    { signupToken, q }                -> [{ name, let_level, company, cadet_id }], no age
//   • resolve: { signupToken, cadet_id }          -> { name, let_level, company, age }
// age is only ever returned for one specifically-selected cadet_id (the
// resolve call), never in the list response — so browsing name matches can't
// bulk-harvest ages. age is computed server-side from birthdate; the raw
// birthdate itself is never returned (matches cadet_consent_birthdates.sql's
// own "sensitive minor PII" note).
//
// Deploy WITHOUT jwt verification:
//   supabase functions deploy ball-search-roster --no-verify-jwt
import { json, preflight } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { verifySignupToken } from "../_shared/signupToken.ts";
import { displayName } from "../_shared/name.ts";

const LIST_LIMIT = 8;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20; // per token, per window — generous for a real typeahead, tight against scripted enumeration

// In-memory per-token rate limit. Edge function instances are ephemeral and
// can scale to multiple concurrent instances, so this is a best-effort
// throttle, not a hard guarantee — the signupToken requirement above is the
// control that actually closes the enumeration hole; this just slows a
// single hot instance down further.
const hits = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > RATE_LIMIT_MAX;
}

function computeAge(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const dob = new Date(birthdate);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const payload = await verifySignupToken(body?.signupToken);
    if (!payload) return json({ error: "invalid or expired signup session" }, 401);

    if (rateLimited(payload.email)) return json({ error: "too many requests" }, 429);

    const svc = serviceClient();

    if (body?.cadet_id) {
      // resolve — one specific cadet, age included.
      const { data: cadet } = await svc
        .from("cadet_consent")
        .select("name, let_level, company, birthdate")
        .eq("id", String(body.cadet_id))
        .maybeSingle();
      if (!cadet) return json({ error: "not_found" }, 404);
      return json({
        name: displayName(cadet.name),
        let_level: cadet.let_level,
        company: cadet.company,
        age: computeAge(cadet.birthdate),
      });
    }

    // list — name search, no age.
    const q = String(body?.q || "").trim();
    if (q.length < 2) return json({ results: [] });

    const { data: rows, error } = await svc
      .from("cadet_consent")
      .select("id, name, let_level, company")
      .ilike("name", `%${q.replace(/[%_]/g, "\\$&")}%`)
      .order("name", { ascending: true })
      .limit(LIST_LIMIT);
    if (error) { console.error("ball-search-roster query", error); return json({ error: "internal error" }, 500); }

    return json({
      results: (rows || []).map((r) => ({
        cadet_id: r.id, name: displayName(r.name), let_level: r.let_level, company: r.company,
      })),
    });
  } catch (e) {
    console.error("ball-search-roster", e);
    return json({ error: "internal error" }, 500);
  }
});
