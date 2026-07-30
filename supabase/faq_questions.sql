-- ============================================================================
-- FAQ QUESTION SUBMISSIONS for DISPATCH.
-- Run in the Supabase SQL editor (idempotent).
--
-- Public visitors on the About page FAQ can submit a question that isn't
-- already answered (name optional, email required — an admin replies
-- directly to submitter_email via the answer-faq-question edge function).
-- Only s6 (public.is_s6(), defined in admin_roles.sql) may read/manage
-- submissions — mirrors the photos / email_subscribers public-insert
-- pattern in admin_roles.sql section 3c.
--
-- SECURITY-REVIEWER FOLLOW-UP: unlike email_subscribers, every accepted
-- insert here triggers a live Resend email to every s6 account (see
-- notify-question-submitted edge function) — the client-side honeypot in
-- FaqSection.jsx is trivially bypassed by a direct insert, so this table
-- gets its own device-fingerprint rate limit + length caps (photos_rate_limit
-- in photo_hub_v2.sql is the precedent this mirrors, tightened for a form
-- that should only ever fire a few times per visitor).
-- ============================================================================

create table if not exists public.faq_questions (
  id              uuid primary key default gen_random_uuid(),
  question        text not null check (char_length(question) between 1 and 2000),
  submitter_name  text check (submitter_name is null or char_length(submitter_name) <= 200),
  submitter_email text not null check (char_length(submitter_email) between 1 and 200),
  submitter_fp    text,
  status          text not null default 'new' check (status in ('new','reviewed','answered')),
  submitted_at    timestamptz not null default now(),
  answer_text     text,
  answered_by     text,
  answered_at     timestamptz
);

alter table public.faq_questions enable row level security;
select public._drop_all_policies('faq_questions');

create policy faq_questions_insert_public on public.faq_questions
  for insert to anon, authenticated with check (true);
create policy faq_questions_read_s6 on public.faq_questions
  for select to authenticated using (public.is_s6());
create policy faq_questions_update_s6 on public.faq_questions
  for update to authenticated using (public.is_s6()) with check (public.is_s6());
create policy faq_questions_delete_s6 on public.faq_questions
  for delete to authenticated using (public.is_s6());

-- Per-device submission rate limit (mirrors public.photos_rate_limit). A null
-- fingerprint (FingerprintJS unavailable) skips the check same as photos —
-- accepted gap, matches existing prod risk posture rather than adding a new one.
create or replace function public.faq_questions_rate_limit()
returns trigger language plpgsql as $$
declare recent int;
begin
  if new.submitter_fp is not null then
    select count(*) into recent from public.faq_questions
     where submitter_fp = new.submitter_fp and submitted_at > now() - interval '1 hour';
    if recent >= 5 then
      raise exception 'submission rate limit reached (5/hour per device)';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists faq_questions_rate_limit_trg on public.faq_questions;
create trigger faq_questions_rate_limit_trg before insert on public.faq_questions
  for each row execute function public.faq_questions_rate_limit();

-- ============================================================================
-- MIGRATION (2026-07-26): submitter_email required + reply columns.
-- The CREATE TABLE above already reflects this shape for fresh installs —
-- this block brings an already-applied table (this one) up to match.
-- Idempotent: safe to re-run.
--
-- Rows with no submitter_email predate the required-email rule and were
-- test submissions (email was optional then, so nothing to reply to) —
-- deleted rather than backfilled with a sentinel, since there's no real
-- submitter behind them and answer-faq-question has nowhere to send a reply.
-- Catches both NULL and empty/whitespace-only strings (the latter would
-- otherwise survive this delete and then fail the not-null check re-added
-- below). SECURITY-REVIEWER: reviewed 2026-07-26 — delete scope confirmed
-- correct (no FKs reference this table, the rate-limit trigger is
-- BEFORE INSERT only and doesn't fire on DELETE); guard below caps the
-- blast radius in case the "0-2 stray rows" assumption is wrong.
-- ============================================================================
do $$
declare stray_count int;
begin
  select count(*) into stray_count from public.faq_questions
   where submitter_email is null or char_length(trim(submitter_email)) = 0;
  if stray_count > 5 then
    raise exception 'faq_questions: % rows would be deleted for missing/blank email (expected 0-2) - aborting, review manually', stray_count;
  end if;
end $$;

delete from public.faq_questions where submitter_email is null or char_length(trim(submitter_email)) = 0;

alter table public.faq_questions drop constraint if exists faq_questions_submitter_email_check;
alter table public.faq_questions alter column submitter_email set not null;
alter table public.faq_questions add constraint faq_questions_submitter_email_check
  check (char_length(submitter_email) between 1 and 200);

alter table public.faq_questions add column if not exists answer_text text;
alter table public.faq_questions add column if not exists answered_by text;
alter table public.faq_questions add column if not exists answered_at timestamptz;
