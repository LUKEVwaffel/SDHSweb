-- Disposable local database only. No real ticket receipts or emails.
begin;
set test.role='service_role';
insert into email_reviewers values('ticket-chief@example.invalid',true,true,false);
do $$
declare h uuid; incomplete uuid; historical uuid; guest_id uuid; t jsonb;r jsonb;before_host jsonb;before_delivery jsonb;blocked boolean;
begin
 insert into ball_signups(cadet_name,cadet_company,cadet_gender,status,amount_due,amount_paid,cash_received,field_trip_form_required,field_trip_form_received) values('Ready Host','bravo','male','fully_verified',35,35,true,true,true) returning id into h;
 t:=ball_ops_ticket_record(h);assert (t->>'ready')::boolean and not (t->>'distributed')::boolean;
 before_host:=(select to_jsonb(x) from ball_signups x where id=h);
 blocked:=false;begin perform ball_ops_receive_tickets('unauthorized@example.invalid',h,t->>'version');exception when others then blocked:=true;end;assert blocked,'Unauthorized write';
 r:=ball_ops_receive_tickets('ticket-chief@example.invalid',h,t->>'version');
 assert (r->'ticket'->>'distributed')::boolean;
 assert (select to_jsonb(x)=before_host from ball_signups x where id=h),'Receiving tickets altered requirements';
 before_delivery:=(select to_jsonb(x) from ball_ticket_deliveries x where signup_id=h);
 r:=ball_ops_receive_tickets('ticket-chief@example.invalid',h,t->>'version');
 assert (r->>'already_received')::boolean;
 assert (select to_jsonb(x)=before_delivery from ball_ticket_deliveries x where signup_id=h),'Retry overwrote original receipt';
 insert into ball_signups(cadet_name,cadet_company,cadet_gender,status,amount_due,amount_paid,cash_received,field_trip_form_required,field_trip_form_received) values('Incomplete Bravo','bravo','female','guest_pending',35,0,false,true,false) returning id into incomplete;
 t:=ball_ops_ticket_record(incomplete);blocked:=false;
 begin perform ball_ops_receive_tickets('ticket-chief@example.invalid',incomplete,t->>'version');exception when others then blocked:=true;end;assert blocked,'Incomplete normal reservation received tickets';
 insert into ball_ticket_historical_receipts(signup_id,host_company,batch_id,note) values(incomplete,'alpha',gen_random_uuid(),'Invalid scope fixture');
 blocked:=false;begin insert into ball_ticket_deliveries(signup_id,recipient_type,recipient_name,recipient_company,distributed,distributed_at,distributed_by) values(incomplete,'host','Incomplete Bravo','bravo',true,now(),'fixture');exception when others then blocked:=true;end;assert blocked,'Alpha exception was applied to Bravo';
 insert into ball_signups(cadet_name,cadet_company,cadet_gender,status,amount_due,amount_paid,cash_received,field_trip_form_required,field_trip_form_received) values('Historical Alpha','alpha','female','guest_pending',50,0,false,true,false) returning id into historical;
 insert into ball_guests(signup_id,name,guest_type,gender,verified_at,field_trip_form_required,field_trip_form_received) values(historical,'Male Date','date','male',null,true,false) returning id into guest_id;
 before_host:=(select to_jsonb(x) from ball_signups x where id=historical);
 insert into ball_ticket_historical_receipts(signup_id,host_company,guest_id_at_recording,batch_id,note) values(historical,'alpha',guest_id,gen_random_uuid(),'Previously handed out, per host company');
 insert into ball_ticket_deliveries(signup_id,recipient_type,recipient_guest_id,recipient_name,recipient_company,distributed,distributed_at,distributed_by) values(historical,'guest',guest_id,'Male Date','alpha',true,now(),'fixture historical report');
 t:=ball_ops_ticket_record(historical);
 assert (t->>'distributed')::boolean and not (t->>'ready')::boolean and (t->>'historical')::boolean;
 assert (select to_jsonb(x)=before_host from ball_signups x where id=historical),'Historical correction completed requirements';
 assert (select verified_at is null and not field_trip_form_received from ball_guests where id=guest_id),'Guest was falsely verified';
 -- The exception cannot be reused for a changed companion.
 delete from ball_ticket_deliveries where signup_id=historical;
 delete from ball_guests where id=guest_id;
 insert into ball_guests(signup_id,name,guest_type,gender,verified_at,field_trip_form_required,field_trip_form_received) values(historical,'Replacement Date','date','male',null,true,false) returning id into guest_id;
 blocked:=false;begin insert into ball_ticket_deliveries(signup_id,recipient_type,recipient_guest_id,recipient_name,recipient_company,distributed,distributed_at,distributed_by) values(historical,'guest',guest_id,'Replacement Date','alpha',true,now(),'fixture');exception when others then blocked:=true;end;assert blocked,'Exception leaked to replacement guest';
 -- A new Alpha reservation is not automatically received, even if it is ready.
 insert into ball_signups(cadet_name,cadet_company,cadet_gender,status,amount_due,amount_paid,cash_received,field_trip_form_required,field_trip_form_received) values('Future Alpha','alpha','male','fully_verified',35,35,true,true,true) returning id into h;
 assert not (ball_ops_ticket_record(h)->>'distributed')::boolean,'Future Alpha automatically received tickets';
 t:=ball_ops_ticket_record(h);update ball_signups set field_trip_form_received=false where id=h;
 blocked:=false;begin perform ball_ops_receive_tickets('ticket-chief@example.invalid',h,t->>'version');exception when others then blocked:=true;end;assert blocked,'Stale confirmation accepted';
 assert not has_function_privilege('authenticated','public.ball_ops_receive_tickets(text,uuid,text)','execute'),'Browser could impersonate reviewer';
 assert not has_table_privilege('authenticated','public.ball_ticket_historical_receipts','insert'),'Browser could create an eligibility exception';
 raise notice 'Chief ticket checks passed: readiness, receipt replay, history, company scope, guest changes, future reservations, stale state and authorization.';
end $$;
rollback;
