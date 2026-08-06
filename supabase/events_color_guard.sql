-- ============================================================================
-- COLOR GUARD roster per event. Run in the Supabase SQL editor (idempotent).
-- Adds a toggle column on events (same convention as uniform_required /
-- transportation_required / permission_slip_required) plus a child table for
-- the up-to-N-position roster (default 5: US Flag, TN Flag, US Rifle,
-- TN Rifle, Alternate — first 4 required, Alternate + any added via "+" are
-- optional). See EventsPanel.jsx for the client-side form.
-- ============================================================================

alter table public.events add column if not exists color_guard_required boolean not null default false;

create table if not exists public.event_color_guard (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events(id) on delete cascade,
  position_label    text not null,
  sort_order        int not null default 0,
  required          boolean not null default false,
  cadet_consent_id  uuid references public.cadet_consent(id) on delete set null,
  ascot_color       text check (ascot_color in ('Red','White','Black')),
  glove_color       text check (glove_color in ('Black','White')),
  created_at        timestamptz not null default now(),
  unique (event_id, sort_order)
);
create index if not exists event_color_guard_event_idx on public.event_color_guard(event_id);
create index if not exists event_color_guard_cadet_idx on public.event_color_guard(cadet_consent_id);

-- Cross-table iron-clad gate: a plain CHECK on events can't see child-table
-- rows, so this needs a trigger, unlike the other ironclad fields in
-- events_ironclad.sql. Fires on every insert/update of events; only actually
-- checks anything when posting with color_guard_required set.
create or replace function public.color_guard_requires_fields()
returns trigger language plpgsql as $$
declare gap_count int;
begin
  if new.status = 'posted' and new.color_guard_required then
    select count(*) into gap_count from public.event_color_guard cg
    where cg.event_id = new.id and cg.required
      and (cg.cadet_consent_id is null or cg.ascot_color is null or cg.glove_color is null);
    if gap_count > 0 then
      raise exception 'Cannot post: % required Color Guard position(s) incomplete', gap_count;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists events_color_guard_check on public.events;
create trigger events_color_guard_check
  before insert or update on public.events
  for each row execute function public.color_guard_requires_fields();

-- RLS: read = any admin (s5 or s6, mirrors events_read... but admin-only, not
-- public — this is an internal duty roster, not calendar content). Write =
-- s6 anywhere, s5 only on battalion/raiders events, mirroring events' own
-- write grant in admin_roles.sql SECTION 3b.
alter table public.event_color_guard enable row level security;
select public._drop_all_policies('event_color_guard');
create policy event_color_guard_read_admin on public.event_color_guard
  for select to authenticated using (public.is_admin());
create policy event_color_guard_write_admin on public.event_color_guard
  for all to authenticated
  using (public.is_s6() or (public.is_s5() and exists (
    select 1 from public.events e where e.id = event_color_guard.event_id and (e.team is null or e.team = 'raiders'))))
  with check (public.is_s6() or (public.is_s5() and exists (
    select 1 from public.events e where e.id = event_color_guard.event_id and (e.team is null or e.team = 'raiders'))));

-- Narrow roster lookup for the picker. cadet_consent itself stays S-6-only
-- (admin_roles.sql SECTION 3d) since it carries consent status / parent /
-- school emails / notes — this SECURITY DEFINER function bypasses that RLS
-- but only ever returns id/name/company, and only to a logged-in admin
-- (s5 or s6). Non-admin callers get zero rows, not an error.
create or replace function public.list_cadet_roster()
returns table(id uuid, name text, company text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.company from public.cadet_consent c
  where public.is_admin() order by c.company, c.name;
$$;
grant execute on function public.list_cadet_roster() to authenticated;
