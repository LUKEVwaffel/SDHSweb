-- Align live door admission with ticket checks. No people, credentials or decisions are changed.
begin;
create or replace function public.ball_door_people()
returns table(person_kind text,person_id uuid,name text,company text,companion text,group_key text,
 issues text[],form_required boolean,form_received boolean,payment_complete boolean,
 attire_status text,verification_complete boolean,attire_by text,student_status_unknown boolean)
language sql stable security definer set search_path=public as $$
 with base as (
 select 'cadet'::text kind,s.id,s.cadet_name name,s.cadet_company company,g.name companion,'reservation:'||s.id group_key,
 (s.standalone_guest is distinct from true or s.field_trip_form_required is distinct from false) needs_form,
 s.field_trip_form_received got_form,
 (s.amount_due is not null and s.amount_due>=0 and s.amount_due::text not in ('NaN','Infinity','-Infinity') and coalesce(s.amount_paid,0)::text not in ('NaN','Infinity','-Infinity') and coalesce(s.amount_paid,case when s.cash_received then s.amount_due else 0 end)>=s.amount_due) paid,
 s.dress_approved attire,
 coalesce(s.cadet_gender='male' and s.standalone_guest is distinct from true,false) uniform,
 (s.status='fully_verified') verified,false school_unknown
 from public.ball_signups s left join public.ball_guests g on g.signup_id=s.id
 union all
 select 'guest',g.id,g.name,s.cadet_company,s.cadet_name,'reservation:'||s.id,
 (g.is_sdhs_jrotc is true or g.sdhs_matched_cadet_id is not null or g.field_trip_form_required is distinct from false or coalesce(g.school_attended ~* '(soddy[[:space:]-]*daisy|\msdhs\M)',false)),
 g.field_trip_form_received,
 case when g.guest_type='friend' then (g.friend_amount_due is not null and g.friend_amount_due>=0 and g.friend_amount_due::text not in ('NaN','Infinity','-Infinity') and (g.friend_amount_due=0 or coalesce(g.friend_cash_received,false) or (coalesce(g.friend_payment_method='host_delivers',false) and coalesce(s.cash_received,false))))
 else (s.amount_due is not null and s.amount_due>=0 and s.amount_due::text not in ('NaN','Infinity','-Infinity') and coalesce(s.amount_paid,0)::text not in ('NaN','Infinity','-Infinity') and coalesce(s.amount_paid,case when s.cash_received then s.amount_due else 0 end)>=s.amount_due) end,
 g.dress_approved,false,(g.verified_at is not null),
 (g.is_sdhs_jrotc is distinct from true and g.sdhs_matched_cadet_id is null and g.field_trip_form_required is false and nullif(trim(g.school_attended),'') is null)
 from public.ball_guests g join public.ball_signups s on s.id=g.signup_id
 union all
 -- Invited VIP tickets are complimentary; SDHS attendees still need forms.
 select 'vip',v.id,v.name,'VIP',d.name,'vip:'||v.id,
 vs.sdhs_student is true,false,true,v.dress_approved,false,true,vs.sdhs_student is null
 from public.ball_vip_signups v left join public.ball_vip_dates d on d.vip_signup_id=v.id
 left join public.ball_door_students vs on vs.person_kind='vip' and vs.person_id=v.id
 union all
 select 'vip_date',d.id,d.name,'VIP guest',v.name,'vip:'||v.id,
 ds.sdhs_student is true,false,true,d.dress_approved,false,true,ds.sdhs_student is null
 from public.ball_vip_dates d join public.ball_vip_signups v on v.id=d.vip_signup_id
 left join public.ball_door_students ds on ds.person_kind='vip_date' and ds.person_id=d.id
 ), facts as (
 select b.*, (coalesce(b.got_form,false) or f.person_id is not null) form_in,
 case when a.approved=true then 'approved' when a.approved=false then 'denied'
 when b.uniform then 'uniform'
 when b.attire=true then 'approved' when b.attire=false then 'denied'
 else 'pending' end attire_state,
 case a.approver_key when 'aubry' then 'Aubry Gillott' when 'kylie' then 'Kylie Gray' end approved_by
 from base b left join public.ball_door_attire a on a.person_kind=b.kind and a.person_id=b.id
 left join public.ball_door_forms f on f.person_kind=b.kind and f.person_id=b.id
 )
 select kind,id,name,company,companion,group_key,array_remove(array[
 case when school_unknown then 'Confirm whether this person currently attends SDHS before entry.' end,
 case when not coalesce(verified,false) then 'Registration verification incomplete' end,
 case when needs_form and not form_in then 'Signed permission form missing. Parent must attend and sign before entry.' end,
 case when not coalesce(paid,false) then 'Unpaid ticket. Do not admit. Cash is not accepted at the door.' end,
 case when attire_state='denied' then 'Attire denied. Do not admit.' when attire_state='pending' then 'Attire approval needed' end
 ],null)::text[],needs_form,form_in,coalesce(paid,false),attire_state,coalesce(verified,false),approved_by,school_unknown
 from facts
$$;
revoke all on function public.ball_door_people() from public,anon,authenticated;

commit;
