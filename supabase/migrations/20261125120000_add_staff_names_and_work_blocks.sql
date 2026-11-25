create table if not exists public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_blocks (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('objective', 'opportunity')),
  subject_id uuid not null,
  reason text not null check (length(btrim(reason)) between 1 and 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references auth.users(id) on delete set null
);

create unique index if not exists work_blocks_open_subject_idx
  on public.work_blocks (subject_type, subject_id)
  where lifted_at is null;

create index if not exists work_blocks_open_created_idx
  on public.work_blocks (created_at desc)
  where lifted_at is null;

create table if not exists public.work_block_people (
  block_id uuid not null references public.work_blocks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (block_id, user_id)
);

alter table public.staff_profiles enable row level security;
alter table public.work_blocks enable row level security;
alter table public.work_block_people enable row level security;

revoke all on public.staff_profiles, public.work_blocks, public.work_block_people
  from anon, authenticated;
grant all on public.staff_profiles, public.work_blocks, public.work_block_people
  to service_role;
