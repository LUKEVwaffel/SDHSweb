-- ============================================================================
-- Public roster read for Honor Guard. Run in the Supabase SQL editor (idempotent).
-- Same shape as get_event_color_guard() in event_color_guard_public.sql —
-- event_honor_guard.sql locked SELECT to admins, so this narrow SECURITY
-- DEFINER read exposes only position label, order, and assigned cadet name
-- to the public /events page (anon key).
-- ============================================================================

create or replace function public.get_event_honor_guard(p_event_id uuid)
returns table(position_label text, sort_order int, cadet_name text)
language sql stable security definer set search_path = public as $$
  select hg.position_label, hg.sort_order, cc.name
  from public.event_honor_guard hg
  join public.events e on e.id = hg.event_id
  join public.cadet_consent cc on cc.id = hg.cadet_consent_id
  where hg.event_id = p_event_id
    and e.status = 'posted'
    and e.honor_guard_required
    and hg.cadet_consent_id is not null
  order by hg.sort_order;
$$;
grant execute on function public.get_event_honor_guard(uuid) to anon, authenticated;
