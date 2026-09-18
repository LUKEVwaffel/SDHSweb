// Edge function: admin-set-portal-active
// S-6 ONLY. Revokes (or restores) one person's access on one small staff
// portal population — email_reviewers, ball_dress_staff, or rifle_admins —
// or, for email_reviewers specifically, ONE of its three independent
// capabilities (can_email_review / can_ball_ops / can_rifle_signups —
// email_reviewer_capability_split.sql) instead of the whole account.
// Generic on purpose: two of the three tables (ball_dress_staff,
// rifle_admins) have NO client-writable RLS policy at all — "service_role
// only", so this had no path before except the SQL editor. email_reviewers
// technically already allows a direct is_s6() client update (see
// BallReviewerAccountsTab.jsx's own toggleActive), but routes through here
// too now so the AUTH tab has one consistent call for all of it.
//
// `field` defaults to "active" (the whole-account toggle every table has).
// Each table has its own strict allow-list — this is NOT an arbitrary
// column-name passthrough.
//
// admin_roles (DISPATCH access) is deliberately NOT one of the allowed
// tables — that population stays managed from the People panel, same
// separation every other file in this system keeps.
//
// Deploy WITH jwt verification (default):
//   supabase functions deploy admin-set-portal-active
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";

const ALLOWED_FIELDS: Record<string, Set<string>> = {
  email_reviewers: new Set(["active", "can_email_review", "can_ball_ops", "can_rifle_signups"]),
  ball_dress_staff: new Set(["active"]),
  rifle_admins: new Set(["active"]),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== "s6") return json({ error: "not authorized" }, 403);
    if (caller.mustChangePassword) return json({ error: "set your own password first" }, 403);

    const { table, email, active, field } = await req.json().catch(() => ({}));
    const targetEmail = String(email || "").trim().toLowerCase();
    const targetField = String(field || "active");
    const allowedFields = ALLOWED_FIELDS[table];
    if (!targetEmail || !allowedFields || !allowedFields.has(targetField) || typeof active !== "boolean") {
      return json({ error: "table, email, a valid field, and a boolean active are required" }, 400);
    }

    const svc = serviceClient();
    const { error } = await svc.from(table).update({ [targetField]: active }).eq("email", targetEmail);
    if (error) {
      console.error("admin-set-portal-active", table, targetField, error);
      return json({ error: error.message }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("admin-set-portal-active", e);
    return json({ error: "internal error" }, 500);
  }
});
