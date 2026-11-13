alter table public.objectives
  add column if not exists due_date date,
  add column if not exists archived boolean not null default false;

create index if not exists objectives_active_deadline_idx
  on public.objectives (active, archived, due_date)
  where due_date is not null;
