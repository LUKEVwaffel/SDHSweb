-- ============================================================================
-- RIFLE CALENDAR — /rifle/portal Calendar tab + the public /rifle page's
-- EventCalendar (which has been a static, dataless placeholder since it was
-- built — no table backed it, the "SEASON NOT STARTED" line was hardcoded).
-- Run in the Supabase SQL editor. Idempotent. Depends on rifle_admin_portal.sql
-- and rifle_scores_audit.sql already being run.
--
-- Deliberately a standalone rifle_calendar_events table, NOT the site-wide
-- `events` table (events_calendar.sql / events_multi_calendar.sql / etc.) —
-- that table is DISPATCH/OPTIC's shared, admin_roles-gated system with its
-- own draft/posted workflow and recurrence rules. Writing rifle_admins into
-- it would cross the isolation boundary rifle_admin_portal.sql explicitly
-- calls out (rifle_admins must never be able to touch admin_role()/is_s6()'s
-- systems). Same posture as rifle_shooters/rifle_matches: its own small
-- table, public read, rifle-admin-or-s6 write.
-- ============================================================================

create table if not exists public.rifle_calendar_events (
  id          uuid primary key default gen_random_uuid(),
  event_date  date not null,
  title       text not null,
  event_type  text not null default 'practice' check (event_type in ('competition', 'practice', 'qualifier', 'other')),
  location    text,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists rifle_calendar_events_date_idx on public.rifle_calendar_events (event_date);

alter table public.rifle_calendar_events enable row level security;

drop policy if exists rifle_calendar_events_read_public on public.rifle_calendar_events;
create policy rifle_calendar_events_read_public on public.rifle_calendar_events
  for select to anon, authenticated using (true);

drop policy if exists rifle_calendar_events_write_admin on public.rifle_calendar_events;
create policy rifle_calendar_events_write_admin on public.rifle_calendar_events
  for all to authenticated
  using (public.is_rifle_admin() or public.is_s6())
  with check (public.is_rifle_admin() or public.is_s6());


-- ── Wire into the existing audit log (rifle_scores_audit.sql) ──────────────
alter table public.rifle_audit_log drop constraint if exists rifle_audit_log_table_name_check;
alter table public.rifle_audit_log add constraint rifle_audit_log_table_name_check
  check (table_name in ('rifle_scores', 'rifle_matches', 'rifle_shooters', 'rifle_calendar_events'));

drop trigger if exists rifle_audit_trigger on public.rifle_calendar_events;
create trigger rifle_audit_trigger after insert or update or delete on public.rifle_calendar_events
  for each row execute function public.rifle_audit_row();

-- Extend the undo RPC with a rifle_calendar_events branch. Full replace
-- (not ALTER) since plpgsql branches on table_name inside one function body.
create or replace function public.rifle_undo_audit_entry(p_audit_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_entry public.rifle_audit_log%rowtype;
begin
  if not (public.is_rifle_admin() or public.is_s6()) then
    raise exception 'not authorized';
  end if;

  select * into v_entry from public.rifle_audit_log where id = p_audit_id for update;
  if not found then
    raise exception 'audit entry not found';
  end if;
  if v_entry.undone then
    raise exception 'already undone';
  end if;

  if v_entry.table_name = 'rifle_scores' then
    if v_entry.action = 'INSERT' then
      delete from public.rifle_scores where id = v_entry.row_id;
    elsif v_entry.action = 'UPDATE' then
      update public.rifle_scores set
        shooter_id = (v_entry.old_data->>'shooter_id')::uuid,
        match_id   = (v_entry.old_data->>'match_id')::uuid,
        prone      = (v_entry.old_data->>'prone')::numeric,
        standing   = (v_entry.old_data->>'standing')::numeric,
        kneeling   = (v_entry.old_data->>'kneeling')::numeric,
        total      = (v_entry.old_data->>'total')::numeric,
        bulls      = (v_entry.old_data->>'bulls')::integer,
        upload_id  = (v_entry.old_data->>'upload_id')::uuid
      where id = v_entry.row_id;
    elsif v_entry.action = 'DELETE' then
      insert into public.rifle_scores (id, shooter_id, match_id, prone, standing, kneeling, total, bulls, upload_id, created_at)
      values (
        (v_entry.old_data->>'id')::uuid, (v_entry.old_data->>'shooter_id')::uuid, (v_entry.old_data->>'match_id')::uuid,
        (v_entry.old_data->>'prone')::numeric, (v_entry.old_data->>'standing')::numeric, (v_entry.old_data->>'kneeling')::numeric,
        (v_entry.old_data->>'total')::numeric, (v_entry.old_data->>'bulls')::integer, (v_entry.old_data->>'upload_id')::uuid,
        coalesce((v_entry.old_data->>'created_at')::timestamptz, now())
      )
      on conflict (id) do nothing;
    end if;

  elsif v_entry.table_name = 'rifle_matches' then
    if v_entry.action = 'INSERT' then
      delete from public.rifle_matches where id = v_entry.row_id;
    elsif v_entry.action = 'UPDATE' then
      update public.rifle_matches set
        week     = (v_entry.old_data->>'week')::integer,
        dates    = v_entry.old_data->>'dates',
        opponent = v_entry.old_data->>'opponent',
        location = v_entry.old_data->>'location'
      where id = v_entry.row_id;
    elsif v_entry.action = 'DELETE' then
      insert into public.rifle_matches (id, week, dates, opponent, location, created_at)
      values (
        (v_entry.old_data->>'id')::uuid, (v_entry.old_data->>'week')::integer, v_entry.old_data->>'dates',
        v_entry.old_data->>'opponent', v_entry.old_data->>'location',
        coalesce((v_entry.old_data->>'created_at')::timestamptz, now())
      )
      on conflict (id) do nothing;
    end if;

  elsif v_entry.table_name = 'rifle_shooters' then
    if v_entry.action = 'INSERT' then
      delete from public.rifle_shooters where id = v_entry.row_id;
    elsif v_entry.action = 'UPDATE' then
      update public.rifle_shooters set
        name         = v_entry.old_data->>'name',
        rifle_no     = (v_entry.old_data->>'rifle_no')::integer,
        active       = (v_entry.old_data->>'active')::boolean,
        school_email = v_entry.old_data->>'school_email'
      where id = v_entry.row_id;
    elsif v_entry.action = 'DELETE' then
      insert into public.rifle_shooters (id, name, rifle_no, active, school_email, created_at)
      values (
        (v_entry.old_data->>'id')::uuid, v_entry.old_data->>'name', (v_entry.old_data->>'rifle_no')::integer,
        coalesce((v_entry.old_data->>'active')::boolean, true), v_entry.old_data->>'school_email',
        coalesce((v_entry.old_data->>'created_at')::timestamptz, now())
      )
      on conflict (id) do nothing;
    end if;

  elsif v_entry.table_name = 'rifle_calendar_events' then
    if v_entry.action = 'INSERT' then
      delete from public.rifle_calendar_events where id = v_entry.row_id;
    elsif v_entry.action = 'UPDATE' then
      update public.rifle_calendar_events set
        event_date = (v_entry.old_data->>'event_date')::date,
        title      = v_entry.old_data->>'title',
        event_type = v_entry.old_data->>'event_type',
        location   = v_entry.old_data->>'location',
        notes      = v_entry.old_data->>'notes'
      where id = v_entry.row_id;
    elsif v_entry.action = 'DELETE' then
      insert into public.rifle_calendar_events (id, event_date, title, event_type, location, notes, created_at)
      values (
        (v_entry.old_data->>'id')::uuid, (v_entry.old_data->>'event_date')::date, v_entry.old_data->>'title',
        coalesce(v_entry.old_data->>'event_type', 'practice'), v_entry.old_data->>'location', v_entry.old_data->>'notes',
        coalesce((v_entry.old_data->>'created_at')::timestamptz, now())
      )
      on conflict (id) do nothing;
    end if;
  end if;

  update public.rifle_audit_log
    set undone = true, undone_by = auth.jwt() ->> 'email', undone_at = now()
    where id = p_audit_id;
end;
$$;

revoke execute on function public.rifle_undo_audit_entry(uuid) from public;
revoke all     on function public.rifle_undo_audit_entry(uuid) from anon;
grant  execute on function public.rifle_undo_audit_entry(uuid) to authenticated;

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select has_table_privilege('anon','rifle_calendar_events','select'); -- true
--   insert into public.rifle_calendar_events (event_date, title, event_type) values (current_date, 'test', 'practice');
--   select * from public.rifle_audit_log where table_name = 'rifle_calendar_events'; -- one INSERT row
--   delete from public.rifle_calendar_events where title = 'test';
-- ============================================================================
