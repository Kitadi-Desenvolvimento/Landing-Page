-- Link objectives to products (optional) and auto-record progress on purchase
alter table public.objectives
  add column product_id text references public.products(slug) on delete set null;

create index if not exists objectives_product_id_idx
  on public.objectives (product_id)
  where product_id is not null;

-- Table to track auto-generated progress from purchases
create table if not exists public.objective_progress_from_purchase (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null references public.objectives(id) on delete cascade,
  payment_reference text not null references public.payment_orders(reference) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists objective_progress_from_purchase_idx
  on public.objective_progress_from_purchase (objective_id, payment_reference);

alter table public.objective_progress_from_purchase enable row level security;
revoke all on public.objective_progress_from_purchase from anon, authenticated;
grant all on public.objective_progress_from_purchase to service_role;

-- Function to find objectives linked to a product and auto-record progress
create or replace function public.record_objective_progress_from_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_objectives record;
  checkin_date date;
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    checkin_date := (new.paid_at at time zone 'Africa/Luanda')::date;
    if checkin_date is null then
      checkin_date := now()::date;
    end if;

    -- Find objectives linked to this product and record automatic progress
    for linked_objectives in
      select o.id, o.assigned_to
      from public.objectives o
      where o.product_id = new.course_slug
        and o.active
        and o.archived = false
    loop
      begin
        insert into public.objective_checkins (objective_id, checkin_date, value, note, checked_in_by, checked_in_by_email)
        values (
          linked_objectives.id,
          checkin_date,
          '1'::jsonb,
          format('Registado automaticamente pelo sistema após compra de %s', new.product_title),
          linked_objectives.assigned_to,
          coalesce(
            (select email from auth.users where id = linked_objectives.assigned_to),
            'sistema@kitadi.local'
          )
        )
        on conflict (objective_id, checkin_date) do update
        set value = (objective_checkins.value::text::integer + 1)::text::jsonb;

        -- Track this automatic progress
        insert into public.objective_progress_from_purchase (objective_id, payment_reference)
        values (linked_objectives.id, new.reference)
        on conflict do nothing;
      exception when others then
        raise warning 'Failed to record objective progress for % from purchase %: %', linked_objectives.id, new.reference, sqlerrm;
      end;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists payment_orders_record_objective_progress on public.payment_orders;
create trigger payment_orders_record_objective_progress
  after update on public.payment_orders
  for each row
  when (new.status is distinct from old.status)
  execute function public.record_objective_progress_from_purchase();

-- View to show objectives with linked product and assigned collaborator
create or replace view public.objectives_with_collaborators as
select
  o.id,
  o.title,
  o.description,
  o.value_type,
  o.target_value,
  o.unit,
  o.active,
  o.archived,
  o.created_at,
  o.updated_at,
  o.created_by,
  o.updated_by,
  o.area_id,
  o.scope_type,
  o.assigned_to,
  o.period_type,
  o.period_start,
  o.aligned_objective_id,
  o.product_id,
  u.email as assigned_to_email
from public.objectives o
left join auth.users u on o.assigned_to = u.id;

alter view public.objectives_with_collaborators owner to postgres;

revoke all on public.objectives_with_collaborators from public, anon, authenticated;
grant select on public.objectives_with_collaborators to service_role;
