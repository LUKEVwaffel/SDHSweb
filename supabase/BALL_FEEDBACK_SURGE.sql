-- Apply after BALL_FEEDBACK.sql.
begin;

create index if not exists ball_feedback_device_created_idx
  on public.ball_feedback (submitter_fp, created_at desc)
  where submitter_fp is not null;

create or replace function public.ball_feedback_rate_limit()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.submitter_fp is null then return new; end if;
  if char_length(new.submitter_fp) > 256 then
    raise exception 'Invalid feedback device identifier.' using errcode = '22023';
  end if;

  -- Replies from different browsers remain concurrent. Serialize requests from
  -- one browser so retries and rapid taps share the same three-response limit.
  perform pg_advisory_xact_lock(hashtextextended('ball-feedback:' || new.submitter_fp, 0));
  if exists (
    select 1 from public.ball_feedback
    where id = new.id and submitter_fp = new.submitter_fp
  ) then
    return new; -- The primary key's unique response acknowledges the retry.
  end if;
  if (
    select count(*) from public.ball_feedback
    where submitter_fp = new.submitter_fp and created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'Too many submissions — try again later.';
  end if;
  return new;
end $$;

commit;
