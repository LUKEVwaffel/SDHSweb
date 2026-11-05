-- Disposable DB only, after ball-live-schema.sql + ball-new-guest-schema.sql.
alter table ball_signups add column if not exists cadet_phone text,add column if not exists cadet_allergies text;
alter table ball_guests add column if not exists allergies text,add column if not exists guest_phone text, add column if not exists dress_code_accepted_at timestamptz;
alter table ball_config add column if not exists ball_date date, add column if not exists event_time_text text, add column if not exists venue_address text, add column if not exists field_trip_form_pdf_url text;
create table if not exists email_reviewers(email text primary key,active boolean,can_ball_ops boolean,must_change_password boolean);
create or replace function public.is_ball_ops_reviewer() returns boolean language sql stable as $$
 select exists(select 1 from email_reviewers where email=current_setting('test.email',true) and active and can_ball_ops and not must_change_password)
$$;
create view ball_signups_ops_view as select id,cadet_name,cadet_let_level,cadet_company,status,cash_received,field_trip_form_received,field_trip_form_required,amount_due,amount_paid from ball_signups;
create view ball_guests_ops_view as select id,signup_id,name,age,guest_type,is_sdhs_jrotc,school_attended,friend_payment_method,friend_amount_due,friend_cash_received,field_trip_form_received,field_trip_form_required from ball_guests;
