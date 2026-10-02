-- 2026-09-28: every signup/lookup matches cadet_consent.school_email with an
-- exact, lowercase comparison (ball-lookup-cadet, rifle-lookup-cadet,
-- ball-submit-signup). One roster row stored as "Km9116954@..." made that
-- cadet unfindable. Normalize on write so casing/whitespace from roster
-- imports or manual edits can never break matching again.
create or replace function public.normalize_cadet_school_email()
returns trigger
language plpgsql
as $$
begin
  if new.school_email is not null then
    new.school_email := nullif(lower(btrim(new.school_email)), '');
  end if;
  return new;
end;
$$;

drop trigger if exists cadet_consent_normalize_school_email on public.cadet_consent;
create trigger cadet_consent_normalize_school_email
  before insert or update of school_email on public.cadet_consent
  for each row execute function public.normalize_cadet_school_email();

-- Backfill anything already off (the trigger rewrites it on update).
update public.cadet_consent
set school_email = school_email
where school_email is not null
  and school_email <> lower(btrim(school_email));
