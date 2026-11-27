-- Cada pessoa pode tirar um aviso do sino. O aviso volta quando a situação muda
-- (novo seguimento, nova etapa, novo período ou novo número de pagamentos).

create table if not exists public.staff_notification_dismissals (
  user_id uuid not null references auth.users(id) on delete cascade,
  notice_key text not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, notice_key)
);

alter table public.staff_notification_dismissals enable row level security;
revoke all on public.staff_notification_dismissals from anon, authenticated;
grant all on public.staff_notification_dismissals to service_role;
