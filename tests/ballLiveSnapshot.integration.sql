begin;
set test.admin='true';
set test.role='authenticated';
do $$
declare h uuid;g uuid;s jsonb;v text;rejected boolean:=false;
begin
 insert into ball_signups(cadet_name,cadet_company,cadet_gender,status,amount_due,amount_paid,cash_received,standalone_guest,field_trip_form_required,field_trip_form_received,dress_approved)
 values('Test Host','Alpha','female','fully_verified',50,50,true,false,true,true,true) returning id into h;
 insert into ball_guests(signup_id,name,gender,guest_type,verified_at,is_sdhs_jrotc,school_attended,field_trip_form_required,field_trip_form_received,dress_approved)
 values(h,'Test Guest','female','date',now(),true,'SDHS',false,false,true) returning id into g;
 s:=public.ball_ticket_snapshot(2);v:=s->>'version';
 assert s->>'checked_at' is not null;
 assert (s->'hosts'->0->>'field_trip_form_received')::boolean;
 assert (public.ball_ticket_snapshot(2)->>'version')=v,'Unchanged records changed version';
 update ball_signups set field_trip_form_received=false where id=h;
 assert (public.ball_ticket_snapshot(2)->>'version')<>v,'Form change not detected';
 update ball_signups set field_trip_form_received=true where id=h;
 v:=public.ball_ticket_snapshot(2)->>'version';
 update ball_signups set amount_paid=20,cash_received=false where id=h;
 assert (public.ball_ticket_snapshot(2)->>'version')<>v,'Payment change not detected';
 update ball_signups set amount_paid=50,cash_received=true where id=h;
 v:=public.ball_ticket_snapshot(2)->>'version';
 update ball_guests set dress_approved=false where id=g;
 assert (public.ball_ticket_snapshot(2)->>'version')<>v,'Guest approval change not detected';
 update ball_guests set dress_approved=true where id=g;
 begin
 insert into ball_ticket_deliveries(signup_id,recipient_type,recipient_name,recipient_company,distributed,distributed_at,distributed_by) values(h,'host','Test Host','Alpha',true,now(),'test@example.invalid');
 exception when others then rejected:=position('guest_form_missing' in sqlerrm)>0;end;
 assert rejected,'Stale guest exemption bypassed SDHS form requirement';
 update ball_guests set field_trip_form_received=true where id=g;
 v:=public.ball_ticket_snapshot(2)->>'version';
 insert into ball_ticket_deliveries(signup_id,recipient_type,recipient_name,recipient_company,distributed,distributed_at,distributed_by) values(h,'host','Test Host','Alpha',true,now(),'test@example.invalid');
 assert (public.ball_ticket_snapshot(2)->>'version')<>v,'Delivery change not detected';
 assert not has_function_privilege('anon','public.ball_ticket_snapshot(integer)','execute');
 perform set_config('test.admin','false',true);
 rejected:=false;begin perform public.ball_ticket_snapshot(2);exception when others then rejected:=true;end;
 assert rejected,'Non-S6 could obtain private snapshot';
 raise notice 'Atomic snapshot, invalidation, access checks and current delivery guard passed.';
end $$;
rollback;
