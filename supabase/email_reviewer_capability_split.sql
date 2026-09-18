-- ============================================================================
-- REVIEWER CAPABILITY SPLIT — email_reviewers used to be ONE flag
-- (is_reviewer()) gating THREE unrelated surfaces at once: Email Review
-- (/review), Ball Payments (/ball/ops), and Rifle Signups
-- (/rifle/signup-review). Granting a reviewer account meant granting all
-- three together, with no way to give someone just one. Run in the Supabase
-- SQL editor (project bjgyvmdzcymruunzavni), idempotent, AFTER
-- email_review.sql + rifle_signup.sql + ball_guest_form_required_split.sql +
-- ball_guards.sql v8.
--
-- THE FIX: three independent boolean columns on the SAME email_reviewers
-- row (one login/PIN still covers all three when granted — this splits
-- WHAT each login can do, not the credential itself) and three new gate
-- functions replacing is_reviewer() everywhere it was actually the access
-- boundary. is_reviewer() itself is UNCHANGED and still means "has an active
-- reviewer login at all" — kept only for is_s6()-adjacent umbrella checks
-- that never cared which specific surface (there are none load-bearing left
-- after this file; it stays for backward compatibility, not reused here).
--
-- BACKFILL: every row that is active TODAY gets all three flags set true —
-- nobody who currently has access loses any of it. New columns default to
-- FALSE so a brand-new reviewer added after this runs starts with nothing
-- until S-6 explicitly checks a box (Portal Access → ASSIGN).
--
-- AFTER RUNNING THIS FILE:
--   1. Re-run ball_guards.sql (bumped to v9 — reviewer branch on both column
--      guards now checks is_ball_ops_reviewer() instead of is_reviewer()).
--   2. Redeploy admin-set-reviewer-pin (now accepts which capabilities to
--      grant) and notify-ball-status-update / submit-review-decision (now
--      check their own capability flag).
-- ============================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'email_reviewers' and column_name = 'active') then
    raise exception 'email_reviewer_capability_split.sql: run email_review.sql first (email_reviewers missing)';
  end if;
  if to_regclass('public.rifle_signups_review_view') is null then
    raise exception 'email_reviewer_capability_split.sql: run rifle_signup.sql first (rifle_signups_review_view missing)';
  end if;
end $$;


-- ── SECTION 1 — the three columns + safe backfill ──────────────────────────
alter table public.email_reviewers
  add column if not exists can_email_review  boolean not null default false,
  add column if not exists can_ball_ops      boolean not null default false,
  add column if not exists can_rifle_signups boolean not null default false;

-- Every currently-active reviewer keeps everything they had before this file
-- — this is a one-time backfill, not an ongoing default. Anyone added after
-- today starts with none checked (Portal Access → ASSIGN picks explicitly).
update public.email_reviewers
set can_email_review = true, can_ball_ops = true, can_rifle_signups = true
where active;


-- ── SECTION 2 — the three gate functions ───────────────────────────────────
create or replace function public.is_email_reviewer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.email_reviewers
    where lower(email) = lower(auth.jwt() ->> 'email') and active and can_email_review
  );
$$;

create or replace function public.is_ball_ops_reviewer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.email_reviewers
    where lower(email) = lower(auth.jwt() ->> 'email') and active and can_ball_ops
  );
$$;

create or replace function public.is_rifle_signups_reviewer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.email_reviewers
    where lower(email) = lower(auth.jwt() ->> 'email') and active and can_rifle_signups
  );
$$;

revoke all on function public.is_email_reviewer()      from public, anon;
revoke all on function public.is_ball_ops_reviewer()    from public, anon;
revoke all on function public.is_rifle_signups_reviewer() from public, anon;
grant execute on function public.is_email_reviewer()      to authenticated;
grant execute on function public.is_ball_ops_reviewer()    to authenticated;
grant execute on function public.is_rifle_signups_reviewer() to authenticated;


