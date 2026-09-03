# Military Ball — deploy order (HARD GATE)

The ball SQL files are **not** CLI migrations. They are pasted by hand into the
Supabase SQL editor (project `bjgyvmdzcymruunzavni`). Several of them add
columns / RPCs that the edge functions and the React app then reference. Run
them **in this exact order**, top to bottom, and only deploy the edge functions
**after all SQL has succeeded**.

## 1. SQL, in order

| # | File | Adds |
|---|------|------|
| 1 | `ball_signup.sql` | `ball_config`, `ball_dress_staff`, `ball_signups`, `ball_guests`, `ball_gallery`, base RLS, `ball-assets` bucket |
| 2 | `ball_finalize.sql` | `ball_config` venue/pricing/Weston cols, `ball_signups` allergy flag + status ladder, `ball_dress_staff.role`, `is_ball_attire()`, `ball_allergy_list()`, `ball_attire_guest_list()` |
| 3 | `ball_guest_model.sql` | `ball_guests` `guest_type` / `friend_payment_method` / `friend_amount_due`, `ball_signups` `amount_due` / `field_trip_form_required`, widened ops views |
| 4 | `ball_hardening.sql` | audit remediation — `unique(cadet_school_email)`, gender `CHECK`s, dress-approver email dropped from the public projection, `ball_signup_tokens_used` (single-use signup tokens) |
| 5 | `ball_guards.sql` | **authoritative** `is_ball_dress()` / `is_ball_attire()` / `ball_signups_column_guard()` / `ball_guests_column_guard()` + triggers + `ball_guard_version()` |

### Independent add-ons (not part of the ordered chain above)

| File | Adds | Depends on |
|------|------|------------|
| `reviewer_admin_pin_status.sql` | `reviewer_pin_status()` — S-6-gated read of each reviewer's PIN-set / lockout / must-change-password state, for the **REVIEW PORTAL ACCOUNTS** tab in the DISPATCH Ball panel | `email_review.sql`, `reviewer_pin.sql`, `admin_roles.sql` (all already live) |
| `ball_ops_dress_views_fix.sql` | **fixes ops / dress portals showing 0 signups** — recreates the 4 `ball_*_ops_view` / `ball_*_dress_view` as SECURITY DEFINER (was `security_invoker=true`, which RLS blanked for non-s6 callers). Re-run any time; files 1–3 now carry the same non-invoker definition so a re-paste won't revert it. | files 1–3 |

Run any time; order vs. the ball chain does not matter. The tab degrades
gracefully (roster only, no PIN status) if this file has not been run yet.

`ball_guards.sql` **must be run last and must always be re-run** after any
re-paste of files 1–3. Files 1–3 still contain their historical guard
definitions, but each now checks `public.ball_guard_version()` and **skips** the
legacy definition once `ball_guards.sql` (v4+) has been applied — so a stray
re-run of an old file can no longer silently downgrade a guard. If you re-run
file 1, 2, or 3 and see a `NOTICE: skipping legacy ...`, that is expected; if
you see `WARNING: ... RE-RUN ball_guards.sql`, do exactly that.

## 2. Edge functions (only after step 1 completes)

Deploy order within this group does not matter, but **none** of them may be
deployed before the SQL above is live:

```
supabase functions deploy ball-lookup-cadet        --no-verify-jwt
supabase functions deploy ball-search-roster       --no-verify-jwt
supabase functions deploy ball-submit-signup       --no-verify-jwt
supabase functions deploy ball-guest-verify        --no-verify-jwt
supabase functions deploy ball-dress-pin-login     --no-verify-jwt
supabase functions deploy ball-dress-set-pin
supabase functions deploy notify-ball-allergy      --no-verify-jwt
supabase functions deploy notify-ball-status-update
supabase functions deploy send-allergy-email
supabase functions deploy admin-set-reviewer-pin
supabase functions deploy admin-clear-reviewer-pin
```

`admin-set-reviewer-pin` / `admin-clear-reviewer-pin` are S-6-only (checked via
`getCaller`), deploy **with** JWT verification (default). They provision the
shared review-portal login (`email_reviewers` + `reviewer_credentials`) used by
both `/review` and `/ball/ops`. They only need `email_review.sql` +
`reviewer_pin.sql` live — not the ball SQL chain.

`ball-submit-signup` writes `cadet_has_allergy`, `cadet_allergy_email`,
`amount_due`, `field_trip_form_required`, `guest_type`, `friend_*` and inserts
into `ball_signup_tokens_used`. If files 2–4 are not live, **every signup
INSERT fails**.

### Required edge-function secrets

`SIGNUP_SESSION_SECRET`, `RESEND_API_KEY`, `FROM_EMAIL`, `WEBAUTHN_ORIGIN`
(reused as the site origin), plus the auto-injected `SUPABASE_*`.

## 3. Current known gap (2026-09-03)

`supabase functions list` shows `notify-ball-allergy` and `send-allergy-email`
are **not deployed**. The allergy-notification chain (S-5 email on a new flag,
S-5 → cadet follow-up email) is therefore inert in production until they are.
Deploy them with the rest of step 2.

Live DB schema state could not be verified from the working environment
(`SUPABASE_DB_PASSWORD` not set → `supabase migration list` / `psql` both time
out). Before deploying updated functions, confirm in the SQL editor:

```sql
select public.ball_guard_version();                       -- expect 4
select count(*) from information_schema.columns
  where table_name = 'ball_signups'
    and column_name in ('amount_due','field_trip_form_required',
                        'cadet_has_allergy','cadet_allergy_email');   -- expect 4
select count(*) from information_schema.columns
  where table_name = 'ball_guests'
    and column_name in ('guest_type','friend_payment_method','friend_amount_due'); -- expect 3
select to_regclass('public.ball_signup_tokens_used');     -- not null
```
