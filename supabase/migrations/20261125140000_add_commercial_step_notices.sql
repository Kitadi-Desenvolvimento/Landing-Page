create table if not exists public.commercial_step_notices (
  notice_key text primary key,
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete set null,
  sent_at timestamptz not null default now()
);

create index if not exists commercial_step_notices_opportunity_idx
  on public.commercial_step_notices (opportunity_id, sent_at desc);

alter table public.commercial_step_notices enable row level security;
revoke all on public.commercial_step_notices from anon, authenticated;
grant all on public.commercial_step_notices to service_role;
