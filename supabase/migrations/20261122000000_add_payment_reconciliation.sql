-- Conciliação com a WiPay: entradas (payment_orders, incluindo pagamentos
-- manuais) e levantamentos registados aqui para espelhar a plataforma WiPay.

alter table public.payment_orders
  add column if not exists reconciled_at timestamptz,
  add column if not exists reconciled_by uuid references auth.users(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create table if not exists public.wipay_withdrawals (
  id uuid primary key default gen_random_uuid(),
  amount_kz integer not null check (amount_kz > 0),
  withdrawn_at timestamptz not null,
  provider_reference text not null check (char_length(provider_reference) between 1 and 80),
  status text not null default 'active' check (status in ('active', 'voided')),
  void_reason text,
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  reconciled_at timestamptz,
  reconciled_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'voided' or void_reason is not null)
);

create unique index if not exists wipay_withdrawals_active_reference_idx
  on public.wipay_withdrawals (lower(provider_reference))
  where status = 'active';
create index if not exists wipay_withdrawals_withdrawn_at_idx
  on public.wipay_withdrawals (withdrawn_at desc);

alter table public.wipay_withdrawals enable row level security;
revoke all on public.wipay_withdrawals from anon, authenticated;
grant all on public.wipay_withdrawals to service_role;

create or replace function public.set_wipay_withdrawals_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wipay_withdrawals_updated_at on public.wipay_withdrawals;
create trigger wipay_withdrawals_updated_at
  before update on public.wipay_withdrawals
  for each row execute function public.set_wipay_withdrawals_updated_at();

-- A taxa de sucesso mede só os checkouts WiPay; pagamentos manuais entram
-- sempre como aceites e distorceriam o indicador.
create or replace function public.backoffice_payment_summary()
returns table (
  total_count bigint,
  accepted_count bigint,
  pending_count bigint,
  failed_count bigint,
  refunded_count bigint,
  accepted_amount_kz bigint,
  pending_amount_kz bigint,
  refunded_amount_kz bigint,
  success_rate numeric,
  average_ticket_kz numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::bigint,
    count(*) filter (where status = 'accepted')::bigint,
    count(*) filter (where status = 'pending')::bigint,
    count(*) filter (where status in ('rejected', 'expired', 'canceled'))::bigint,
    count(*) filter (where status = 'refunded')::bigint,
    coalesce(sum(amount_kz) filter (where status = 'accepted'), 0)::bigint,
    coalesce(sum(amount_kz) filter (where status = 'pending'), 0)::bigint,
    coalesce(sum(amount_kz) filter (where status = 'refunded'), 0)::bigint,
    coalesce(
      round(
        count(*) filter (where status = 'accepted' and payment_provider <> 'manual')::numeric * 100 /
        nullif(
          count(*) filter (
            where payment_provider <> 'manual'
              and status in ('accepted', 'rejected', 'expired', 'canceled')
          ),
          0
        ),
        1
      ),
      0
    ),
    coalesce(round(avg(amount_kz) filter (where status = 'accepted'), 0), 0)
  from public.payment_orders;
$$;

revoke all on function public.backoffice_payment_summary() from public, anon, authenticated;
grant execute on function public.backoffice_payment_summary() to service_role;

create or replace function public.backoffice_cash_summary()
returns table (
  entries_kz bigint,
  entries_count bigint,
  manual_entries_kz bigint,
  manual_entries_count bigint,
  reconciled_entries_kz bigint,
  unreconciled_entries_count bigint,
  withdrawals_kz bigint,
  withdrawals_count bigint,
  reconciled_withdrawals_kz bigint,
  unreconciled_withdrawals_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(o.amount_kz), 0)::bigint,
    count(o.*)::bigint,
    coalesce(sum(o.amount_kz) filter (where o.payment_provider = 'manual'), 0)::bigint,
    count(o.*) filter (where o.payment_provider = 'manual')::bigint,
    coalesce(sum(o.amount_kz) filter (where o.reconciled_at is not null), 0)::bigint,
    count(o.*) filter (where o.reconciled_at is null)::bigint,
    (select coalesce(sum(w.amount_kz), 0) from public.wipay_withdrawals w where w.status = 'active')::bigint,
    (select count(*) from public.wipay_withdrawals w where w.status = 'active')::bigint,
    (select coalesce(sum(w.amount_kz), 0) from public.wipay_withdrawals w
      where w.status = 'active' and w.reconciled_at is not null)::bigint,
    (select count(*) from public.wipay_withdrawals w
      where w.status = 'active' and w.reconciled_at is null)::bigint
  from public.payment_orders o
  where o.status = 'accepted';
$$;

revoke all on function public.backoffice_cash_summary() from public, anon, authenticated;
grant execute on function public.backoffice_cash_summary() to service_role;
