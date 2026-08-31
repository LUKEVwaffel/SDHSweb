-- ============================================================================
-- PICTURE OF THE COMP — public single-winner photo vote for DISPATCH.
-- Run in the Supabase SQL editor (idempotent, safe to re-run).
--
-- Model:
--   comp_photo_polls      : one voting poll per competition (one row for Rhea)
--   comp_photo_candidates : the ~15 finalist photos Luke picks in DISPATCH,
--                           each joined to a public.photos row + denormalized
--                           vote_count
--   comp_photo_votes      : one vote per device per poll — RPC-only writes,
--                           a voter name is required
--
-- Surfaces:
--   /vote  (src/components/CompPhotoVote.jsx)        — public ballot
--   DISPATCH → Photos → PICTURE OF THE COMP          — pick 15, open/close,
--     (src/components/admin/panels/photos/CompPhotoBallot.jsx)  declare winner
--   home page band + /tv congrats screen             — read winner_candidate_id
--
-- Integrity:
--   * vote_count is mutated ONLY by the SECURITY DEFINER RPC
--     public.cast_comp_photo_vote(...). anon has no direct DML on
--     comp_photo_votes and no UPDATE on comp_photo_candidates.
--   * Poll + candidate management is authenticated-admin only (public.is_admin()
--     from admin_roles.sql). Public gets SELECT on polls + candidates so the
--     ballot and the home/TV surfaces can render without a login.
--   * Voter names are NOT publicly readable (comp_photo_votes SELECT is
--     is_admin() only) — the ballot shows tallies off comp_photo_candidates.
--
-- Reuses: public.is_admin() (admin_roles.sql), public._drop_all_policies()
--         (auth_rls.sql), pgcrypto for gen_random_uuid().
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.comp_photo_polls (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid references public.events(id) on delete set null,
  title               text not null default 'Picture of the Comp',
  status              text not null default 'draft' check (status in ('draft','open','closed')),
  opens_at            timestamptz,
  closes_at           timestamptz,
  winner_candidate_id uuid,
  created_at          timestamptz not null default now()
);

create table if not exists public.comp_photo_candidates (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references public.comp_photo_polls(id) on delete cascade,
  photo_id    uuid not null references public.photos(id) on delete cascade,
  sort_order  int  not null default 0,
  vote_count  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (poll_id, photo_id)
);
create index if not exists comp_photo_candidates_poll_idx on public.comp_photo_candidates(poll_id);

create table if not exists public.comp_photo_votes (
  id           uuid primary key default gen_random_uuid(),
  poll_id      uuid not null references public.comp_photo_polls(id) on delete cascade,
  candidate_id uuid not null references public.comp_photo_candidates(id) on delete cascade,
  voter_name   text not null check (char_length(btrim(voter_name)) between 1 and 80),
  device_fp    text,
  created_at   timestamptz not null default now(),
  unique (poll_id, device_fp)
);
create index if not exists comp_photo_votes_candidate_idx on public.comp_photo_votes(candidate_id);
create index if not exists comp_photo_votes_fp_time_idx on public.comp_photo_votes(device_fp, created_at);