-- ── SECTION 3 — email review RLS: swap is_reviewer() for is_email_reviewer() ─
-- email_messages_read_reviewer (email_review.sql, pending_review) and
-- email_messages_read_reviewer_history (email_review_visibility.sql,
-- approved+sent — the authoritative one, already superseding
-- email_review_history.sql's own _sent policy) were the actual access
-- boundary. Re-declared here with the split gate; same names, same shape.
drop policy if exists email_messages_read_reviewer on public.email_messages;
create policy email_messages_read_reviewer on public.email_messages
  for select to authenticated
  using (public.is_email_reviewer() and status = 'pending_review');

drop policy if exists email_messages_read_reviewer_sent on public.email_messages;
drop policy if exists email_messages_read_reviewer_history on public.email_messages;
create policy email_messages_read_reviewer_history on public.email_messages
  for select to authenticated
  using (public.is_email_reviewer() and status in ('approved', 'sent'));


-- ── SECTION 4 — rifle signups view: swap is_reviewer() for is_rifle_signups_reviewer() ─
drop view if exists public.rifle_signups_review_view;
create view public.rifle_signups_review_view
with (security_barrier = true) as
  select id, school_email, personal_email, parent_email, phone, is_varsity, created_at
  from public.rifle_signups
  where public.is_rifle_signups_reviewer() or public.is_s6() or public.is_rifle_admin();
grant select on public.rifle_signups_review_view to authenticated;

-- ── SECTION 5 — ball ops views: swap is_reviewer() for is_ball_ops_reviewer() ─
-- These two views have been re-declared across five different files as
-- columns were added over time (ball_guest_model.sql, ball_ops_poc_fields.sql,
-- ball_ops_dress_views_fix.sql, ball_guest_cash_split.sql,
-- ball_guest_form_split.sql, ball_guest_form_required_split.sql) — this is
-- the full column union of all of them, so re-running this file last can't
-- silently drop anything the others added.
drop view if exists public.ball_signups_ops_view;
create view public.ball_signups_ops_view
with (security_barrier = true) as
  select id, cadet_name, cadet_let_level, cadet_company, status,
         cash_received, field_trip_form_received, field_trip_form_required,
         amount_due, created_at, cadet_school_email, notification_email
  from public.ball_signups
  where public.is_ball_ops_reviewer();
grant select on public.ball_signups_ops_view to authenticated;

drop view if exists public.ball_guests_ops_view;
create view public.ball_guests_ops_view
with (security_barrier = true) as
  select id, signup_id, name, age, guest_type, is_sdhs_jrotc, school_attended,
         friend_payment_method, friend_amount_due, friend_cash_received,
         field_trip_form_required, field_trip_form_received,
         poc_name, poc_email, poc_phone, personal_email
  from public.ball_guests
  where public.is_ball_ops_reviewer();
grant select on public.ball_guests_ops_view to authenticated;

-- The reviewer branch of ball_signups_column_guard() / ball_guests_column_guard()
-- (ball_guards.sql, bumped to v9) also swaps is_reviewer() for
-- is_ball_ops_reviewer() — that file stays the authoritative owner of the
-- guard FUNCTIONS themselves, just updated to call the new gate.


-- ── SECTION 6 — ball_signups RLS: narrow the ops row-level grant ───────────
-- Same tightening as the guard functions — the ops half of this OR now
-- checks is_ball_ops_reviewer() specifically, not "any active reviewer".
drop policy if exists ball_signups_update_ops_dress on public.ball_signups;
create policy ball_signups_update_ops_dress on public.ball_signups
  for update to authenticated
  using (public.is_ball_ops_reviewer() or public.is_ball_dress())
  with check (public.is_ball_ops_reviewer() or public.is_ball_dress());


-- ── SECTION 7 — ball_guests RLS: the ops row-level grant NEVER EXISTED ─────
-- ball_signup.sql's original comment says "ops has no guest-table write per
-- the plan" — true when that file was written, before friend_cash_received /
-- field_trip_form_received existed on ball_guests. ball_guest_cash_split.sql
-- and ball_guest_form_split.sql later widened the COLUMN-guard TRIGGER to
-- let a reviewer touch those two columns, but no file ever added the
-- matching RLS policy granting a reviewer ROW-level UPDATE on ball_guests at
-- all — only is_s6() (ball_guests_all_s6, ALL) and dress/attire
-- (ball_guests_update_dress / ball_guests_update_attire) could ever reach an
-- UPDATE on this table. A plain reviewer's guest-cash / guest-form toggle in
-- BallOpsPortal.jsx has been silently blocked by RLS this whole time — it
-- only ever looked like it worked when tested from an S-6 session (is_s6()
-- bypasses this table's RLS entirely) or the SQL editor's superuser
-- connection (RLS doesn't apply there either). This is the actual fix.
drop policy if exists ball_guests_update_ops on public.ball_guests;
create policy ball_guests_update_ops on public.ball_guests
  for update to authenticated
  using (public.is_ball_ops_reviewer())
  with check (public.is_ball_ops_reviewer());

-- ============================================================================
-- VERIFY AFTER RUNNING (then after ball_guards.sql v9):
--   select email, can_email_review, can_ball_ops, can_rifle_signups
--     from public.email_reviewers;                        -- existing active rows: all 3 true
--   -- as an active reviewer with can_ball_ops=false, can_email_review=true:
--   --   select public.is_email_reviewer();                -- true
--   --   select public.is_ball_ops_reviewer();              -- false
--   select * from public.rifle_signups_review_view;         -- only if can_rifle_signups
--   -- as an ops (can_ball_ops=true) session (this was broken before this file):
--   --   update ball_guests set friend_cash_received = true where id = '<guest row>'; -- OK, row updates
--   -- as an active reviewer with can_ball_ops=false:
--   --   update ball_guests set friend_cash_received = true where id = '<guest row>'; -- 0 rows affected (RLS)
-- ============================================================================
