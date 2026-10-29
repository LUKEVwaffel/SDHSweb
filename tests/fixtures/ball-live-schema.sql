create schema auth;
create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$;
create function auth.jwt() returns jsonb language sql stable as $$select '{"email":"test@example.invalid"}'::jsonb$$;
create function public.is_s6() returns boolean language sql stable as $$select current_setting('test.admin',true)='true'$$;
create table public.ball_signups(id uuid primary key default gen_random_uuid(),cadet_name text,cadet_company text,cadet_let_level text,cadet_gender text,status text,amount_due numeric,amount_paid numeric,cash_received boolean,standalone_guest boolean,field_trip_form_required boolean,field_trip_form_received boolean,dress_approved boolean);
create table public.ball_guests(id uuid primary key default gen_random_uuid(),signup_id uuid unique references ball_signups, name text,gender text,guest_type text,verified_at timestamptz,is_sdhs_jrotc boolean,sdhs_matched_cadet_id uuid,school_attended text,field_trip_form_required boolean,field_trip_form_received boolean,dress_approved boolean,friend_amount_due numeric,friend_cash_received boolean,friend_payment_method text);
create table public.cadet_consent(id uuid primary key default gen_random_uuid(),name text,company text,let_level text,gender text);
