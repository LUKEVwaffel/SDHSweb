-- ============================================================================
-- MILITARY BALL — HARDENING. Audit-remediation schema changes. Run in the
-- Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
--
-- DEPLOY ORDER (see BALL_DEPLOY_ORDER.md):
--   ball_signup.sql → ball_finalize.sql → ball_guest_model.sql →
--   ball_hardening.sql (THIS FILE) → ball_guards.sql → (edge functions)
--
-- This file accretes across remediation phases. Each section is tagged with
-- the phase that added it.
-- ============================================================================

-- HARD GATE: files 1–3 must be applied first.
do $$
begin
  if to_regclass('public.ball_signups') is null then
    raise exception 'ball_hardening.sql: run ball_signup.sql first (ball_signups missing)';
  end if;
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ball_guests' and column_name = 'guest_type') then
    raise exception 'ball_hardening.sql: run ball_guest_model.sql first (ball_guests.guest_type missing)';
  end if;
end $$;


-- ── PHASE 1 · item 4 — one signup per cadet ───────────────────────────────
-- ball_signups had only a plain index on cadet_school_email, so a replayed
-- signup token (or a double-click) created duplicate rows + duplicate guest
-- e-mails + duplicate S-5 allergy pings. lower() so a case variant can't slip
-- past (ball-submit-signup already lowercases, this is the backstop).
--
-- If this fails with "could not create unique index ... duplicate key", clean
-- the dupes first:
--   select lower(cadet_school_email), count(*), array_agg(id order by created_at)
--   from public.ball_signups group by 1 having count(*) > 1;
-- keep the earliest row per cadet, delete the rest (cascades to ball_guests).
create unique index if not exists ball_signups_cadet_email_uniq
  on public.ball_signups (lower(cadet_school_email));


-- ── PHASE 1 · item 4 — single-use signup tokens ──────────────────────────
-- The signup token (_shared/signupToken.ts) is a stateless HMAC blob that was
-- replayable for its full 18-minute TTL. It now carries a random `jti`;
-- ball-submit-signup inserts that jti here BEFORE writing the signup, so the
-- PK collision on a second submit is what actually blocks the replay (works
-- even across concurrent requests / multiple edge instances).
--
-- Rows are only meaningful for ~18 min (after the token exp the blob is dead
-- anyway). Safe to prune on a schedule, e.g.:
--   delete from public.ball_signup_tokens_used where used_at < now() - interval '1 day';
create table if not exists public.ball_signup_tokens_used (
  jti      text primary key,
  email    text not null,
  used_at  timestamptz not null default now()
);
create index if not exists ball_signup_tokens_used_used_at_idx
  on public.ball_signup_tokens_used (used_at);

alter table public.ball_signup_tokens_used enable row level security;
-- service_role only — the edge function is the sole reader/writer. No anon or
-- authenticated policy, and the blanket grants are revoked.
revoke all on public.ball_signup_tokens_used from anon, authenticated;


-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select indexdef from pg_indexes where indexname = 'ball_signups_cadet_email_uniq';
--   select to_regclass('public.ball_signup_tokens_used');            -- not null
--   select has_table_privilege('anon','public.ball_signup_tokens_used','select'); -- false
-- ============================================================================
