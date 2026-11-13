alter table public.payment_orders
  add column if not exists edition text,
  add column if not exists checked_in boolean not null default false,
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by uuid references auth.users(id) on delete set null;

create index if not exists payment_orders_accepted_paid_at_idx
  on public.payment_orders (paid_at desc)
  where status = 'accepted';

create index if not exists payment_orders_edition_idx
  on public.payment_orders (edition)
  where edition is not null;
