-- Apply after the desk PIN and additional door reviewer migrations.
begin;

create or replace function public.ball_check_in_pair(p_people jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
 actor text:=public.ball_resolve_checkin_actor(auth.jwt()->>'email');
 pair record;
 at_desk timestamptz:=clock_timestamp();
 updated jsonb:='[]'::jsonb;
begin
 if not public.can_ball_checkin() then raise exception 'Check-in access required'; end if;
 if jsonb_typeof(p_people) is distinct from 'array' or jsonb_array_length(p_people) is distinct from 2 then
  raise exception 'Choose two people from the same reservation';
 end if;
 if not exists(
   select 1 from jsonb_to_recordset(p_people) as requested(kind text,id uuid)
   join public.ball_door_people() p on p.person_kind=requested.kind and p.person_id=requested.id
   group by p.group_key having count(distinct (p.person_kind,p.person_id))=2
 ) then raise exception 'Choose two different people from the same reservation'; end if;

 -- The existing writer checks each revision and entry rule, and logs each
 -- person's arrival. An error rolls back the entire pair.
 for pair in
  select * from jsonb_to_recordset(p_people) as requested(kind text,id uuid,revision uuid)
  order by kind,id
 loop
  updated:=updated||jsonb_build_array(public.ball_write_arrival(
    actor,pair.kind,pair.id,true,pair.revision,gen_random_uuid(),at_desk
  ));
 end loop;
 return updated;
end $$;
revoke all on function public.ball_check_in_pair(jsonb) from public,anon,authenticated;
grant execute on function public.ball_check_in_pair(jsonb) to authenticated;

commit;
