-- ============================================================================
-- OPTIC "bring it back next year?" — one-tap question shown to every OPTIC
-- user on launch during the final comp of the 2026 season (Hamilton County
-- Raider Championship, 2026-10-03). One row per answer; the client keeps it to
-- one per device via localStorage, the trigger below caps bypass loops.
--
-- Read: Luke only (DISPATCH → OPTIC Survey panel shows the tally).
-- Safe to re-run.
-- ============================================================================

create table if not exists public.optic_next_year_votes (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  text not null default 'optic-next-year-2026',
  vote         text not null check (vote in ('yes','maybe','no')),
  role         text check (role is null or role in ('cadet','family')),
  standalone   boolean,
  voter_fp     text check (voter_fp is null or char_length(voter_fp) <= 200),
  created_at   timestamptz not null default now()
);

create index if not exists optic_next_year_votes_campaign_idx
  on public.optic_next_year_votes (campaign_id, created_at desc);

alter table public.optic_next_year_votes enable row level security;

drop policy if exists optic_next_year_insert_public on public.optic_next_year_votes;
create policy optic_next_year_insert_public on public.optic_next_year_votes
  for insert to anon, authenticated with check (true);

drop policy if exists optic_next_year_read_luke on public.optic_next_year_votes;
create policy optic_next_year_read_luke on public.optic_next_year_votes
  for select to authenticated using (public.is_luke());

drop policy if exists optic_next_year_delete_luke on public.optic_next_year_votes;
create policy optic_next_year_delete_luke on public.optic_next_year_votes
  for delete to authenticated using (public.is_luke());

grant insert on public.optic_next_year_votes to anon, authenticated;
grant select, delete on public.optic_next_year_votes to authenticated;

-- Per-device backstop: 3 votes/day. Null fingerprint skips (same accepted gap
-- as optic_survey_rate_limit).
create or replace function public.optic_next_year_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.voter_fp is not null then
    if (select count(*) from public.optic_next_year_votes
        where voter_fp = new.voter_fp and created_at > now() - interval '1 day') >= 3 then
      raise exception 'vote rate limit reached';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists optic_next_year_rate_limit_trg on public.optic_next_year_votes;
create trigger optic_next_year_rate_limit_trg before insert on public.optic_next_year_votes
  for each row execute function public.optic_next_year_rate_limit();
