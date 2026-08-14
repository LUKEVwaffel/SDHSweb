-- ============================================================================
-- HONOR GUARD roster per event. Run in the Supabase SQL editor (idempotent).
-- Adds a toggle column on events (same convention as color_guard_required)
-- plus a child table for the fixed 11-position roster (Commander + Sabre
-- 1-10). Unlike Color Guard, every position is required and the roster is
-- fixed size — no optional/alternate slots, no "+" add. See EventsPanel.jsx
-- for the client-side form.
-- ============================================================================

alter table public.events add column if not exists honor_guard_required boolean not null default false;

create table if not exists public.event_honor_guard (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events(id) on delete cascade,
  position_label    text not null,
  sort_order        int not null default 0,
  cadet_consent_id  uuid references public.cadet_consent(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (event_id, sort_order)
);
create index if not exists event_honor_guard_event_idx on public.event_honor_guard(event_id);
create index if not exists event_honor_guard_cadet_idx on public.event_honor_guard(cadet_consent_id);

-- Cross-table iron-clad gate, same shape as color_guard_requires_fields().
-- Every position in this roster is required (fixed Commander + 10 Sabre
-- slots), so the gap check is just "any position missing a cadet".
create or replace function public.honor_guard_requires_fields()
returns trigger language plpgsql as $$
declare gap_count int;
begin
  if new.status = 'posted' and new.honor_guard_required then
    select count(*) into gap_count from public.event_honor_guard hg
    where hg.event_id = new.id and hg.cadet_consent_id is null;
    if gap_count > 0 then
      raise exception 'Cannot post: % Honor Guard position(s) incomplete', gap_count;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists events_honor_guard_check on public.events;
create trigger events_honor_guard_check
  before insert or update on public.events
  for each row execute function public.honor_guard_requires_fields();

-- RLS: mirrors event_color_guard exactly (admin-only read, s6-anywhere /
-- s5-battalion-or-raiders write). See events_color_guard.sql for rationale.
alter table public.event_honor_guard enable row level security;
select public._drop_all_policies('event_honor_guard');
create policy event_honor_guard_read_admin on public.event_honor_guard
  for select to authenticated using (public.is_admin());
create policy event_honor_guard_write_admin on public.event_honor_guard
  for all to authenticated
  using (public.is_s6() or (public.is_s5() and exists (
    select 1 from public.events e where e.id = event_honor_guard.event_id and (e.team is null or e.team = 'raiders'))))
  with check (public.is_s6() or (public.is_s5() and exists (
    select 1 from public.events e where e.id = event_honor_guard.event_id and (e.team is null or e.team = 'raiders'))));
