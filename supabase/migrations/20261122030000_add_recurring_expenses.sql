-- Despesas fixas: modelos mensais que geram despesas normais (expenses).
-- Cada modelo gera no máximo uma despesa por mês. Um mês só fecha com todas as
-- fixas aplicáveis lançadas (uma despesa anulada conta como tratada).

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null
    check (category in ('trainers', 'venue', 'marketing', 'platforms', 'commissions', 'other')),
  supplier text not null check (char_length(supplier) between 1 and 120),
  description text not null check (char_length(description) between 1 and 300),
  amount_kz integer not null check (amount_kz > 0),
  day_of_month smallint not null check (day_of_month between 1 and 31),
  start_month date not null check (start_month = date_trunc('month', start_month)::date),
  end_month date check (
    end_month is null
    or (end_month = date_trunc('month', end_month)::date and end_month >= start_month)
  ),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recurring_expenses enable row level security;
revoke all on public.recurring_expenses from anon, authenticated;
grant all on public.recurring_expenses to service_role;

create or replace function public.set_recurring_expenses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recurring_expenses_updated_at on public.recurring_expenses;
create trigger recurring_expenses_updated_at
  before update on public.recurring_expenses
  for each row execute function public.set_recurring_expenses_updated_at();

alter table public.expenses
  add column if not exists recurring_expense_id uuid references public.recurring_expenses(id) on delete restrict,
  add column if not exists fixed_month date;

create unique index if not exists expenses_recurring_month_idx
  on public.expenses (recurring_expense_id, fixed_month);

