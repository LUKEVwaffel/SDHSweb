// Edge function: admin-set-reviewer-pin
// S-6 ONLY. Provisions (or resets) a review-portal account: upserts the
// email_reviewers roster row AND sets its 4-digit PIN in one call. Unlike
// set-reviewer-pin (self-service, caller sets their OWN pin, no email param),
// S-6 is standing up an account for one of the adult approvers (Chief/SAI,
// Sgt Kaz, 1SG), so email / display_name / title are caller-supplied and the
// target is upserted.
//
// This one login covers BOTH review surfaces — /review (DISPATCH email
// approvals) and /ball/ops (Military Ball payment tracking) — because both
// gate on the same email_reviewers population.
//
// The person must ALREADY exist as a Supabase Auth user (Dashboard →
// Authentication → Users) before their first PIN sign-in can mint a session —
// same manual prerequisite as ball-dress-set-pin.
//
// activate_now: pass true only when S-6 has already set this account's real
// password in the Auth dashboard, so the forced-password-change wall
// (email_reviewers.must_change_password → is_reviewer() returns false until
// cleared) should NOT engage. Default false leaves must_change_password at its
// current value — true for a brand-new row, which is the safe first-login gate.
//
// Deploy WITH jwt verification (default):
//   supabase functions deploy admin-set-reviewer-pin
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";
import { hashPin, PIN_RE } from "../_shared/pin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== "s6") return json({ error: "not authorized" }, 403);
    // Service-role client below bypasses RLS, so per the getCaller() contract
    // this must enforce the admin password gate itself — same guard as
    // ball-dress-set-pin / send-allergy-email.
    if (caller.mustChangePassword) return json({ error: "set your own password first" }, 403);

    const body = await req.json().catch(() => ({}));
    const targetEmail = String(body.email || "").trim().toLowerCase();
    const displayName = String(body.display_name || "").trim();
    const title = body.title == null ? null : String(body.title).trim() || null;
    const pin = String(body.pin ?? "");
    const activateNow = body.activate_now === true;

    if (!targetEmail || !displayName) return json({ error: "email and display name are required" }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(targetEmail)) return json({ error: "email looks malformed" }, 400);
    if (!PIN_RE.test(pin)) return json({ error: "PIN must be exactly 4 digits" }, 400);

    const svc = serviceClient();

    // 1) Roster row FIRST — reviewer_credentials.email has an FK to
    //    email_reviewers(email) ON DELETE CASCADE, so the parent must exist
    //    before the credential upsert. must_change_password is only written
    //    when activate_now is true; otherwise the column keeps its value
    //    (default true for a new row = first-login password gate stays armed).
    const reviewerRow: Record<string, unknown> = {
      email: targetEmail,
      display_name: displayName,
      title,
      active: true,
    };
    if (activateNow) reviewerRow.must_change_password = false;

    const { error: rErr } = await svc.from("email_reviewers").upsert(reviewerRow);
    if (rErr) return json({ error: rErr.message }, 500);

    // 2) PIN + reset any existing lockout counters.
    const pin_hash = await hashPin(pin);
    const { error: cErr } = await svc.from("reviewer_credentials").upsert({
      email: targetEmail,
      pin_hash,
      pin_fail_count: 0,
      pin_locked_until: null,
      updated_at: new Date().toISOString(),
    });
    if (cErr) return json({ error: cErr.message }, 500);

    // Report the effective gate state so the admin UI can warn "reviewer must
    // still set their own password before they can review".
    const { data: after } = await svc
      .from("email_reviewers").select("must_change_password").eq("email", targetEmail).maybeSingle();

    return json({ ok: true, must_change_password: !!after?.must_change_password });
  } catch (e) {
    console.error("admin-set-reviewer-pin", e);
    return json({ error: "internal error" }, 500);
  }
});
