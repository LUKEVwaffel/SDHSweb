begin;

alter table public.ball_photo_invites alter column phone_tag drop not null;

create or replace function public.ball_photo_sign_in_by_name(p_name_key text, p_session_tag text)
returns text
language plpgsql security definer set search_path=public as $$
declare account public.ball_photo_invites; checked_at timestamptz:=clock_timestamp();
begin
  select * into account from public.ball_photo_invites
    where active and sign_in_name=p_name_key for share;
  if not found then return null; end if;

  delete from public.ball_photo_sessions where expires_at<=checked_at;
  insert into public.ball_photo_sessions(token_tag,invite_id,expires_at)
    values(p_session_tag,account.id,checked_at+interval '2 days');
  return account.name;
end $$;

revoke all on function public.ball_photo_sign_in_by_name(text,text) from public,anon,authenticated;
grant execute on function public.ball_photo_sign_in_by_name(text,text) to service_role;

commit;
