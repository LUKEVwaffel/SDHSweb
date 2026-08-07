-- ============================================================================
-- Public roster read for Color Guard. Run in the Supabase SQL editor (idempotent).
-- event_color_guard.sql locked SELECT to admins (internal duty roster), so the
-- public /events page (anon key) got zero rows back even though the feature
-- was fully built server-side — nothing surfaced on EventDetailCard. This adds
-- a narrow SECURITY DEFINER read, same shape as list_cadet_roster(), scoped to
-- one event and returning only what's safe to show publicly: position label,
-- order, and the assigned cadet's full name (intentional — not a privacy
-- concern per product decision, mirrors photo credit names already shown).
-- ============================================================================

create or replace function public.get_event_color_guard(p_event_id uuid)
returns table(position_label text, sort_order int, cadet_name text)
language sql stable security definer set search_path = public as $$
  select cg.position_label, cg.sort_order, cc.name
  from public.event_color_guard cg
  join public.events e on e.id = cg.event_id
  join public.cadet_consent cc on cc.id = cg.cadet_consent_id
  where cg.event_id = p_event_id
    and e.status = 'posted'
    and e.color_guard_required
    and cg.cadet_consent_id is not null
  order by cg.sort_order;
$$;
grant execute on function public.get_event_color_guard(uuid) to anon, authenticated;
