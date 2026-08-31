-- ============================================================================
-- OPTIC POST-COMPETITION PARENT SURVEY for DISPATCH.
-- Run in the Supabase SQL editor (idempotent).
--
-- Public no-login survey (src/components/OpticSurvey.jsx, slugs from
-- src/lib/opticSurveyQuestions.js) collecting parent feedback on the OPTIC
-- beta after a Raider competition — identity block (name/team/phone), seven
-- multiple-choice questions, five free-text boxes. One row per submission in
-- public.optic_survey_responses.
--
-- Access mirrors site_checkin.sql: anon insert allowed, device-fingerprint
-- rate limit as a server-side backstop behind the client's once-per-device
-- localStorage flag. Read/delete restricted to Luke specifically
-- (public.is_luke(), defined in tv_photos.sql) — this is his feedback
-- channel, not a shared inbox.
--
-- CHECK constraints on the categorical columns duplicate the option slugs
-- from opticSurveyQuestions.js on purpose, so a direct/bypassed insert can't
-- stuff junk into what's meant to be clean data for a per-question
-- breakdown. Keep both in sync if a question changes.
-- ============================================================================

create table if not exists public.optic_survey_responses (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      text not null,

  -- identity block — all optional except phone_type
  submitter_name   text check (submitter_name is null or char_length(submitter_name) <= 200),
  raider_team      text check (raider_team is null or raider_team in ('male','coed','both','unsure')),
  phone_type       text not null check (phone_type in ('iphone','android','other')),

  -- multiple choice (overall is the one required answer client-side)
  overall          text not null check (overall in ('rough','meh','decent','worked_well','loved_it')),
  install          text check (install is null or install in ('yes_easy','yes_confusing','tried_failed','didnt_try','didnt_know')),
  upload           text check (upload is null or upload in ('yes_fine','yes_problems','tried_failed','didnt_try')),
  save_photo       text check (save_photo is null or save_photo in ('yes_worked','yes_failed','didnt_try')),
  feed_value       text check (feed_value is null or feed_value in ('very','somewhat','not_really')),
  notify           text check (notify is null or notify in ('yes','maybe','no')),
  will_return      text check (will_return is null or will_return in ('definitely','probably','not_sure','probably_not')),

  -- free text
  confusing        text check (confusing is null or char_length(confusing) <= 3000),
  best_part        text check (best_part is null or char_length(best_part) <= 3000),
  one_change       text check (one_change is null or char_length(one_change) <= 3000),
  install_help     text check (install_help is null or char_length(install_help) <= 3000),
  anything_else    text check (anything_else is null or char_length(anything_else) <= 3000),

  submitter_fp     text,
  submitted_at     timestamptz not null default now()
);

create index if not exists optic_survey_campaign_idx on public.optic_survey_responses (campaign_id);

alter table public.optic_survey_responses enable row level security;
select public._drop_all_policies('optic_survey_responses');

create policy optic_survey_insert_public on public.optic_survey_responses
  for insert to anon, authenticated with check (true);
create policy optic_survey_read_luke on public.optic_survey_responses
  for select to authenticated using (public.is_luke());
create policy optic_survey_delete_luke on public.optic_survey_responses
  for delete to authenticated using (public.is_luke());

-- Per-device rate limit backstop (mirrors site_checkin_rate_limit). The
-- client already enforces one-per-device via localStorage; this caps the
-- damage from a direct/bypassed insert loop. A null fingerprint
-- (FingerprintJS unavailable) skips the check — same accepted gap as the
-- other public-insert tables in this codebase.
create or replace function public.optic_survey_rate_limit()
returns trigger language plpgsql as $$
declare recent int;
begin
  if new.submitter_fp is not null then
    select count(*) into recent from public.optic_survey_responses
     where submitter_fp = new.submitter_fp and submitted_at > now() - interval '1 day';
    if recent >= 5 then
      raise exception 'submission rate limit reached (5/day per device)';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists optic_survey_rate_limit_trg on public.optic_survey_responses;
create trigger optic_survey_rate_limit_trg before insert on public.optic_survey_responses
  for each row execute function public.optic_survey_rate_limit();

-- ============================================================================
-- Verify: select * from public.optic_survey_responses order by submitted_at desc;
--         select overall, count(*) from public.optic_survey_responses group by overall;
-- ============================================================================
