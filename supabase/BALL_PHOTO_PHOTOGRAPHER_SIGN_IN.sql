begin;

alter table public.ball_photo_invites add column if not exists sign_in_name text;
create unique index if not exists ball_photo_active_sign_in_name
  on public.ball_photo_invites(sign_in_name) where active and sign_in_name is not null;

commit;
