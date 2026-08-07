-- ============================================================================
-- Follow-up to tv_control_center.sql: lets the 1SGT pick a specific subset of
-- quotes/verses (from src/data/quotes.json / verses.json) to cycle through
-- during the day, instead of always rotating the entire library. Run in the
-- Supabase SQL editor (idempotent) — safe to run whether or not
-- tv_control_center.sql already ran.
-- ============================================================================

alter table public.tv_daily_settings
  add column if not exists selected_quote_ids text[] not null default '{}',
  add column if not exists selected_verse_ids text[] not null default '{}';

-- Extend the existing touch trigger (from tv_control_center.sql) so curating
-- a new quote/verse selection also counts as "touching" the widget, same as
-- changing the mode or the custom message.
create or replace function public.tv_daily_settings_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if (new.bottom_widget_mode is distinct from old.bottom_widget_mode)
     or (new.custom_message is distinct from old.custom_message)
     or (new.custom_signoff is distinct from old.custom_signoff)
     or (new.selected_quote_ids is distinct from old.selected_quote_ids)
     or (new.selected_verse_ids is distinct from old.selected_verse_ids) then
    new.mode_set_at := now();
  end if;
  return new;
end;
$$;
