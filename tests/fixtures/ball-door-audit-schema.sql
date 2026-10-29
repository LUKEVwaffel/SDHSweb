create table if not exists public.ball_door_attire(person_kind text,person_id uuid,approved boolean,approver_key text,primary key(person_kind,person_id));
create table if not exists public.ball_door_forms(person_kind text,person_id uuid,primary key(person_kind,person_id));
create table if not exists public.ball_door_students(person_kind text,person_id uuid,sdhs_student boolean,primary key(person_kind,person_id));
create table if not exists public.ball_vip_signups(id uuid primary key default gen_random_uuid(),name text,dress_approved boolean);
create table if not exists public.ball_vip_dates(id uuid primary key default gen_random_uuid(),vip_signup_id uuid,name text,dress_approved boolean);
