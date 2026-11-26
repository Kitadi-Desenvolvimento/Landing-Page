create or replace function public.latest_objective_checkins(objective_ids uuid[])
returns setof public.objective_checkins
language sql
stable
as $$
  select distinct on (objective_id) *
  from public.objective_checkins
  where objective_id = any (objective_ids)
  order by objective_id, checkin_date desc, created_at desc;
$$;

create or replace function public.objective_checkin_snapshots(objective_ids uuid[], cutoff date)
returns table (
  objective_id uuid,
  checkin_date date,
  value jsonb,
  snapshot text
)
language sql
stable
as $$
  select latest.objective_id, latest.checkin_date, latest.value, 'latest'
  from (
    select distinct on (checkins.objective_id)
      checkins.objective_id,
      checkins.checkin_date,
      checkins.value
    from public.objective_checkins as checkins
    where checkins.objective_id = any (objective_ids)
    order by checkins.objective_id, checkins.checkin_date desc, checkins.created_at desc
  ) as latest
  union all
  select older.objective_id, older.checkin_date, older.value, 'cutoff'
  from (
    select distinct on (checkins.objective_id)
      checkins.objective_id,
      checkins.checkin_date,
      checkins.value
    from public.objective_checkins as checkins
    where checkins.objective_id = any (objective_ids)
      and checkins.checkin_date <= cutoff
    order by checkins.objective_id, checkins.checkin_date desc, checkins.created_at desc
  ) as older;
$$;

revoke all on function public.latest_objective_checkins(uuid[]) from public, anon, authenticated;
grant execute on function public.latest_objective_checkins(uuid[]) to service_role;

revoke all on function public.objective_checkin_snapshots(uuid[], date) from public, anon, authenticated;
grant execute on function public.objective_checkin_snapshots(uuid[], date) to service_role;
