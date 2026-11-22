-- Rate-limit automatic reviewer identification per authenticated desk operator.
begin;
create table if not exists public.ball_door_pin_attempts (
 actor text primary key,fail_count integer not null default 0,locked_until timestamptz
);
alter table public.ball_door_pin_attempts enable row level security;
revoke all on public.ball_door_pin_attempts from public,anon,authenticated;
grant all on public.ball_door_pin_attempts to service_role;
create or replace function public.ball_reserve_door_pin(p_actor text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare entry public.ball_door_pin_attempts;
begin
 if auth.role() is distinct from 'service_role' or not public.ball_door_actor_allowed(p_actor) then raise exception 'Check-in access required'; end if;
 insert into public.ball_door_pin_attempts(actor) values(lower(p_actor)) on conflict do nothing;
 select * into entry from public.ball_door_pin_attempts where actor=lower(p_actor) for update;
 if entry.locked_until>now() then return jsonb_build_object('allowed',false); end if;
 if entry.locked_until is not null then entry.fail_count:=0; end if;
 entry.fail_count:=entry.fail_count+1;
 update public.ball_door_pin_attempts set fail_count=entry.fail_count,
 locked_until=case when entry.fail_count>=5 then now()+interval '15 minutes' else null end where actor=lower(p_actor);
 return jsonb_build_object('allowed',true);
end $$;
revoke all on function public.ball_reserve_door_pin(text) from public,anon,authenticated;
grant execute on function public.ball_reserve_door_pin(text) to service_role;
commit;