-- winner FK (added after comp_photo_candidates exists)
do $$ begin
  alter table public.comp_photo_polls
    add constraint comp_photo_polls_winner_fk
    foreign key (winner_candidate_id) references public.comp_photo_candidates(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ── Per-device vote rate-limit backstop ────────────────────────────────────
-- The unique(poll_id, device_fp) constraint already caps a fingerprinted
-- device at one vote per poll; this mirrors optic_survey_rate_limit as a
-- second line against a direct/bypassed insert loop across polls. A null
-- fingerprint skips the check — same accepted gap as the other public-insert
-- tables in this codebase.
create or replace function public.comp_photo_votes_rate_limit()
returns trigger language plpgsql as $$
declare recent int;
begin
  if new.device_fp is not null then
    select count(*) into recent from public.comp_photo_votes
     where device_fp = new.device_fp and created_at > now() - interval '1 day';
    if recent >= 10 then
      raise exception 'vote rate limit reached (10/day per device)';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists comp_photo_votes_rate_limit_trg on public.comp_photo_votes;
create trigger comp_photo_votes_rate_limit_trg before insert on public.comp_photo_votes
  for each row execute function public.comp_photo_votes_rate_limit();

-- ── RPC: cast a vote (one per device per poll, name required) ───────────────
create or replace function public.cast_comp_photo_vote(
  p_poll uuid, p_candidate uuid, p_name text, p_fp text
) returns public.comp_photo_candidates
language plpgsql security definer set search_path = public as $$
declare
  v_poll   public.comp_photo_polls;
  v_cand   public.comp_photo_candidates;
  v_ins    int;
begin
  if p_name is null or char_length(btrim(p_name)) = 0 then
    raise exception 'a name is required to vote';
  end if;

  select * into v_poll from public.comp_photo_polls where id = p_poll;
  if v_poll is null then raise exception 'poll not found'; end if;
  if v_poll.status <> 'open' then raise exception 'voting is not open'; end if;
  if v_poll.closes_at is not null and now() >= v_poll.closes_at then
    raise exception 'voting has closed';
  end if;

  select * into v_cand from public.comp_photo_candidates
   where id = p_candidate and poll_id = p_poll;
  if v_cand is null then raise exception 'photo is not on this ballot'; end if;

  insert into public.comp_photo_votes (poll_id, candidate_id, voter_name, device_fp)
    values (p_poll, p_candidate, btrim(p_name), p_fp)
  on conflict (poll_id, device_fp) do nothing;
  get diagnostics v_ins = row_count;
  if v_ins = 0 then
    raise exception 'this device has already voted';
  end if;

  update public.comp_photo_candidates
     set vote_count = vote_count + 1
   where id = p_candidate
   returning * into v_cand;

  return v_cand;
end $$;

-- ── RPC: sweep — flip open polls to closed once past their deadline ────────
-- The frontend also treats now() >= closes_at as closed; this keeps the
-- stored status honest for anything reading the column directly. Winner is
-- still declared explicitly in DISPATCH (winner_candidate_id), not here.
create or replace function public.close_due_comp_photo_polls()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.comp_photo_polls
     set status = 'closed'
   where status = 'open' and closes_at is not null and now() >= closes_at;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── Row Level Security ─────────────────────────────────────────────────────
alter table public.comp_photo_polls      enable row level security;
alter table public.comp_photo_candidates enable row level security;
alter table public.comp_photo_votes      enable row level security;

select public._drop_all_policies('comp_photo_polls');
select public._drop_all_policies('comp_photo_candidates');
select public._drop_all_policies('comp_photo_votes');

-- polls + candidates: public read; authenticated admin manages everything.
create policy comp_photo_polls_read on public.comp_photo_polls
  for select to anon, authenticated using (true);
create policy comp_photo_polls_admin on public.comp_photo_polls
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy comp_photo_candidates_read on public.comp_photo_candidates
  for select to anon, authenticated using (true);
create policy comp_photo_candidates_admin on public.comp_photo_candidates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- votes: NO direct anon writes (RPC only). Names readable by admin only.
create policy comp_photo_votes_read_admin on public.comp_photo_votes
  for select to authenticated using (public.is_admin());

-- ── Grants ────────────────────────────────────────────────────────────────
grant execute on function public.cast_comp_photo_vote(uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.close_due_comp_photo_polls() to authenticated;

-- ============================================================================
-- Verify:
--   select * from public.comp_photo_polls;
--   select c.*, p.photo_url from public.comp_photo_candidates c
--     join public.photos p on p.id = c.photo_id order by c.vote_count desc;
--   select candidate_id, count(*) from public.comp_photo_votes group by 1;
-- ============================================================================
