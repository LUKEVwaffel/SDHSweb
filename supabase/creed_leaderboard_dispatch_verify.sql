-- ============================================================================
-- CREED LEADERBOARD — DISPATCH VERIFICATION. Replaces the honor-system age
-- gate with a real check against public.cadet_consent (the dispatch roster
-- that carries name/company/let_level/birthdate — see
-- cadet_consent_grade_let.sql, cadet_consent_birthdates.sql). Run in the
-- Supabase SQL editor (project bjgyvmdzcymruunzavni), AFTER those two files
-- and creed_leaderboard.sql. Idempotent.
--
-- cadet_consent is locked s6-only (admin_roles.sql SECTION 3d) — anon has no
-- SELECT on it. /creed is a public, no-login page, so the client cannot query
-- it directly. Same pattern as cast_vote in photo_hub_v2.sql: a SECURITY
-- DEFINER RPC does the lookup server-side and returns only a yes/no verdict,
-- never the underlying row.
--
-- MATCH RULE: exact match on trimmed/case-insensitive name + company +
-- birthdate. If a match exists and its let_level is 2/3/4, block. If no
-- match is found (not yet in dispatch, mismatched entry), allow — this stays
-- an honor-system fallback for legitimate LET 1 cadets who aren't in the
-- roster yet; it only hard-blocks identities the dispatch data actually
-- confirms as LET 2-4. Company/name are effectively public (team rosters),
-- so birthdate is the only real secret here — rate-limited below so this
-- can't be used to brute-force a cadet's birthdate.
-- ============================================================================

create table if not exists public.creed_verify_attempts (
  id         uuid primary key default gen_random_uuid(),
  fp         text not null,
  created_at timestamptz not null default now()
);

create index if not exists creed_verify_attempts_fp_idx
  on public.creed_verify_attempts (fp, created_at desc);

-- Locked down: only touched from inside verify_creed_eligibility() below
-- (SECURITY DEFINER, runs as table owner). No policies means no direct
-- anon/authenticated access at all.
alter table public.creed_verify_attempts enable row level security;
select public._drop_all_policies('creed_verify_attempts');

create or replace function public.verify_creed_eligibility(
  p_name text, p_company text, p_birthdate date, p_fp text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_recent    int;
  v_let_level text;
begin
  if p_fp is not null then
    select count(*) into v_recent from public.creed_verify_attempts
     where fp = p_fp and created_at > now() - interval '1 hour';
    if v_recent >= 5 then
      raise exception 'verification rate limit reached (5/hour per device)';
    end if;
    insert into public.creed_verify_attempts (fp) values (p_fp);
  end if;

  select let_level into v_let_level
    from public.cadet_consent
   where lower(trim(name)) = lower(trim(p_name))
     and lower(company) = lower(trim(p_company))
     and birthdate = p_birthdate
   limit 1;

  if v_let_level in ('2', '3', '4') then
    return false;
  end if;
  return true;
end $$;

revoke all on function public.verify_creed_eligibility(text, text, date, text) from public;
grant execute on function public.verify_creed_eligibility(text, text, date, text) to anon, authenticated;
