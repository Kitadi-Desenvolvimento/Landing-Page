alter table public.objectives
  alter column area_id drop not null,
  add column scope_type text not null default 'department',
  add column assigned_to uuid references auth.users(id) on delete set null,
  add column period_type text,
  add column period_start date,
  add column aligned_objective_id uuid references public.objectives(id) on delete set null;

alter table public.objectives
  add constraint objectives_scope_type_check
    check (scope_type in ('company', 'department', 'collaborator')),
  add constraint objectives_scope_assignment_check
    check (
      (scope_type = 'company' and area_id is null and assigned_to is null) or
      (scope_type = 'department' and area_id is not null and assigned_to is null) or
      (scope_type = 'collaborator' and assigned_to is not null)
    ),
  add constraint objectives_period_type_check
    check (period_type is null or period_type in ('annual', 'monthly', 'weekly', 'daily')),
  add constraint objectives_period_dates_check
    check ((period_type is null and period_start is null) or
      (period_type is not null and period_start is not null)),
  add constraint objectives_not_aligned_to_self_check
    check (aligned_objective_id is null or aligned_objective_id <> id);

create index if not exists objectives_scope_period_idx
  on public.objectives (scope_type, period_type, period_start, active, archived);
create index if not exists objectives_assigned_to_idx
  on public.objectives (assigned_to, active, archived)
  where assigned_to is not null;
create index if not exists objectives_aligned_objective_idx
  on public.objectives (aligned_objective_id)
  where aligned_objective_id is not null;

create table if not exists public.objective_activity_history (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid references public.objectives(id) on delete set null,
  objective_title text not null,
  event_type text not null check (event_type in ('created', 'updated', 'archived', 'restored')),
  scope_type text not null,
  area_id uuid references public.objective_areas(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  period_type text,
  period_start date,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists objective_activity_history_created_idx
  on public.objective_activity_history (created_at desc);
create index if not exists objective_activity_history_actor_idx
  on public.objective_activity_history (actor_id, created_at desc);
create index if not exists objective_activity_history_area_idx
  on public.objective_activity_history (area_id, created_at desc);

alter table public.objective_activity_history enable row level security;
revoke all on public.objective_activity_history from public, anon, authenticated;
grant all on public.objective_activity_history to service_role;

create or replace function public.record_objective_activity_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  actor_email text;
  activity_type text;
begin
  actor_id := case when tg_op = 'INSERT' then new.created_by else new.updated_by end;

  if tg_op = 'INSERT' then
    activity_type := 'created';
  elsif old.archived is distinct from new.archived then
    activity_type := case when new.archived then 'archived' else 'restored' end;
  else
    activity_type := 'updated';
  end if;

  select coalesce(email, '') into actor_email
  from auth.users
  where id = actor_id;

  insert into public.objective_activity_history (
    objective_id, objective_title, event_type, scope_type, area_id,
    assigned_to, period_type, period_start, actor_id, actor_email
  ) values (
    new.id, new.title, activity_type, new.scope_type, new.area_id,
    new.assigned_to, new.period_type, new.period_start, actor_id,
    coalesce(actor_email, '')
  );
  return new;
end;
$$;

revoke all on function public.record_objective_activity_history()
  from public, anon, authenticated;

drop trigger if exists objectives_record_activity on public.objectives;
create trigger objectives_record_activity
  after insert or update on public.objectives
  for each row execute function public.record_objective_activity_history();
