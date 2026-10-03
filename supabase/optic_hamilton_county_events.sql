-- Hamilton County Raider Championship (Central HS, 2026-10-03): MOI stations,
-- each as a MALE + COED row. Already run live 2026-10-03; safe to re-run
-- (aborts if photos are already tagged to this comp's sub-events).
begin;
-- guard: abort if any photo is already tagged to this comp's sub-events
do $$ begin
  if exists (select 1 from photos p join raider_sub_events s on s.id = p.sub_event_id
             where s.event_id = '0d6f6a10-5cac-43c9-82eb-397b05e116a9') then
    raise exception 'photos already tagged, not replacing';
  end if;
end $$;
delete from raider_sub_events where event_id = '0d6f6a10-5cac-43c9-82eb-397b05e116a9';
-- one statement per row so created_at keeps the MOI order (albums follow it)
insert into raider_sub_events (event_id, name, team, created_at)
select '0d6f6a10-5cac-43c9-82eb-397b05e116a9', n, t, now() + (o * interval '1 millisecond')
from (values
  (1,'CCR','male'),(2,'CCR','coed'),
  (3,'One Rope Bridge','male'),(4,'One Rope Bridge','coed'),
  (5,'Ridge Run','male'),(6,'Ridge Run','coed'),
  (7,'PFT','male'),(8,'PFT','coed'),
  (9,'Obstacle Course','male'),(10,'Obstacle Course','coed'),
  (11,'Hill Pounder','male'),(12,'Hill Pounder','coed')
) v(o,n,t);
commit;
select name, team from raider_sub_events where event_id = '0d6f6a10-5cac-43c9-82eb-397b05e116a9' order by created_at;
