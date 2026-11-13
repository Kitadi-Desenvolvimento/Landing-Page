create table if not exists public.objective_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

insert into public.objective_areas (name, slug)
values ('Geral', 'geral')
on conflict (slug) do nothing;

alter table public.objectives
  add column if not exists area_id uuid references public.objective_areas(id) on delete restrict;

update public.objectives
set area_id = (select id from public.objective_areas where slug = 'geral')
where area_id is null;

alter table public.objectives
  alter column area_id set not null;

create table if not exists public.objective_area_members (
  area_id uuid not null references public.objective_areas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (area_id, user_id)
);

create index if not exists objective_area_members_user_idx
  on public.objective_area_members (user_id, area_id);
create index if not exists objectives_area_active_idx
  on public.objectives (area_id, active, title);

alter table public.objective_checkins
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by_email text not null default '';

create table if not exists public.objective_checkin_edits (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.objective_checkins(id) on delete cascade,
  previous_value jsonb not null,
  previous_note text not null default '',
  edited_by uuid references auth.users(id) on delete set null,
  edited_by_email text not null default '',
  edited_at timestamptz not null default now()
);

create index if not exists objective_checkin_edits_history_idx
  on public.objective_checkin_edits (checkin_id, edited_at desc);

alter table public.objective_areas enable row level security;
alter table public.objective_area_members enable row level security;
alter table public.objective_checkin_edits enable row level security;
revoke all on public.objective_areas, public.objective_area_members, public.objective_checkin_edits
  from anon, authenticated;
grant all on public.objective_areas, public.objective_area_members, public.objective_checkin_edits
  to service_role;

create or replace function public.update_objective_checkin(
  p_checkin_id uuid,
  p_value jsonb,
  p_note text,
  p_editor_id uuid,
  p_editor_email text
)
returns public.objective_checkins
language plpgsql
security definer
set search_path = public
as $$
declare
  previous public.objective_checkins;
  updated public.objective_checkins;
begin
  select * into previous
  from public.objective_checkins
  where id = p_checkin_id
  for update;

  if not found then
    return null;
  end if;

  insert into public.objective_checkin_edits (
    checkin_id,
    previous_value,
    previous_note,
    edited_by,
    edited_by_email
  )
  values (
    previous.id,
    previous.value,
    previous.note,
    p_editor_id,
    coalesce(p_editor_email, '')
  );

  update public.objective_checkins
  set value = p_value,
      note = p_note,
      updated_at = now(),
      updated_by = p_editor_id,
      updated_by_email = coalesce(p_editor_email, '')
  where id = p_checkin_id
  returning * into updated;

  return updated;
end;
$$;

revoke all on function public.update_objective_checkin(uuid, jsonb, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.update_objective_checkin(uuid, jsonb, text, uuid, text)
  to service_role;

create or replace function public.replace_objective_area_memberships(
  p_user_id uuid,
  p_area_ids uuid[],
  p_assigned_by uuid,
  p_scope_ids uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_scope_ids is null then
    delete from public.objective_area_members where user_id = p_user_id;
  else
    delete from public.objective_area_members
    where user_id = p_user_id and area_id = any(p_scope_ids);
  end if;

  insert into public.objective_area_members (area_id, user_id, assigned_by)
  select distinct area_id, p_user_id, p_assigned_by
  from unnest(coalesce(p_area_ids, '{}'::uuid[])) as desired(area_id);
end;
$$;

revoke all on function public.replace_objective_area_memberships(uuid, uuid[], uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.replace_objective_area_memberships(uuid, uuid[], uuid, uuid[])
  to service_role;

create or replace function public.set_objective_areas_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists objective_areas_updated_at on public.objective_areas;
create trigger objective_areas_updated_at
  before update on public.objective_areas
  for each row execute function public.set_objective_areas_updated_at();
