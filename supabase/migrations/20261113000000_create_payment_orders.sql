create table if not exists public.payment_orders (
  reference text primary key check (reference ~ '^KT[A-Z0-9]{13}$'),
  amount_kz integer not null check (amount_kz > 0),
  currency text not null default 'AOA' check (currency = 'AOA'),
  course_slug text not null,
  product_title text not null,
  variant_id text not null,
  variant_label text not null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'expired', 'canceled', 'refunded')),
  payment_provider text not null default 'wipay',
  payment_method text,
  provider_status text,
  provider_transaction_id text,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists payment_orders_created_at_idx
  on public.payment_orders (created_at desc);
create index if not exists payment_orders_status_created_at_idx
  on public.payment_orders (status, created_at desc);
create index if not exists payment_orders_product_created_at_idx
  on public.payment_orders (course_slug, created_at desc);

alter table public.payment_orders enable row level security;
revoke all on public.payment_orders from anon, authenticated;
grant all on public.payment_orders to service_role;

create or replace function public.set_payment_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payment_orders_updated_at on public.payment_orders;
create trigger payment_orders_updated_at
  before update on public.payment_orders
  for each row execute function public.set_payment_orders_updated_at();

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
        count(*) filter (where status = 'accepted')::numeric * 100 /
        nullif(count(*) filter (where status in ('accepted', 'rejected', 'expired', 'canceled')), 0),
        1
      ),
      0
    ),
    coalesce(round(avg(amount_kz) filter (where status = 'accepted'), 0), 0)
  from public.payment_orders;
$$;

revoke all on function public.backoffice_payment_summary() from public, anon, authenticated;
grant execute on function public.backoffice_payment_summary() to service_role;
