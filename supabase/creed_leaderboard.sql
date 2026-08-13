-- ============================================================================
-- CREED GAME LEADERBOARD — /creed is a public, no-login page (progress is
-- otherwise localStorage-only, see src/lib/creedProgress.js). A perfect
-- (100%) clear of any of the 5 drills unlocks a name+company leaderboard
-- entry. Run in the Supabase SQL editor. Idempotent.
--
-- LET-1-ONLY BY DESIGN: the Creed memorization drills exist for incoming
-- LET 1 cadets — LET 2/3/4 already know the creed from their own LET 1 year,
-- so the leaderboard is scoped to let_level = '1' only. There's no auth on
-- this page to verify a submitter's actual LET level, so this is enforced
-- as a fixed constant the client always sends ('1'), not a picker — same
-- trust model as the rest of this anonymous public form.
-- ============================================================================

create table if not exists public.creed_leaderboard (
  id           uuid primary key default gen_random_uuid(),
  cadet_name   text not null check (char_length(cadet_name) between 1 and 60),
  company      text not null check (company in ('ALPHA','BRAVO','CHARLIE','DELTA')),
  let_level    text not null default '1' check (let_level = '1'),
  game_key     text not null check (game_key in ('fillBlank','sequencing','scramble','recall','speed')),
  game_label   text not null check (char_length(game_label) between 1 and 60),
  metric_label text not null check (char_length(metric_label) between 1 and 30),
  metric_value text not null check (char_length(metric_value) between 1 and 30),
  submitter_fp text,
  created_at   timestamptz not null default now()
);

create index if not exists creed_leaderboard_created_idx on public.creed_leaderboard(created_at desc);

alter table public.creed_leaderboard enable row level security;
select public._drop_all_policies('creed_leaderboard');

-- Public read (it's a leaderboard — the whole point is everyone sees it).
create policy creed_leaderboard_read_public on public.creed_leaderboard
  for select to anon, authenticated using (true);

-- Public insert (no login on /creed) — let_level and game_key CHECK
-- constraints above are what actually enforce "LET 1 only, real game only",
-- not this policy.
create policy creed_leaderboard_insert_public on public.creed_leaderboard
  for insert to anon, authenticated with check (let_level = '1');

-- No public update — a submitted score is permanent, cadets can't edit it
-- in after the fact. s6 admins can delete bad-faith entries.
create policy creed_leaderboard_delete_s6 on public.creed_leaderboard
  for delete to authenticated using (public.is_s6());

-- Per-device submission rate limit — mirrors public.faq_questions_rate_limit
-- (faq_questions.sql). A null fingerprint skips the check, same accepted gap.
create or replace function public.creed_leaderboard_rate_limit()
returns trigger language plpgsql as $$
declare recent int;
begin
  if new.submitter_fp is not null then
    select count(*) into recent from public.creed_leaderboard
     where submitter_fp = new.submitter_fp and created_at > now() - interval '1 hour';
    if recent >= 10 then
      raise exception 'submission rate limit reached (10/hour per device)';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists creed_leaderboard_rate_limit_trg on public.creed_leaderboard;
create trigger creed_leaderboard_rate_limit_trg before insert on public.creed_leaderboard
  for each row execute function public.creed_leaderboard_rate_limit();
