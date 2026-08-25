-- ============================================================================
-- SITE CHECK-IN SURVEY for DISPATCH.
-- Run in the Supabase SQL editor (idempotent).
--
-- Site-wide popup (any visitor, once per device — see src/components/
-- CheckinSurvey.jsx and src/lib/checkinQuestions.js, the shared source of
-- truth for question slugs) collecting 10 multiple-choice answers + one
-- optional free-text field for bugs/gaps. Anonymous — no email captured,
-- so unlike faq_questions there is no reply flow, just read + delete.
--
-- Read/manage restricted to Luke specifically (public.is_luke(), defined in
-- tv_photos.sql), not all s6 — explicit product decision, this is his
-- feedback channel, not a shared inbox. Public insert mirrors the
-- faq_questions / photos_rate_limit pattern: anon insert allowed, device
-- fingerprint rate-limited server-side as a backstop behind the client-side
-- once-per-device localStorage gate.
--
-- CHECK constraints on each MC column duplicate the option slugs from
-- checkinQuestions.js — deliberate, so a direct/bypassed insert can't stuff
-- junk values into what's meant to be clean categorical data for the admin
-- panel's per-question breakdown. Keep both in sync if questions change.
-- ============================================================================

-- *_detail columns hold the inline "describe" text captured when a question's
-- describeOn trigger fires (see checkinQuestions.js) — required for 'other'
-- answers (discover/purpose), optional elaboration for the negative tail of
-- findability/design_rating. Null whenever that question's answer didn't
-- trigger a describe box.
create table if not exists public.site_checkin_responses (
  id                    uuid primary key default gen_random_uuid(),
  campaign_id           text not null,
  discover              text not null check (discover in ('word_of_mouth','event_qr','search','other')),
  discover_detail       text check (discover_detail is null or char_length(discover_detail) <= 500),
  frequency             text not null check (frequency in ('first_time','weekly','monthly','few_times_year')),
  purpose               text not null check (purpose in ('events_calendar','photos','cadet_manual','staff_contacts','news_updates','other')),
  purpose_detail        text check (purpose_detail is null or char_length(purpose_detail) <= 500),
  findability           text not null check (findability in ('very_easy','easy','neutral','hard','very_hard')),
  findability_detail    text check (findability_detail is null or char_length(findability_detail) <= 500),
  design_rating         text not null check (design_rating in ('excellent','good','average','poor','very_poor')),
  design_rating_detail  text check (design_rating_detail is null or char_length(design_rating_detail) <= 500),
  mobile                text not null check (mobile in ('great','ok','poor','havent_tried')),
  speed                 text not null check (speed in ('fast','acceptable','slow','very_slow')),
  useful_section        text not null check (useful_section in ('events','photos','cadet_manual','raiders_rifle','staff_directory','none')),
  recommend             text not null check (recommend in ('definitely','probably','not_sure','probably_not')),
  improve               text not null check (improve in ('more_photos','easier_navigation','more_event_details','faster_loading','better_mobile','nothing_needed')),
  feedback_text         text check (feedback_text is null or char_length(feedback_text) <= 3000),
  page_path             text,
  submitter_fp          text,
  submitted_at          timestamptz not null default now()
);

-- Idempotent for an already-applied earlier version of this table (pre-detail
-- columns, pre-narrowed discover options).
alter table public.site_checkin_responses add column if not exists discover_detail text;
alter table public.site_checkin_responses add column if not exists purpose_detail text;
alter table public.site_checkin_responses add column if not exists findability_detail text;
alter table public.site_checkin_responses add column if not exists design_rating_detail text;
alter table public.site_checkin_responses drop constraint if exists site_checkin_responses_discover_check;
alter table public.site_checkin_responses add constraint site_checkin_responses_discover_check
  check (discover in ('word_of_mouth','event_qr','search','other'));

alter table public.site_checkin_responses enable row level security;
select public._drop_all_policies('site_checkin_responses');

create policy site_checkin_insert_public on public.site_checkin_responses
  for insert to anon, authenticated with check (true);
create policy site_checkin_read_luke on public.site_checkin_responses
  for select to authenticated using (public.is_luke());
create policy site_checkin_delete_luke on public.site_checkin_responses
  for delete to authenticated using (public.is_luke());

-- Per-device rate limit backstop (mirrors faq_questions_rate_limit). The
-- client already enforces one-per-device via localStorage; this just caps
-- the damage from a direct/bypassed insert loop. A null fingerprint
-- (FingerprintJS unavailable) skips the check — same accepted gap as
-- faq_questions and photos_rate_limit.
create or replace function public.site_checkin_rate_limit()
returns trigger language plpgsql as $$
declare recent int;
begin
  if new.submitter_fp is not null then
    select count(*) into recent from public.site_checkin_responses
     where submitter_fp = new.submitter_fp and submitted_at > now() - interval '1 day';
    if recent >= 3 then
      raise exception 'submission rate limit reached (3/day per device)';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists site_checkin_rate_limit_trg on public.site_checkin_responses;
create trigger site_checkin_rate_limit_trg before insert on public.site_checkin_responses
  for each row execute function public.site_checkin_rate_limit();

create index if not exists site_checkin_campaign_idx on public.site_checkin_responses (campaign_id);
