-- O total de entradas continua a juntar checkout e registo manual.
-- Conciliar, o saldo conferido e o fecho do mês olham só para a WiPay.
-- Um pagamento manual não existe na carteira e não fica por conciliar.

drop function if exists public.backoffice_payment_summary();

create function public.backoffice_payment_summary()
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
  average_ticket_kz numeric,
  checkout_accepted_kz bigint,
  manual_accepted_kz bigint
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
    coalesce(round(avg(amount_kz) filter (where status = 'accepted'), 0), 0),
    coalesce(sum(amount_kz) filter (where status = 'accepted' and payment_provider is distinct from 'manual'), 0)::bigint,
    coalesce(sum(amount_kz) filter (where status = 'accepted' and payment_provider = 'manual'), 0)::bigint
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
    coalesce(sum(o.amount_kz) filter (
      where o.payment_provider is distinct from 'manual' and o.reconciled_at is not null
    ), 0)::bigint,
    count(o.*) filter (
      where o.payment_provider is distinct from 'manual' and o.reconciled_at is null
    )::bigint,
    (select coalesce(sum(w.amount_kz), 0) from public.wipay_withdrawals w where w.status = 'active')::bigint,
    (select count(*) from public.wipay_withdrawals w where w.status = 'active')::bigint,
    (select coalesce(sum(w.amount_kz), 0) from public.wipay_withdrawals w
      where w.status = 'active' and w.reconciled_at is not null)::bigint,
    (select count(*) from public.wipay_withdrawals w
      where w.status = 'active' and w.reconciled_at is null)::bigint
  from public.payment_orders o
  where o.status = 'accepted';
$$;

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
  pending_fixed_count bigint,
  checkout_entries_kz bigint,
  manual_entries_kz bigint
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
      where o.status = 'accepted'
        and o.payment_provider is distinct from 'manual'
        and o.reconciled_at is null
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
        ))::bigint,
    (select coalesce(sum(o.amount_kz), 0) from public.payment_orders o
      where o.status in ('accepted', 'refunded')
        and o.payment_provider is distinct from 'manual'
        and public.finance_month_of(public.finance_action_at(o.created_at, o.paid_at)) = m.month)::bigint,
    (select coalesce(sum(o.amount_kz), 0) from public.payment_orders o
      where o.status in ('accepted', 'refunded')
        and o.payment_provider = 'manual'
        and public.finance_month_of(public.finance_action_at(o.created_at, o.paid_at)) = m.month)::bigint
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
  pending_fixed_count bigint,
  checkout_entries_kz bigint,
  manual_entries_kz bigint
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
