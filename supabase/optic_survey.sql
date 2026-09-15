-- ============================================================================
-- OPTIC PARENT SURVEY for DISPATCH.
-- Run in the Supabase SQL editor (idempotent).
--
-- Public no-login survey (src/components/OpticSurvey.jsx, slugs from
-- src/lib/opticSurveyQuestions.js) collecting parent feedback on OPTIC.
-- One row per submission in public.optic_survey_responses, filtered by
-- campaign_id per round.
--
-- 2026-09-08 round: table created fresh (drop+recreate, safe at 0 rows then).
-- 2026-09-15 round (Spring Hill, campaign optic-springhill-2026-09): the
-- 2026-09-08 round collected 12 real rows before this one, so this file is
-- now ALTER-only, never drop. This round is deliberately lighter (5
-- questions + 1 text box, chasing the notifications + iPhone save bugs)
-- and does not reuse used_it/install/upload/feed_value/trouble_area/
-- best_part/top_change/notify/will_return/confusing/best_part_text/
-- one_change — those columns stay on the table, unused by new rows, holding
-- the prior round's data. New columns: notif_experience, biggest_problem,
-- team_filter_useful. overall/save_photo/phone_type/raider_team/
-- submitter_name/anything_else are reused as-is (same CHECKs still fit).
--
-- Access mirrors site_checkin.sql: anon insert allowed, device-fingerprint
-- rate limit as a server-side backstop behind the client's once-per-device
-- localStorage flag. Read/delete restricted to Luke specifically
-- (public.is_luke(), defined in tv_photos.sql).
--
-- CHECK constraints on the categorical columns duplicate the option slugs
-- from opticSurveyQuestions.js on purpose, so a direct insert cannot stuff
-- junk into what is meant to be clean data for a per-question breakdown.
-- Keep both in sync if a question changes.
-- ============================================================================

create table if not exists public.optic_survey_responses (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      text not null,

  -- identity block, all optional except phone_type
  submitter_name   text check (submitter_name is null or char_length(submitter_name) <= 200),
  raider_team      text check (raider_team is null or raider_team in ('male','coed','both','unsure')),
  phone_type       text not null check (phone_type in ('iphone','android','other')),

  -- multiple choice (overall is the one required answer client-side)
  overall          text not null check (overall in ('rough','meh','decent','worked_well','loved_it','did_not_use')),
  used_it          text check (used_it is null or used_it in ('a_lot','a_little','saw_it_only','didnt_know')),
  install          text check (install is null or install in ('yes_easy','yes_confusing','tried_failed','didnt_try','didnt_know')),
  upload           text check (upload is null or upload in ('yes_fine','yes_problems','tried_failed','didnt_try')),
  save_photo       text check (save_photo is null or save_photo in ('yes_worked','yes_failed','didnt_try')),
  feed_value       text check (feed_value is null or feed_value in ('very','somewhat','not_really')),
  trouble_area     text check (trouble_area is null or trouble_area in ('home_screen','uploading','saving_photos','finding_cadet','none','other')),
  best_part        text check (best_part is null or best_part in ('shared_feed','events_i_missed','easy_upload','one_place','none','other')),
  top_change       text check (top_change is null or top_change in ('filter_by_team','faster_posting','easier_install','notifications','downloads','nothing_major','other')),
  notify           text check (notify is null or notify in ('yes','maybe','no')),
  will_return      text check (will_return is null or will_return in ('definitely','probably','not_sure','no')),

  -- optional free text, none required
  confusing        text check (confusing is null or char_length(confusing) <= 3000),
  best_part_text   text check (best_part_text is null or char_length(best_part_text) <= 3000),
  one_change       text check (one_change is null or char_length(one_change) <= 3000),
  anything_else    text check (anything_else is null or char_length(anything_else) <= 3000),

  submitter_fp     text,
  submitted_at     timestamptz not null default now()
);

-- 2026-09-15 Spring Hill round: new columns for the lighter question set.
-- ADD COLUMN IF NOT EXISTS is idempotent; the CHECK is added separately so
-- re-running this file does not error on an already-present constraint.
alter table public.optic_survey_responses add column if not exists notif_experience text;
alter table public.optic_survey_responses add column if not exists biggest_problem text;
alter table public.optic_survey_responses add column if not exists team_filter_useful text;

do $$ begin
  alter table public.optic_survey_responses add constraint optic_survey_notif_experience_check
    check (notif_experience is null or notif_experience in ('got_alerts','turned_on_no_alerts','tried_couldnt','never_saw_option','didnt_try'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.optic_survey_responses add constraint optic_survey_biggest_problem_check
    check (biggest_problem is null or biggest_problem in ('notifications','saving_photos','uploading','feed_empty_or_slow','install','none','other'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.optic_survey_responses add constraint optic_survey_team_filter_useful_check
    check (team_filter_useful is null or team_filter_useful in ('very','somewhat','not_really','didnt_notice'));
exception when duplicate_object then null; end $$;

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
-- (FingerprintJS unavailable) skips the check, same accepted gap as the
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
-- Verify: select * from public.optic_survey_responses where campaign_id = 'optic-springhill-2026-09' order by submitted_at desc;
--         select overall, count(*) from public.optic_survey_responses where campaign_id = 'optic-springhill-2026-09' group by overall;
--         select notif_experience, count(*) from public.optic_survey_responses where campaign_id = 'optic-springhill-2026-09' group by notif_experience;
--         select biggest_problem, count(*) from public.optic_survey_responses where campaign_id = 'optic-springhill-2026-09' group by biggest_problem;
-- ============================================================================
