-- A data escolhida no formulário não muda o mês da conta.
-- A acção entra no mês em que foi registada no backoffice.
-- Uma confirmação posterior (pagamento WiPay) entra nesse momento, se for mais tarde.

create or replace function public.finance_action_at(p_created timestamptz, p_chosen timestamptz)
returns timestamptz
language sql
immutable
as $$
  select case
    when p_chosen is not null and p_created is not null and p_chosen > p_created then p_chosen
    else coalesce(p_created, p_chosen)
  end;
$$;

create or replace function public.backoffice_period_summary(p_month date)
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
        and public.finance_month_of(public.finance_action_at(o.created_at, o.paid_at)) = m.month)::bigint,
    (select count(*) from public.payment_orders o
      where o.status in ('accepted', 'refunded')
        and public.finance_month_of(public.finance_action_at(o.created_at, o.paid_at)) = m.month)::bigint,
    (select coalesce(sum(o.amount_kz), 0) from public.payment_orders o
      where o.status = 'refunded'
        and public.finance_month_of(coalesce(o.refunded_at, o.updated_at)) = m.month)::bigint,
    (select count(*) from public.payment_orders o
      where o.status = 'refunded'
        and public.finance_month_of(coalesce(o.refunded_at, o.updated_at)) = m.month)::bigint,
    (select coalesce(sum(w.amount_kz), 0) from public.wipay_withdrawals w
      where w.status = 'active'
        and public.finance_month_of(public.finance_action_at(w.created_at, w.withdrawn_at)) = m.month)::bigint,
    (select count(*) from public.wipay_withdrawals w
      where w.status = 'active'
        and public.finance_month_of(public.finance_action_at(w.created_at, w.withdrawn_at)) = m.month)::bigint,
    (select coalesce(sum(e.amount_kz), 0) from public.expenses e
      where e.status = 'active' and public.finance_month_of(e.created_at) = m.month)::bigint,
    (select count(*) from public.expenses e
      where e.status = 'active' and public.finance_month_of(e.created_at) = m.month)::bigint,
    (select count(*) from public.payment_orders o
      where o.status = 'accepted' and o.reconciled_at is null
        and public.finance_month_of(public.finance_action_at(o.created_at, o.paid_at)) = m.month)::bigint,
    (select count(*) from public.wipay_withdrawals w
      where w.status = 'active' and w.reconciled_at is null
        and public.finance_month_of(public.finance_action_at(w.created_at, w.withdrawn_at)) = m.month)::bigint,
    (select count(*) from public.recurring_expenses r
      where r.start_month <= m.month
        and (r.end_month is null or r.end_month >= m.month)
        and not exists (
          select 1 from public.expenses e
          where e.recurring_expense_id = r.id and e.fixed_month = m.month
        ))::bigint
  from (select date_trunc('month', p_month)::date as month) m;
$$;

create or replace function public.guard_closed_period_payment()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.payment_provider = 'manual'
      and public.finance_period_is_closed(public.finance_month_of(coalesce(new.created_at, now()))) then
      raise exception 'period_closed';
    end if;
  elsif new.reconciled_at is distinct from old.reconciled_at
    and public.finance_period_is_closed(public.finance_month_of(public.finance_action_at(old.created_at, old.paid_at))) then
    raise exception 'period_closed';
  end if;
  return new;
end;
$$;

create or replace function public.guard_closed_period_withdrawal()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if public.finance_period_is_closed(public.finance_month_of(coalesce(new.created_at, now()))) then
      raise exception 'period_closed';
    end if;
  elsif (new.reconciled_at is distinct from old.reconciled_at or new.status is distinct from old.status)
    and public.finance_period_is_closed(public.finance_month_of(public.finance_action_at(old.created_at, old.withdrawn_at))) then
    raise exception 'period_closed';
  end if;
  return new;
end;
$$;

create or replace function public.guard_closed_period_expense()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if public.finance_period_is_closed(public.finance_month_of(coalesce(new.created_at, now()))) then
      raise exception 'period_closed';
    end if;
  elsif new.status is distinct from old.status
    and public.finance_period_is_closed(public.finance_month_of(old.created_at)) then
    raise exception 'period_closed';
  end if;
  return new;
end;
$$;
