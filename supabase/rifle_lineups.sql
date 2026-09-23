-- ============================================================================
-- RIFLE LINEUPS — /rifle/portal "Lineup & Rankings" tab (Range Ops redesign).
-- Run in the Supabase SQL editor. Idempotent. Depends on rifle_admin_portal.sql
-- and rifle_calendar.sql already being run (this extends the same audit log
-- + undo RPC rifle_calendar.sql wired rifle_calendar_events into).
--
-- WHAT THIS ADDS:
--   • rifle_lineups   — the 6 shooters picked for a given match: slots 1-4
--     are starters (count toward the published team aggregate), slots 5-6
--     are alternates. One row per (match, slot) — re-picking a slot just
--     upserts over it. Same posture as rifle_calendar_events: its own small
--     table, public read, rifle-admin-or-s6 write, wired into the existing
--     audit trail.
-- ============================================================================


create table if not exists public.rifle_lineups (
  match_id   uuid not null references public.rifle_matches(id) on delete cascade,
  slot       integer not null check (slot between 1 and 6), -- 1-4 starters, 5-6 alternates
  shooter_id uuid not null references public.rifle_shooters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (match_id, slot)
);

create index if not exists rifle_lineups_match_idx on public.rifle_lineups (match_id);

alter table public.rifle_lineups enable row level security;

drop policy if exists rifle_lineups_read_public on public.rifle_lineups;
create policy rifle_lineups_read_public on public.rifle_lineups
  for select to anon, authenticated using (true);

drop policy if exists rifle_lineups_write_admin on public.rifle_lineups;
create policy rifle_lineups_write_admin on public.rifle_lineups
  for all to authenticated
  using (public.is_rifle_admin() or public.is_s6())
  with check (public.is_rifle_admin() or public.is_s6());


-- ── Wire into the existing audit log (rifle_scores_audit.sql) ──────────────
alter table public.rifle_audit_log drop constraint if exists rifle_audit_log_table_name_check;
alter table public.rifle_audit_log add constraint rifle_audit_log_table_name_check
  check (table_name in ('rifle_scores', 'rifle_matches', 'rifle_shooters', 'rifle_calendar_events', 'rifle_lineups'));

drop trigger if exists rifle_audit_trigger on public.rifle_lineups;
create trigger rifle_audit_trigger after insert or update or delete on public.rifle_lineups
  for each row execute function public.rifle_audit_row();

-- rifle_lineups has a composite primary key (match_id, slot), not a single
-- `id` column like every other audited table. row_id just needs to be SOME
-- stable-ish uuid here — the undo RPC's rifle_lineups branch never looks it
-- up by primary key, it rebuilds the full match_id/slot/shooter_id triple
-- from old_data/new_data directly. Falls back to shooter_id, then a fresh
-- uuid. Uses to_jsonb(...)->>'field' rather than dot-notation field access
-- (new.shooter_id) — this function is shared across every audited table via
-- the trigger below, and a direct field reference to a column that doesn't
-- exist on the CURRENTLY FIRING table (e.g. rifle_matches has no
-- shooter_id) fails at parse time regardless of COALESCE's runtime
-- short-circuiting. jsonb key lookup is generic and just returns null for a
-- missing key instead.
create or replace function public.rifle_audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_row_id uuid := coalesce(
    (v_row->>'id')::uuid,
    (v_row->>'shooter_id')::uuid,
    gen_random_uuid()
  );
begin
  insert into public.rifle_audit_log (table_name, row_id, action, old_data, new_data, changed_by)
  values (
    TG_TABLE_NAME,
    v_row_id,
    TG_OP,
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    auth.jwt() ->> 'email'
  );
  return coalesce(new, old);
end;
$$;

-- Full replace (not ALTER) since plpgsql branches on table_name inside one
-- function body — same approach rifle_calendar.sql used to add its branch.
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

  elsif v_entry.table_name = 'rifle_lineups' then
    -- Composite-keyed table (match_id, slot) — no synthetic id to upsert
    -- against, so undo works directly off the old/new payload.
    if v_entry.action = 'INSERT' then
      delete from public.rifle_lineups
        where match_id = (v_entry.new_data->>'match_id')::uuid and slot = (v_entry.new_data->>'slot')::integer;
    elsif v_entry.action = 'UPDATE' then
      update public.rifle_lineups set
        shooter_id = (v_entry.old_data->>'shooter_id')::uuid
        where match_id = (v_entry.old_data->>'match_id')::uuid and slot = (v_entry.old_data->>'slot')::integer;
    elsif v_entry.action = 'DELETE' then
      insert into public.rifle_lineups (match_id, slot, shooter_id, created_at)
      values (
        (v_entry.old_data->>'match_id')::uuid, (v_entry.old_data->>'slot')::integer, (v_entry.old_data->>'shooter_id')::uuid,
        coalesce((v_entry.old_data->>'created_at')::timestamptz, now())
      )
      on conflict (match_id, slot) do nothing;
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
--   select has_table_privilege('anon','rifle_lineups','select'); -- true
--   insert into public.rifle_lineups (match_id, slot, shooter_id)
--     select id, 1, (select id from public.rifle_shooters limit 1) from public.rifle_matches limit 1;
--   select * from public.rifle_audit_log where table_name = 'rifle_lineups'; -- one INSERT row
--   delete from public.rifle_lineups where slot = 1;
-- ============================================================================
