-- Show the roster identity of cadets attending as guests, independently of
-- their host's company. Preserve each installed view's columns and access gate.
begin;
do $$
declare
  view_name text;
  definition text;
  extra_columns text;
begin
  foreach view_name in array array['ball_guests_dress_view', 'ball_guests_ops_view'] loop
    extra_columns := '';
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = view_name and column_name = 'guest_company'
    ) then extra_columns := ', c.company as guest_company, c.let_level as guest_let_level'; end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = view_name and column_name = 'guest_is_cadet'
    ) then
      if extra_columns = '' then continue; end if;
    else
      extra_columns := extra_columns || ', g.is_sdhs_jrotc as guest_is_cadet';
    end if;
    select pg_get_viewdef(to_regclass('public.' || view_name), true) into definition;
    if definition is null then raise exception 'Missing required view: %', view_name; end if;
    execute format(
      'create or replace view public.%I with (security_barrier=true) as
       select old_view.* %s
       from (%s) old_view
       join public.ball_guests g on g.id=old_view.id
       left join public.cadet_consent c on c.id=g.sdhs_matched_cadet_id and g.is_sdhs_jrotc is true',
      view_name, extra_columns, rtrim(definition, E';\n ')
    );
  end loop;
end $$;
commit;
