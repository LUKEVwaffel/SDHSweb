begin;
set test.admin='true';set test.role='service_role';
do $$
declare h uuid;g uuid;c uuid;person record;
begin
 insert into ball_signups(cadet_name,cadet_company,cadet_gender,status,amount_due,amount_paid,cash_received,standalone_guest,field_trip_form_required,field_trip_form_received,dress_approved) values('Test Host','Alpha','male','fully_verified',35,35,true,false,true,true,false) returning id into h;
 insert into ball_guests(signup_id,name,gender,guest_type,verified_at,is_sdhs_jrotc,school_attended,field_trip_form_required,field_trip_form_received,dress_approved,friend_amount_due,friend_cash_received,friend_payment_method) values(h,'Test Friend','female','friend',now(),false,null,false,false,true,35,false,null) returning id into g;
 select * into person from ball_door_people() where person_id=g;
 assert not person.payment_complete,'Unknown friend payment method admitted unpaid guest';
 assert person.student_status_unknown,'Missing school identity was assumed outside SDHS';
 select * into person from ball_door_people() where person_id=h;
 assert person.attire_status='uniform','Standard uniform incorrectly needs individual approval';
 insert into ball_door_attire(person_kind,person_id,approved,approver_key) values('cadet',h,false,'aubry');
 select * into person from ball_door_people() where person_id=h;
 assert person.attire_status='denied','On-site denial did not override uniform';
 insert into cadet_consent(name,gender) values('Test Friend','female') returning id into c;
 update ball_guests set sdhs_matched_cadet_id=c,friend_cash_received=true where id=g;
 select * into person from ball_door_people() where person_id=g;
 assert person.form_required and not person.form_received,'Matched SDHS guest bypassed required form';
 update ball_signups set amount_due='NaN'::numeric where id=h;
 select * into person from ball_door_people() where person_id=h;
 assert not person.payment_complete,'Non-finite price was treated as paid';
 raise notice 'Door payment, form, school identity and denial checks passed.';
end $$;
rollback;
