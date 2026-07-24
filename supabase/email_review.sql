-- ============================================================================
-- EMAIL REVIEW PORTAL — schema / RLS. Run in the Supabase SQL editor. Idempotent.
-- Depends on: admin_roles.sql (admin_roles, is_s6(), _drop_all_policies) and the
-- existing email_messages table (email_system.sql + email_builder.sql).
--
-- WHAT THIS ADDS:
--   • email_reviewers        — the 3 adult approvers (Chief/SAI, Sgt Kaz, 1SG).
--                              Separate population from admin_roles; they only
--                              ever review, never manage DISPATCH.
--   • is_reviewer()          — SECURITY DEFINER, true for an active reviewer.
--   • admin_roles.can_override_review + can_override_review() — an INDIVIDUAL
--                              capability flag (Kaiden only), NOT a role. Luke is
--                              s6 but keeps the flag false → no override power.
--   • email_messages review columns + an extended status ladder.
--   • RLS so a reviewer sees ONLY pending drafts and nothing else in DISPATCH.
--
-- STATUS LADDER (email_messages.status is free text; values used by the app):
--   draft
--    ├─ submit for review ─────→ pending_review
--    │      ├─ APPROVE ─────────→ approved ─────────┐
--    │      └─ DENY + feedback ─→ changes_requested ─→ (edit) → draft
--    └─ KAIDEN override ───────→ pending_signature ─(print → wet signature by
--                                student trio → mark signed)→ signed ──┐
--                                                                       ▼
--                    send-email edge fn gate: status IN ('approved','signed')
--
--   NOTE (Phase 2 code change, NOT this file): supabase/functions/send-email
--   currently rejects `status !== 'signed'`. It MUST change to reject
--   `status NOT IN ('approved','signed')` so digital approval clears the send.
--
-- SECURITY MODEL:
--   • Reviewers authenticate with a real Supabase Auth account (email +
--     password — same account pattern as admin_roles, created in Auth →
--     Users). A reviewer session is the `authenticated` role but is NOT
--     s6/s5 — the existing email_messages_all_s6 policy already denies it
--     everything; we grant back ONLY select on pending_review rows.
--     email_reviewers stays the authorization gate (active reviewer yes/no);
--     is_reviewer()/getReviewer() only check auth.jwt()->>'email' against it,
--     so they work identically regardless of how the session was minted.
--   • Reviewers never UPDATE email_messages directly. The approve/deny decision
--     runs through the Phase 2 `submit-review-decision` edge function
--     (service_role), which sets reviewed_by from the caller's JWT — never from
--     client input — validates a required denial reason, and sends the Resend
--     notification atomically.
--   • can_override_review is enforced server-side (edge fn calls the helper);
--     the client reads its own flag only to show/hide the override button.
-- ============================================================================


-- ── SECTION 1 — reviewers table + is_reviewer() ─────────────────────────────
create table if not exists public.email_reviewers (
  email        text primary key,
  display_name text not null,
  title        text,                         -- 'SAI' | 'Sgt Kaz' | '1SG'
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
alter table public.email_reviewers enable row level security;

-- A reviewer may read ONLY their own row (portal shows their name/title). S-6
-- manages the reviewer list. No anon access.
drop policy if exists email_reviewers_read_self on public.email_reviewers;
drop policy if exists email_reviewers_admin_all on public.email_reviewers;
create policy email_reviewers_read_self on public.email_reviewers
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));
create policy email_reviewers_admin_all on public.email_reviewers
  for all to authenticated
  using (public.is_s6()) with check (public.is_s6());
revoke all on public.email_reviewers from anon;

-- Parameterless, reads only the caller's own JWT email — safe to leave
-- world-executable (same shape as is_s6()). Cannot be pointed at another user.
create or replace function public.is_reviewer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.email_reviewers
    where lower(email) = lower(auth.jwt() ->> 'email') and active
  );
$$;


-- ── SECTION 2 — Kaiden-only override capability (flag, not a role) ──────────
alter table public.admin_roles
  add column if not exists can_override_review boolean not null default false;

