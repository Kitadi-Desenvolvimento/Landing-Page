alter table public.payment_orders
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_provider_message_id text;

create index if not exists payment_orders_email_sent_at_idx
  on public.payment_orders (email_sent_at)
  where email_sent_at is not null;