create or replace function public.backoffice_launch_recurring_expenses(
  p_month date,
  p_user uuid,
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_today date := (now() at time zone 'Africa/Luanda')::date;
  v_item jsonb;
  v_rec public.recurring_expenses;
  v_amount integer;
  v_last integer;
  v_day date;
  v_count integer := 0;
begin
  if v_month > date_trunc('month', v_today)::date then
    raise exception 'period_not_started';
  end if;

  perform pg_advisory_xact_lock(hashtext('finance_period_closures'));

  v_last := extract(day from (v_month + interval '1 month' - interval '1 day'))::integer;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_rec
    from public.recurring_expenses r
    where r.id = (v_item->>'id')::uuid
      and r.start_month <= v_month
      and (r.end_month is null or r.end_month >= v_month);
    continue when not found;

    v_amount := (v_item->>'amount_kz')::integer;
    if v_amount is null or v_amount <= 0 then
      raise exception 'invalid_amount';
    end if;

    -- A data nunca é futura: no mês em curso, um dia ainda por chegar usa hoje.
    v_day := least(v_month + (least(v_rec.day_of_month, v_last) - 1), v_today);

    insert into public.expenses (
      spent_on, category, supplier, description, amount_kz,
      created_by, recurring_expense_id, fixed_month
    ) values (
      v_day, v_rec.category, v_rec.supplier, v_rec.description, v_amount,
      p_user, v_rec.id, v_month
    )
    on conflict (recurring_expense_id, fixed_month) do nothing;

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.backoffice_launch_recurring_expenses(date, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.backoffice_launch_recurring_expenses(date, uuid, jsonb) to service_role;

-- O resumo passa a indicar as fixas por lançar; muda o tipo de retorno.
drop function if exists public.backoffice_period_summaries(integer);
drop function if exists public.backoffice_period_summary(date);

create function public.backoffice_period_summary(p_month date)
returns table (
  month date,
  entries_kz bigint,
  entries_count bigint,
  refunds_kz bigint,
  refunds_count bigint,
  withdrawals_kz bigint,
  withdrawals_count bigint,
  expenses_kz bigint,
  expenses_count bigint,
  unreconciled_entries_count bigint,
  unreconciled_withdrawals_count bigint,
  pending_fixed_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.month,
    (select coalesce(sum(o.amount_kz), 0) from public.payment_orders o
      where o.status in ('accepted', 'refunded')
        and public.finance_month_of(coalesce(o.paid_at, o.created_at)) = m.month)::bigint,
    (select count(*) from public.payment_orders o
      where o.status in ('accepted', 'refunded')
        and public.finance_month_of(coalesce(o.paid_at, o.created_at)) = m.month)::bigint,
    (select coalesce(sum(o.amount_kz), 0) from public.payment_orders o
      where o.status = 'refunded'
        and public.finance_month_of(coalesce(o.refunded_at, o.updated_at)) = m.month)::bigint,
    (select count(*) from public.payment_orders o
      where o.status = 'refunded'
        and public.finance_month_of(coalesce(o.refunded_at, o.updated_at)) = m.month)::bigint,
    (select coalesce(sum(w.amount_kz), 0) from public.wipay_withdrawals w
      where w.status = 'active' and public.finance_month_of(w.withdrawn_at) = m.month)::bigint,
    (select count(*) from public.wipay_withdrawals w
      where w.status = 'active' and public.finance_month_of(w.withdrawn_at) = m.month)::bigint,
    (select coalesce(sum(e.amount_kz), 0) from public.expenses e
      where e.status = 'active' and date_trunc('month', e.spent_on)::date = m.month)::bigint,
    (select count(*) from public.expenses e
      where e.status = 'active' and date_trunc('month', e.spent_on)::date = m.month)::bigint,
    (select count(*) from public.payment_orders o
      where o.status = 'accepted' and o.reconciled_at is null
        and public.finance_month_of(coalesce(o.paid_at, o.created_at)) = m.month)::bigint,
    (select count(*) from public.wipay_withdrawals w
      where w.status = 'active' and w.reconciled_at is null
        and public.finance_month_of(w.withdrawn_at) = m.month)::bigint,
    (select count(*) from public.recurring_expenses r
      where r.start_month <= m.month
        and (r.end_month is null or r.end_month >= m.month)
        and not exists (
          select 1 from public.expenses e
          where e.recurring_expense_id = r.id and e.fixed_month = m.month
        ))::bigint
  from (select date_trunc('month', p_month)::date as month) m;
$$;

create function public.backoffice_period_summaries(p_months integer default 12)
returns table (
  month date,
  entries_kz bigint,
  entries_count bigint,
  refunds_kz bigint,
  refunds_count bigint,
  withdrawals_kz bigint,
  withdrawals_count bigint,
  expenses_kz bigint,
  expenses_count bigint,
  unreconciled_entries_count bigint,
  unreconciled_withdrawals_count bigint,
  pending_fixed_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select s.*
  from generate_series(
    public.finance_month_of(now()) - make_interval(months => least(greatest(p_months, 1), 36) - 1),
    public.finance_month_of(now()),
    interval '1 month'
  ) g(month)
  cross join lateral public.backoffice_period_summary(g.month::date) s
  order by s.month desc;
$$;

revoke all on function public.backoffice_period_summary(date) from public, anon, authenticated;
revoke all on function public.backoffice_period_summaries(integer) from public, anon, authenticated;
grant execute on function public.backoffice_period_summary(date) to service_role;
grant execute on function public.backoffice_period_summaries(integer) to service_role;

create or replace function public.backoffice_close_period(p_month date, p_user uuid)
returns public.period_closures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_summary record;
  v_row public.period_closures;
begin
  perform pg_advisory_xact_lock(hashtext('finance_period_closures'));

  if v_month >= public.finance_month_of(now()) then
    raise exception 'period_not_ended';
  end if;
  if public.finance_period_is_closed(v_month) then
    raise exception 'period_already_closed';
  end if;

  select * into v_summary from public.backoffice_period_summary(v_month);
  if v_summary.unreconciled_entries_count + v_summary.unreconciled_withdrawals_count > 0 then
    raise exception 'period_has_unreconciled';
  end if;
  if v_summary.pending_fixed_count > 0 then
    raise exception 'period_has_pending_fixed';
  end if;

  insert into public.period_closures (
    month, action, user_id, entries_kz, refunds_kz, withdrawals_kz, expenses_kz, result_kz
  ) values (
    v_month, 'closed', p_user,
    v_summary.entries_kz, v_summary.refunds_kz, v_summary.withdrawals_kz, v_summary.expenses_kz,
    v_summary.entries_kz - v_summary.refunds_kz - v_summary.expenses_kz
  ) returning * into v_row;
  return v_row;
end;
$$;
