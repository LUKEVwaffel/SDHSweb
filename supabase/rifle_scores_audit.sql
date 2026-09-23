-- ============================================================================
-- RIFLE SCORES AUDIT LOG + UNDO — /rifle/portal Scores tab.
-- Run in the Supabase SQL editor. Idempotent.
--
-- WHAT THIS ADDS:
--   • rifle_audit_log   — every insert/update/delete on rifle_scores,
--     rifle_matches, rifle_shooters, captured automatically by trigger.
--     Read-only to clients (rifle-admin-or-s6 select only); rows are written
--     exclusively by the trigger function below, which runs SECURITY DEFINER
--     so it bypasses RLS the same way on_rifle_admin_password_changed does
--     in rifle_admin_portal.sql.
--   • rifle_undo_audit_entry(uuid) — reverts one audit entry: re-deletes an
--     insert, restores the prior row on an update, re-inserts a deleted row.
--     Applying the undo is itself a normal write, so it fires the trigger
--     again and leaves its own audit entry (a visible "undone" trail, not a
--     hole in history).
--
-- Depends on rifle_admin_portal.sql already being run (is_rifle_admin(),
-- rifle_scores/rifle_matches/rifle_shooters).
-- ============================================================================


-- ── SECTION 1 — audit log table ─────────────────────────────────────────────
create table if not exists public.rifle_audit_log (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null check (table_name in ('rifle_scores', 'rifle_matches', 'rifle_shooters')),
  row_id      uuid not null,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  changed_by  text,
  changed_at  timestamptz not null default now(),
  undone      boolean not null default false,
  undone_by   text,
  undone_at   timestamptz
);

create index if not exists rifle_audit_log_changed_at_idx on public.rifle_audit_log (changed_at desc);
create index if not exists rifle_audit_log_row_id_idx on public.rifle_audit_log (row_id);

alter table public.rifle_audit_log enable row level security;

drop policy if exists rifle_audit_log_read_admin on public.rifle_audit_log;
create policy rifle_audit_log_read_admin on public.rifle_audit_log
  for select to authenticated
  using (public.is_rifle_admin() or public.is_s6());

-- No insert/update/delete policy for anon/authenticated — every write comes
-- from the SECURITY DEFINER trigger function or the undo RPC below.
revoke insert, update, delete on public.rifle_audit_log from anon, authenticated;


-- ── SECTION 2 — trigger: log every change to the three rifle tables ────────
create or replace function public.rifle_audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.rifle_audit_log (table_name, row_id, action, old_data, new_data, changed_by)
  values (
    TG_TABLE_NAME,
    coalesce(new.id, old.id),
    TG_OP,
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    auth.jwt() ->> 'email'
  );
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['rifle_scores', 'rifle_matches', 'rifle_shooters'] loop
    execute format('drop trigger if exists rifle_audit_trigger on public.%I', t);
    execute format(
      'create trigger rifle_audit_trigger after insert or update or delete on public.%I for each row execute function public.rifle_audit_row()',
      t
    );
  end loop;
end $$;


-- ── SECTION 3 — undo RPC ────────────────────────────────────────────────────
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
--   update public.rifle_matches set location = location where id = (select id from public.rifle_matches limit 1);
--   select * from public.rifle_audit_log order by changed_at desc limit 5;   -- one UPDATE row, old_data/new_data populated
--   select has_table_privilege('anon','rifle_audit_log','select');          -- false
--   select has_function_privilege('anon','public.rifle_undo_audit_entry(uuid)','execute'); -- false
-- ============================================================================
