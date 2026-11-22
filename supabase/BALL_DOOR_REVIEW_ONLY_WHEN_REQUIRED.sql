-- Apply after BALL_DOOR_ADDITIONAL_REVIEWERS.sql.
begin;

create or replace function public.ball_decide_door_attire(p_actor text,p_kind text,p_person uuid,p_approver text,p_hash text,p_approved boolean,p_expected text,p_sandbox boolean default true)
returns jsonb language plpgsql security definer set search_path=public as $$
declare staff record; person record;
begin
 if auth.role() is distinct from 'service_role' or not public.ball_door_actor_allowed(p_actor) then raise exception 'Check-in access required'; end if;
 if p_approved is null or p_sandbox is null then raise exception 'Decision and mode required'; end if;
 perform 1 from public.ball_door_approvers where key=p_approver for share;
 if p_approver='danielle' then
   perform 1 from public.ball_door_approvers a join public.admin_roles r on r.email=a.email where a.key=p_approver for share of r;
 else
   perform 1 from public.ball_door_approvers a join public.ball_dress_staff s on s.email=a.email where a.key=p_approver for share of s;
 end if;
 select * into staff from public.ball_door_reviewer_credentials() where key=p_approver;
 if not found or not staff.active or staff.pin_hash is null or staff.pin_hash is distinct from p_hash then raise exception 'Authorized approver required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('ball-2026:'||p_kind||':'||p_person::text,0));
 select * into person from public.ball_door_people() where person_kind=p_kind and person_id=p_person;
 if not found then raise exception 'Attendee no longer exists'; end if;
 if not p_sandbox and person.attire_status is distinct from p_expected then raise exception 'Attire status changed. Refresh and review again'; end if;
 if person.attire_status not in ('pending','denied') then raise exception 'This attendee’s attire is already cleared'; end if;
 if not p_sandbox and exists(select 1 from public.ball_arrivals where event_key='2026' and person_kind=p_kind and person_id=p_person and checked_in_at is not null) then raise exception 'Undo check-in before recording a new attire decision'; end if;
 if not p_sandbox then
 insert into public.ball_door_attire(person_kind,person_id,approved,approver_key) values(p_kind,p_person,p_approved,p_approver)
 on conflict(person_kind,person_id) do update set approved=excluded.approved,approver_key=excluded.approver_key,decided_at=now();
 insert into public.ball_door_decision_log(person_kind,person_id,action,actor,approver_key)
 values(p_kind,p_person,case when p_approved then 'attire_approved' else 'attire_denied' end,lower(p_actor),p_approver);
 end if;
 return jsonb_build_object('attire_status',case when p_approved then 'approved' else 'denied' end,'attire_by',staff.name,'sandbox',p_sandbox);
end $$;
revoke all on function public.ball_decide_door_attire(text,text,uuid,text,text,boolean,text,boolean) from public,anon,authenticated;
grant execute on function public.ball_decide_door_attire(text,text,uuid,text,text,boolean,text,boolean) to service_role;

commit;
