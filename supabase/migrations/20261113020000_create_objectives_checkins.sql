create table if not exists public.objectives (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 160),
  description text not null default '' check (length(description) <= 2000),
  value_type text not null default 'number'
    check (value_type in ('number', 'percentage', 'currency', 'text', 'boolean', 'date', 'custom')),
  target_value jsonb,
  unit text not null default '' check (length(unit) <= 40),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.objective_checkins (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null references public.objectives(id) on delete cascade,
  checkin_date date not null,
  value jsonb not null,
  note text not null default '' check (length(note) <= 1000),
  checked_in_by uuid references auth.users(id) on delete set null,
  checked_in_by_email text not null default '',
  created_at timestamptz not null default now(),
  unique (objective_id, checkin_date)
);

create index if not exists objectives_active_title_idx
  on public.objectives (active, title);
create index if not exists objective_checkins_history_idx
  on public.objective_checkins (objective_id, checkin_date desc, created_at desc);

alter table public.objectives enable row level security;
alter table public.objective_checkins enable row level security;
revoke all on public.objectives, public.objective_checkins from anon, authenticated;
grant all on public.objectives, public.objective_checkins to service_role;

create or replace function public.set_objectives_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists objectives_updated_at on public.objectives;
create trigger objectives_updated_at
  before update on public.objectives
  for each row execute function public.set_objectives_updated_at();
