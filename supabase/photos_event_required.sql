-- ============================================================================
-- PHOTOS EVENT REQUIRED — every new photo submission must attach to a posted
-- event, for every team (previously only Raiders needed one; battalion and
-- the other specialty teams could submit with event_id = null). Run in the
-- Supabase SQL editor. Idempotent.
-- Depends on: photo_hub_v2.sql (photos table), events_calendar.sql (events.status).
--
-- WHAT THIS ADDS:
--   • photos_require_posted_event() — BEFORE INSERT trigger on public.photos.
--     Rejects any insert missing event_id, or whose event isn't status='posted',
--     or whose event's team doesn't match the photo's team (battalion = the
--     event's team column is null).
--   • event_id stays NULLABLE on the column itself — do NOT add a NOT NULL
--     constraint, it would break every historical row (battalion/specialty
--     photos uploaded before this migration all have event_id = null). The
--     trigger only gates NEW inserts going forward.
-- ============================================================================

create or replace function public.photos_require_posted_event()
returns trigger
language plpgsql
as $$
declare
  v_event public.events;
begin
  if new.event_id is null then
    raise exception 'photos.event_id is required, every upload must attach to a posted event';
  end if;

  select * into v_event from public.events where id = new.event_id;
  if v_event is null then
    raise exception 'event % not found', new.event_id;
  end if;

  if v_event.status <> 'posted' then
    raise exception 'event % is not posted yet, cannot attach photos to a draft event', new.event_id;
  end if;

  if new.team = 'battalion' then
    if v_event.team is not null then
      raise exception 'event % is not a battalion event', new.event_id;
    end if;
  elsif v_event.team is distinct from new.team then
    raise exception 'event % does not belong to team %', new.event_id, new.team;
  end if;

  return new;
end;
$$;

drop trigger if exists photos_require_posted_event_trg on public.photos;
create trigger photos_require_posted_event_trg
  before insert on public.photos
  for each row execute function public.photos_require_posted_event();

-- ============================================================================
-- Done. Verify:
--   insert into public.photos (team, storage_path, photo_url) values
--     ('battalion','x','https://x') -- should raise "event_id is required"
-- ============================================================================