create or replace function public.can_override_review()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select can_override_review from public.admin_roles
     where lower(email) = lower(auth.jwt() ->> 'email') limit 1),
    false);
$$;

-- The s6 column-grant from account_picker.sql restricts authenticated UPDATE on
-- admin_roles to (display_name, photo_url) — so can_override_review can NOT be
-- toggled from the app. Set it ONLY here / in the dashboard, on Kaiden's row.


-- ── SECTION 3 — email_messages review columns + status ladder ───────────────
alter table public.email_messages
  add column if not exists submitted_at      timestamptz,
  add column if not exists reviewed_by       text,          -- reviewer email (server-set)
  add column if not exists reviewed_at       timestamptz,
  add column if not exists reviewer_feedback text,          -- required on deny
  add column if not exists sign_off_kind     text,          -- 'digital_review' | 'paper_override'
  add column if not exists override_by       text,          -- Kaiden's email when overridden
  add column if not exists override_at       timestamptz;

create index if not exists email_messages_status_idx on public.email_messages(status);

-- Constrain status to the known ladder. All EXISTING values (draft,
-- pending_signature, signed, sent) are included, so this is non-breaking. Its
-- job is defense in depth: a future edge-function typo can't silently set a
-- status that slips past the reviewer keyhole (= 'pending_review') or the
-- send-email gate (IN 'approved','signed'). If the ALTER errors, a legacy row
-- holds an off-ladder value — find it first: select distinct status from
-- public.email_messages;
alter table public.email_messages drop constraint if exists email_messages_status_check;
alter table public.email_messages add constraint email_messages_status_check
  check (status in ('draft','pending_review','changes_requested','pending_signature','signed','approved','sent'));


-- ── SECTION 4 — RLS: give reviewers a keyhole, nothing more ─────────────────
-- email_messages is already LOCKED to s6 (email_messages_all_s6, FOR ALL, from
-- admin_roles.sql SECTION 3d). Policies are OR-combined, so we ADD a narrow
-- reviewer SELECT that only ever exposes rows currently awaiting review. Once a
-- decision moves the row out of pending_review, the reviewer loses visibility.
drop policy if exists email_messages_read_reviewer on public.email_messages;
create policy email_messages_read_reviewer on public.email_messages
  for select to authenticated
  using (public.is_reviewer() and status = 'pending_review');
-- No reviewer INSERT/UPDATE/DELETE policy on purpose — the decision write is
-- done by the service_role edge function, which also sends the notification.


-- ── SECTION 5 — seeds ────────────────────────────────────────────────────────
-- The 3 adult reviewers.
insert into public.email_reviewers (email, display_name, title) values
  ('thrasher_michael@hcde.org', 'Chief (SAI)',             'SAI'),
  ('kazminski_jay@hcde.org',    'Sgt Kaz (Jay Kazminski)', 'Sgt Kaz'),
  ('hodges_tim@hcde.org',       '1SGT',                    '1SG')
on conflict (email) do update
  set display_name = excluded.display_name, title = excluded.title, active = true;

-- The override capability — set true ONLY on Kaiden's account (NOT Luke's, even
-- though Luke is also s6).
-- ⚠ This UPDATE affects a row ONLY IF one already exists with this exact email.
-- Kaiden must have an admin_roles row (see the rows_affected check below), and
-- this email must match the email he logs into Supabase Auth with — the
-- can_override_review() helper compares it to auth.jwt()->>'email'. If they
-- differ, the override button will never appear for him.
update public.admin_roles set can_override_review = true
  where email = 'kg36247@students.hcde.org';
-- Confirm it landed on exactly one row:
--   select email, role, can_override_review from public.admin_roles
--     where can_override_review;   -- expect ONLY kg36247@students.hcde.org


-- ── SECTION 6 — verify after running ────────────────────────────────────────
--   -- reviewer keyhole is scoped + no anon leak:
--   select has_table_privilege('anon','email_reviewers','select');   -- false
--   -- helper wired:
--   select public.is_reviewer();            -- false unless you are a seeded reviewer
--   -- exactly one override account (after seeding Kaiden):
--   select email, can_override_review from public.admin_roles where can_override_review;
-- ============================================================================
