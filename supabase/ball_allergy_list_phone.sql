-- ============================================================================
-- BALL ALLERGY LIST — add cadet_phone so S-5 can call/text the cadet directly
-- (faster than email). Run in the Supabase SQL editor. Idempotent.
-- Depends on: ball_finalize.sql (ball_allergy_list), ball_phone_numbers.sql
-- (ball_signups.cadet_phone). Run ball_phone_numbers.sql first.
-- ============================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ball_signups' and column_name = 'cadet_phone') then
    raise exception 'run ball_phone_numbers.sql first (ball_signups.cadet_phone missing)';
  end if;
end $$;

drop function if exists public.ball_allergy_list();
create function public.ball_allergy_list()
returns table (
  id                   uuid,
  cadet_name           text,
  cadet_phone          text,
  cadet_allergy_email  text,
  submitted_at         timestamptz,
  allergy_status       text,
  allergy_contacted_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select s.id, s.cadet_name, s.cadet_phone, s.cadet_allergy_email, s.created_at,
         s.allergy_status, s.allergy_contacted_at
  from public.ball_signups s
  where s.cadet_has_allergy
    and (public.is_s5() or public.is_s6())
  order by s.created_at desc
$$;
revoke all     on function public.ball_allergy_list() from public, anon;
grant  execute on function public.ball_allergy_list() to authenticated;
-- ============================================================================
