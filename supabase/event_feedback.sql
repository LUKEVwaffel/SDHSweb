-- ============================================================================
-- EVENT FEEDBACK + DISPATCH AI (Beta) for DISPATCH. Run in the Supabase SQL
-- editor. Idempotent. Requires admin_roles.sql (public.is_s6()) to have
-- already run.
--
-- DESIGN
--   • General reusable system, not a one-off for the rafting trip — any event
--     can turn feedback collection on via `events.feedback_enabled`. Cadets
--     fill out a guided post-event form (no login, name/LET/company typed in
--     manually — see src/components/EventFeedbackForm.jsx). One row per
--     submission in `event_feedback`.
--   • Public insert mirrors site_checkin.sql: anon insert allowed (gated to
--     events that actually have feedback_enabled=true), device-fingerprint
--     rate limit as a server-side backstop.
--   • DISPATCH AI (Beta): S-6 triggers a Claude API analysis run per event
--     (supabase/functions/analyze-event-feedback) that compiles every
--     submission into one deep-analysis pass — themes, sentiment, safety
--     flags, recommendations. Each run is a NEW row in
--     event_feedback_analysis (append-only, not overwrite) so runs can be
--     compared as the prompt gets tuned during the beta.
--   • ACCESS: S-6 only for now, on purpose — Luke wants to verify the whole
--     flow end-to-end on his own login before S-5 (the actual AAR owners)
--     gets access. The S-5 grant is written below but commented out; uncomment
--     both policies once verified. Same staged-rollout shape as every other
--     role split in this codebase (see admin_roles.sql).
-- ============================================================================

-- ── 1. Per-event toggle ─────────────────────────────────────────────────────
alter table public.events
  add column if not exists feedback_enabled  boolean not null default false,
  add column if not exists feedback_due_date date;

-- ── 2. event_feedback ────────────────────────────────────────────────────────
create table if not exists public.event_feedback (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events(id) on delete cascade,
  submitter_name      text not null check (length(trim(submitter_name)) > 0),
  submitter_type      text not null default 'cadet' check (submitter_type in ('cadet', 'staff')),
  let_level           text,
  company             text,
  went_well           text,
  needs_improvement   text,
  safety_concerns     text,
  want_more_of        text,
  fun_rating          int check (fun_rating between 1 and 5),
  additional_notes    text,
  submitter_fp        text,
  created_at          timestamptz not null default now()
);

create index if not exists event_feedback_event_idx on public.event_feedback(event_id);

alter table public.event_feedback enable row level security;
select public._drop_all_policies('event_feedback');

-- Anyone can submit, but only into an event S-5/S-6 actually turned feedback
-- on for — closes off a stray insert into an arbitrary/old event id.
create policy event_feedback_insert_public on public.event_feedback
  for insert to anon, authenticated
  with check (event_id in (select id from public.events where feedback_enabled = true));

create policy event_feedback_all_s6 on public.event_feedback
  for all to authenticated using (public.is_s6()) with check (public.is_s6());

-- S-5 read grant — deliberately NOT enabled yet. Uncomment once Luke has
-- verified the full submit → review → DISPATCH AI flow on his own S-6 login:
-- create policy event_feedback_select_s5 on public.event_feedback
--   for select to authenticated using (public.is_s5());

-- Per-device rate limit backstop, same shape as site_checkin_rate_limit —
-- client already soft-limits one submission per event per device, this caps
-- the damage from a direct/bypassed insert loop. Null fingerprint (FingerprintJS
-- unavailable) skips the check, same accepted gap as the other public-insert
-- tables in this codebase.
create or replace function public.event_feedback_rate_limit()
returns trigger language plpgsql as $$
declare recent int;
begin
  if new.submitter_fp is not null then
    select count(*) into recent from public.event_feedback
     where submitter_fp = new.submitter_fp and event_id = new.event_id
       and created_at > now() - interval '1 day';
    if recent >= 3 then
      raise exception 'submission rate limit reached for this event (3/day per device)';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists event_feedback_rate_limit_trg on public.event_feedback;
create trigger event_feedback_rate_limit_trg before insert on public.event_feedback
  for each row execute function public.event_feedback_rate_limit();

-- ── 3. event_feedback_analysis (DISPATCH AI runs) ──────────────────────────
-- Append-only: every "Run DISPATCH AI Analysis" click in the admin panel adds
-- a new row rather than overwriting the last run, so beta-testing prompt
-- changes doesn't destroy history of what the model said before.
create table if not exists public.event_feedback_analysis (
  id                          uuid primary key default gen_random_uuid(),
  event_id                    uuid not null references public.events(id) on delete cascade,
  -- Server-set from the JWT, not client-supplied.
  generated_by                text not null default (auth.jwt() ->> 'email'),
  generated_at                timestamptz not null default now(),
  submission_count_analyzed   int not null default 0,
  -- Structured Claude output: { themes[], sentiment, safety_flags[],
  -- standout_praise[], recommendations[], summary } — shape defined by the
  -- edge function's prompt, not enforced here (keeps the schema stable while
  -- the prompt itself is still being tuned during the beta).
  result                      jsonb not null
);

create index if not exists event_feedback_analysis_event_idx on public.event_feedback_analysis(event_id);

alter table public.event_feedback_analysis enable row level security;
select public._drop_all_policies('event_feedback_analysis');

-- No client insert policy — only the edge function writes here, via the
-- service-role key (bypasses RLS entirely), same pattern as every other
-- Claude/Resend-backed edge function in this codebase.
create policy event_feedback_analysis_all_s6 on public.event_feedback_analysis
  for all to authenticated using (public.is_s6()) with check (public.is_s6());

-- Same S-5 deferral as event_feedback above:
-- create policy event_feedback_analysis_select_s5 on public.event_feedback_analysis
--   for select to authenticated using (public.is_s5());

-- ============================================================================
-- Verify: select * from public.event_feedback;
--         select * from public.event_feedback_analysis;
--         select id, title, feedback_enabled from public.events where feedback_enabled;
-- ============================================================================
