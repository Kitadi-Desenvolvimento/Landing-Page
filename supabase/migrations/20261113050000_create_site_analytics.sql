create table if not exists public.site_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null
    check (event_type in ('page_view', 'contact_click', 'checkout_start')),
  session_id uuid not null,
  page_path text not null check (char_length(page_path) between 1 and 200),
  product_slug text,
  channel text check (channel in ('whatsapp', 'email', 'phone')),
  created_at timestamptz not null default now(),
  check (
    (event_type = 'contact_click' and channel is not null)
    or (event_type <> 'contact_click' and channel is null)
  )
);

create index if not exists site_analytics_events_created_at_idx
  on public.site_analytics_events (created_at desc);
create index if not exists site_analytics_events_product_created_at_idx
  on public.site_analytics_events (product_slug, created_at desc)
  where product_slug is not null;
create index if not exists site_analytics_events_session_created_at_idx
  on public.site_analytics_events (session_id, created_at desc);

alter table public.site_analytics_events enable row level security;
revoke all on public.site_analytics_events from anon, authenticated;
grant all on public.site_analytics_events to service_role;

alter table public.payment_orders
  add column if not exists analytics_session_id uuid;

create index if not exists payment_orders_analytics_session_paid_at_idx
  on public.payment_orders (analytics_session_id, paid_at desc)
  where analytics_session_id is not null;

create or replace function public.backoffice_site_analytics(p_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with recent_events as (
    select event_type, session_id, product_slug, channel
    from public.site_analytics_events
    where created_at >= p_since
      and created_at <= now()
  ),
  product_stats as (
    select
      product_slug,
      count(*) filter (where event_type = 'page_view' and product_slug is not null)::bigint as views,
      count(*) filter (where event_type = 'contact_click')::bigint as contact_clicks
    from recent_events
    where product_slug is not null
    group by product_slug
  ),
  contact_channels as (
    select channel, count(*)::bigint as clicks
    from recent_events
    where event_type = 'contact_click'
    group by channel
  ),
  accepted_orders as (
    select po.reference, po.analytics_session_id
    from public.payment_orders as po
    where po.status = 'accepted'
      and po.paid_at >= p_since
      and po.paid_at <= now()
      and po.analytics_session_id is not null
      and exists (
        select 1
        from recent_events
        where event_type = 'checkout_start'
          and session_id = po.analytics_session_id
          and product_slug = po.course_slug
      )
  )
  select jsonb_build_object(
    'visitors', (
      select count(distinct session_id)::bigint
      from recent_events
      where event_type = 'page_view'
    ),
    'productVisitors', (
      select count(distinct session_id)::bigint
      from recent_events
      where event_type = 'page_view' and product_slug is not null
    ),
    'productViews', (
      select count(*)::bigint
      from recent_events
      where event_type = 'page_view' and product_slug is not null
    ),
    'contactVisitors', (
      select count(distinct session_id)::bigint
      from recent_events
      where event_type = 'contact_click'
    ),
    'contactClicks', (
      select count(*)::bigint
      from recent_events
      where event_type = 'contact_click'
    ),
    'checkoutVisitors', (
      select count(distinct session_id)::bigint
      from recent_events
      where event_type = 'checkout_start'
    ),
    'checkoutStarts', (
      select count(*)::bigint
      from recent_events
      where event_type = 'checkout_start'
    ),
    'attributedPaidVisitors', (
      select count(distinct analytics_session_id)::bigint
      from accepted_orders
    ),
    'attributedPaidOrders', (
      select count(*)::bigint
      from accepted_orders
    ),
    'contactsByChannel', coalesce(
      (select jsonb_object_agg(channel, clicks) from contact_channels),
      '{}'::jsonb
    ),
    'products', coalesce(
      (
        select jsonb_object_agg(
          product_slug,
          jsonb_build_object('views', views, 'contactClicks', contact_clicks)
        )
        from product_stats
      ),
      '{}'::jsonb
    )
  );
$$;

revoke all on function public.backoffice_site_analytics(timestamptz)
  from public, anon, authenticated;
grant execute on function public.backoffice_site_analytics(timestamptz)
  to service_role;
