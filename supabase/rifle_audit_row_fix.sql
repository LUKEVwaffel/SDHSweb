-- ============================================================================
-- HOTFIX — rifle_audit_row() broke rifle_matches/rifle_shooters/
-- rifle_calendar_events edits ("record new has no field shooter_id").
-- Run this in the Supabase SQL editor now. Idempotent, safe to run alone.
--
-- CAUSE: rifle_lineups.sql redefined the shared audit trigger function to
-- fall back to new.shooter_id/old.shooter_id for rifle_lineups (which has
-- no single id column, just a composite match_id+slot key). Direct dot-
-- notation field access on a RECORD is resolved against the CURRENTLY
-- FIRING table's actual row type at parse time, before COALESCE's runtime
-- short-circuiting even gets a chance to skip it — so the function broke
-- for every other audited table, which has no shooter_id column at all.
--
-- FIX: use to_jsonb(...)->>'field' instead of dot access. jsonb key lookup
-- is generic across any row type and just returns null for a missing key
-- instead of raising — safe for every table this trigger fires on.
-- ============================================================================

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

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   update public.rifle_matches set location = location where id = (select id from public.rifle_matches limit 1);
--   -- should succeed with no error now
--   select * from public.rifle_audit_log order by changed_at desc limit 1;
-- ============================================================================
