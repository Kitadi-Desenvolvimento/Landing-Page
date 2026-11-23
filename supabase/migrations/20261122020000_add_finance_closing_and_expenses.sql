-- Financeiro: despesas, fecho mensal e auditoria de estornos.
-- Meses seguem a hora de Luanda. Um mês fechado fica bloqueado para novos
-- registos e conciliações até ser reaberto (com motivo, ficando registado).

alter table public.payment_orders
  add column if not exists refunded_at timestamptz,
  add column if not exists refunded_by uuid references auth.users(id) on delete set null;

update public.payment_orders
  set refunded_at = updated_at
  where status = 'refunded' and refunded_at is null;

create or replace function public.set_payment_order_refunded_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'refunded' and old.status is distinct from 'refunded' and new.refunded_at is null then
    new.refunded_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists payment_orders_refunded_at on public.payment_orders;
create trigger payment_orders_refunded_at
  before update on public.payment_orders
  for each row execute function public.set_payment_order_refunded_at();

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null,
  category text not null
    check (category in ('trainers', 'venue', 'marketing', 'platforms', 'commissions', 'other')),
  supplier text not null check (char_length(supplier) between 1 and 120),
  description text not null check (char_length(description) between 1 and 300),
  amount_kz integer not null check (amount_kz > 0),
  proof_reference text check (proof_reference is null or char_length(proof_reference) <= 80),
  status text not null default 'active' check (status in ('active', 'voided')),
  void_reason text,
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'voided' or void_reason is not null)
);

create index if not exists expenses_spent_on_idx on public.expenses (spent_on desc);

alter table public.expenses enable row level security;
revoke all on public.expenses from anon, authenticated;
grant all on public.expenses to service_role;

create or replace function public.set_expenses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists expenses_updated_at on public.expenses;
create trigger expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_expenses_updated_at();

-- Registo de fechos e reaberturas. O estado de um mês é o último evento.
create table if not exists public.period_closures (
  id bigint generated always as identity primary key,
  month date not null check (month = date_trunc('month', month)::date),
  action text not null check (action in ('closed', 'reopened')),
  reason text,
  user_id uuid references auth.users(id) on delete set null,
  entries_kz bigint,
  refunds_kz bigint,
  withdrawals_kz bigint,
  expenses_kz bigint,
  result_kz bigint,
  created_at timestamptz not null default now(),
  check (action <> 'reopened' or reason is not null)
);

create index if not exists period_closures_month_idx on public.period_closures (month, id desc);

alter table public.period_closures enable row level security;
revoke all on public.period_closures from anon, authenticated;
grant all on public.period_closures to service_role;

create or replace function public.finance_month_of(p_instant timestamptz)
returns date
language sql
stable
as $$
  select date_trunc('month', p_instant at time zone 'Africa/Luanda')::date;
$$;

create or replace function public.finance_period_is_closed(p_month date)
returns boolean
language sql
stable
as $$
  select coalesce(
    (select c.action = 'closed' from public.period_closures c where c.month = p_month order by c.id desc limit 1),
    false
  );
$$;

-- Bloqueios: só mexem em registos feitos no backoffice. Webhooks da WiPay
-- (pagamentos e estornos reais) nunca são recusados.
create or replace function public.guard_closed_period_payment()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.payment_provider = 'manual'
      and public.finance_period_is_closed(public.finance_month_of(coalesce(new.paid_at, new.created_at))) then
      raise exception 'period_closed';
    end if;
  elsif new.reconciled_at is distinct from old.reconciled_at
    and public.finance_period_is_closed(public.finance_month_of(coalesce(old.paid_at, old.created_at))) then
    raise exception 'period_closed';
  end if;
  return new;
end;
$$;

drop trigger if exists payment_orders_closed_period on public.payment_orders;
create trigger payment_orders_closed_period
  before insert or update on public.payment_orders
  for each row execute function public.guard_closed_period_payment();

create or replace function public.guard_closed_period_withdrawal()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if public.finance_period_is_closed(public.finance_month_of(new.withdrawn_at)) then
      raise exception 'period_closed';
    end if;
  elsif (new.reconciled_at is distinct from old.reconciled_at or new.status is distinct from old.status)
    and public.finance_period_is_closed(public.finance_month_of(old.withdrawn_at)) then
    raise exception 'period_closed';
  end if;
  return new;
end;
$$;

drop trigger if exists wipay_withdrawals_closed_period on public.wipay_withdrawals;
create trigger wipay_withdrawals_closed_period
  before insert or update on public.wipay_withdrawals
  for each row execute function public.guard_closed_period_withdrawal();

create or replace function public.guard_closed_period_expense()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if public.finance_period_is_closed(date_trunc('month', new.spent_on)::date) then
      raise exception 'period_closed';
    end if;
  elsif new.status is distinct from old.status
    and public.finance_period_is_closed(date_trunc('month', old.spent_on)::date) then
    raise exception 'period_closed';
  end if;
  return new;
end;
$$;

drop trigger if exists expenses_closed_period on public.expenses;
create trigger expenses_closed_period
  before insert or update on public.expenses
  for each row execute function public.guard_closed_period_expense();

-- Entradas: pagamentos concluídos (ou depois estornados) pela data de pagamento.
-- Estornos: pela data do estorno. Levantamentos são movimentos de caixa e não
-- entram no resultado.
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
  unreconciled_withdrawals_count bigint
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
        and public.finance_month_of(w.withdrawn_at) = m.month)::bigint
  from (select date_trunc('month', p_month)::date as month) m;
$$;

create or replace function public.backoffice_period_summaries(p_months integer default 12)
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
  unreconciled_withdrawals_count bigint
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

create or replace function public.backoffice_reopen_period(p_month date, p_user uuid, p_reason text)
returns public.period_closures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_row public.period_closures;
begin
  perform pg_advisory_xact_lock(hashtext('finance_period_closures'));

  if not public.finance_period_is_closed(v_month) then
    raise exception 'period_not_closed';
  end if;

  insert into public.period_closures (month, action, user_id, reason)
  values (v_month, 'reopened', p_user, p_reason)
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.backoffice_period_summary(date) from public, anon, authenticated;
revoke all on function public.backoffice_period_summaries(integer) from public, anon, authenticated;
revoke all on function public.backoffice_close_period(date, uuid) from public, anon, authenticated;
revoke all on function public.backoffice_reopen_period(date, uuid, text) from public, anon, authenticated;
grant execute on function public.backoffice_period_summary(date) to service_role;
grant execute on function public.backoffice_period_summaries(integer) to service_role;
grant execute on function public.backoffice_close_period(date, uuid) to service_role;
grant execute on function public.backoffice_reopen_period(date, uuid, text) to service_role;
