-- Disposable fixture database only. Never run against production.
begin;
set test.role='service_role';
set test.email='chief@example.invalid';
insert into email_reviewers(email,active,can_ball_ops,must_change_password) values('chief@example.invalid',true,true,false);
insert into ball_config(id,price_cadet,price_couple) values(true,35,50);
insert into cadet_consent(id,name,company,let_level,school_email) values('11111111-1111-1111-1111-111111111111','Test Cadet','alpha','2','cadet@example.invalid');
do $$
declare result jsonb; removed jsonb; current_packet jsonb; failed boolean:=false; request jsonb;
begin
 request:='{"request_id":"22222222-2222-2222-2222-222222222222","cadet_id":"11111111-1111-1111-1111-111111111111","guest_type":"date","gender":"male","guest_name":"Paper Guest","guest_gender":"female","amount_paid":50,"host_form":true,"guest_complete":true,"guest_form":true}';
 result:=ball_ops_reservation('chief@example.invalid','create',request);
 assert result->'signup'->>'status'='fully_verified';
 assert not (result->'signup' ? 'cadet_allergies'),'Ops packet exposed host medical details';
 assert not (result->'guest' ? 'allergies'),'Ops packet exposed guest medical details';
 assert (select verified_at is not null from ball_guests_ops_view where id=(result->'guest'->>'id')::uuid),'Guest verification was missing from Ops view';
 perform set_config('test.email','intruder@example.invalid',true);
 assert not exists(select 1 from ball_signups_ops_view),'Ops view exposed reservations to another account';
 perform set_config('test.email','chief@example.invalid',true);
 assert (result->'signup'->>'amount_paid')::numeric=50;
 assert result->'guest'->>'personal_email'='';
 assert length(result->'guest'->>'verification_token')=64;
 assert (result->'guest'->>'verified_at') is not null;
 assert ball_ops_reservation('chief@example.invalid','create',request)->'signup'->>'id'=result->'signup'->>'id','Retry duplicated signup';
 assert (select count(*)=1 from ball_ops_audit where action='create'),'Retry duplicated audit';
 begin perform ball_ops_reservation('chief@example.invalid','create',request||'{"request_id":"33333333-3333-3333-3333-333333333333"}'); exception when others then failed:=true; end;
 assert failed,'Duplicate accepted'; failed:=false;
 begin perform ball_ops_reservation('intruder@example.invalid','packet',jsonb_build_object('signup_id',result->'signup'->>'id')); exception when others then failed:=true; end;
 assert failed,'Unauthorized actor accepted'; failed:=false;
 begin perform ball_ops_reservation('chief@example.invalid','remove_guest',jsonb_build_object('signup_id',result->'signup'->>'id','guest_id',result->'guest'->>'id','expected_version',result->>'version','expected_solo_price',35,'expected_total',50,'expected_paid',0)); exception when others then failed:=true; end;
 assert failed,'Stale payment accepted';failed:=false;
 update ball_guests set name='Changed Guest' where id=(result->'guest'->>'id')::uuid;
 begin perform ball_ops_reservation('chief@example.invalid','remove_guest',jsonb_build_object('signup_id',result->'signup'->>'id','guest_id',result->'guest'->>'id','expected_version',result->>'version','expected_solo_price',35,'expected_total',50,'expected_paid',50)); exception when others then failed:=true; end;
 assert failed,'Stale guest accepted';failed:=false;
 current_packet:=ball_ops_reservation('chief@example.invalid','packet',jsonb_build_object('signup_id',result->'signup'->>'id'));
 begin perform ball_ops_reservation('chief@example.invalid','remove_guest',jsonb_build_object('signup_id',result->'signup'->>'id','guest_id',result->'guest'->>'id','expected_version',current_packet->>'version','expected_solo_price',30,'expected_total',50,'expected_paid',50)); exception when others then failed:=true; end;
 assert failed,'Stale price accepted';
 removed:=ball_ops_reservation('chief@example.invalid','remove_guest',jsonb_build_object('signup_id',result->'signup'->>'id','guest_id',result->'guest'->>'id','expected_version',current_packet->>'version','expected_solo_price',35,'expected_total',50,'expected_paid',50));
 assert (removed->'signup'->>'amount_due')::numeric=35;
 assert (removed->'signup'->>'amount_paid')::numeric=50,'Payment lost';
 assert (select count(*)=1 from ball_ops_audit where action='remove_guest');
 assert not exists(select 1 from ball_guests where signup_id=(result->'signup'->>'id')::uuid);
 delete from ball_signups where id=(result->'signup'->>'id')::uuid;
 -- Pending friend with no email can finish on paper, independently of attire.
 request:='{"request_id":"44444444-4444-4444-4444-444444444444","cadet_id":"11111111-1111-1111-1111-111111111111","guest_type":"friend","gender":"female","guest_name":"Friend","guest_gender":"male","amount_paid":20,"guest_paid":true}';
 result:=ball_ops_reservation('chief@example.invalid','create',request);
 assert result->'signup'->>'status'='guest_pending';
 assert (result->'guest'->>'friend_cash_received')::boolean;
 failed:=false;
 begin perform ball_ops_reservation('chief@example.invalid','complete_guest',jsonb_build_object('signup_id',result->'signup'->>'id','guest_id',result->'guest'->>'id','expected_version',result->>'version')); exception when others then failed:=true; end;
 assert failed,'Paper confirmation was not required';
 result:=ball_ops_reservation('chief@example.invalid','complete_guest',jsonb_build_object('signup_id',result->'signup'->>'id','guest_id',result->'guest'->>'id','expected_version',result->>'version','paper_acknowledged',true));
 assert result->'signup'->>'status'='fully_verified';
 assert result->'guest'->>'dress_approved' is null,'Paper registration granted attire approval';
 removed:=ball_ops_reservation('chief@example.invalid','remove_guest',jsonb_build_object('signup_id',result->'signup'->>'id','guest_id',result->'guest'->>'id','expected_version',result->>'version','expected_total',35,'expected_paid',20));
 assert (removed->'signup'->>'amount_due')::numeric=35;
 assert (removed->'signup'->>'amount_paid')::numeric=20;
 assert exists(select 1 from ball_ops_audit where before_state->'guest'->>'name'='Friend' and (before_state->'guest'->>'friend_cash_received')::boolean);
 delete from ball_signups where id=(result->'signup'->>'id')::uuid;
 -- Invalid ledger amounts and unspecified outside-school exemptions fail before any write.
 foreach request in array array[
 '{"request_id":"55555555-5555-5555-5555-555555555555","guest_type":"none","gender":"male","amount_paid":"NaN"}'::jsonb,
 '{"request_id":"66666666-6666-6666-6666-666666666666","guest_type":"friend","gender":"male","guest_name":"Friend","guest_gender":"male","guest_form_required":false}'::jsonb
 ] loop
  failed:=false;
  begin perform ball_ops_reservation('chief@example.invalid','create',request||'{"cadet_id":"11111111-1111-1111-1111-111111111111"}'); exception when others then failed:=true; end;
  assert failed,'Invalid request accepted';
 end loop;
 assert not exists(select 1 from ball_signups),'Rejected request partially saved';
 raise notice 'Chief ops checks passed: replay, duplicates, permission, stale guest/payment/price, paper registration, payment audit, validation';
end $$;
rollback;
