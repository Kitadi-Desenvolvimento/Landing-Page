import "server-only";

import { createSupabaseAdminClient } from "./supabase/admin";
import { throwDatabaseError } from "./payments/orders";
import type { ExpenseCategory } from "./expense-categories";

export type Expense = {
  id: string;
  spentOn: string;
  category: ExpenseCategory;
  supplier: string;
  description: string;
  amountKz: number;
  proofReference: string | null;
  status: "active" | "voided";
  voidReason: string | null;
  recurringExpenseId: string | null;
  createdAt: string;
};

export type RecurringExpense = {
  id: string;
  category: ExpenseCategory;
  supplier: string;
  description: string;
  amountKz: number;
  dayOfMonth: number;
  startMonth: string;
  endMonth: string | null;
  createdAt: string;
};

export type PeriodClosure = {
  id: number;
  month: string;
  action: "closed" | "reopened";
  reason: string | null;
  createdAt: string;
  entriesKz: number | null;
  refundsKz: number | null;
  withdrawalsKz: number | null;
  expensesKz: number | null;
  resultKz: number | null;
};

export type PeriodSummary = {
  month: string;
  entriesKz: number;
  entriesCount: number;
  refundsKz: number;
  refundsCount: number;
  withdrawalsKz: number;
  withdrawalsCount: number;
  expensesKz: number;
  expensesCount: number;
  unreconciledEntriesCount: number;
  unreconciledWithdrawalsCount: number;
  pendingFixedCount: number;
  checkoutEntriesKz: number | null;
  manualEntriesKz: number | null;
  resultKz: number;
  /** Fecho em vigor; nesse caso os valores acima são os registados no fecho. */
  closure: PeriodClosure | null;
};

export type FinanceData = {
  periods: PeriodSummary[];
  history: PeriodClosure[];
  expenses: Expense[];
  recurring: RecurringExpense[];
  /** Pares "id|AAAA-MM" de despesas fixas já lançadas (incluindo anuladas). */
  launched: string[];
};

export class PeriodRuleError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "PeriodRuleError";
  }
}

const periodRuleCodes = [
  "period_not_ended",
  "period_already_closed",
  "period_has_unreconciled",
  "period_not_closed",
  "period_has_pending_fixed",
  "period_not_started",
  "invalid_end_month",
];

export function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Intervalo [início, fim) de um mês AAAA-MM na hora de Luanda. */
export function monthRange(month: string) {
  const [year, number] = month.split("-").map(Number);
  const next = number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, "0")}`;
  return {
    from: new Date(`${month}-01T00:00:00+01:00`).toISOString(),
    to: new Date(`${next}-01T00:00:00+01:00`).toISOString(),
    fromDate: `${month}-01`,
    toDate: `${next}-01`,
  };
}

function expenseFromDatabase(row: Record<string, unknown>): Expense {
  return {
    id: row.id as string,
    spentOn: row.spent_on as string,
    category: row.category as ExpenseCategory,
    supplier: row.supplier as string,
    description: row.description as string,
    amountKz: row.amount_kz as number,
    proofReference: typeof row.proof_reference === "string" ? row.proof_reference : null,
    status: row.status as Expense["status"],
    voidReason: typeof row.void_reason === "string" ? row.void_reason : null,
    recurringExpenseId: typeof row.recurring_expense_id === "string" ? row.recurring_expense_id : null,
    createdAt: row.created_at as string,
  };
}

function recurringFromDatabase(row: Record<string, unknown>): RecurringExpense {
  return {
    id: row.id as string,
    category: row.category as ExpenseCategory,
    supplier: row.supplier as string,
    description: row.description as string,
    amountKz: row.amount_kz as number,
    dayOfMonth: Number(row.day_of_month),
    startMonth: String(row.start_month).slice(0, 7),
    endMonth: typeof row.end_month === "string" ? row.end_month.slice(0, 7) : null,
    createdAt: row.created_at as string,
  };
}

function closureFromDatabase(row: Record<string, unknown>): PeriodClosure {
  const kz = (value: unknown) => (value === null || value === undefined ? null : Number(value));
  return {
    id: Number(row.id),
    month: String(row.month).slice(0, 7),
    action: row.action as PeriodClosure["action"],
    reason: typeof row.reason === "string" ? row.reason : null,
    createdAt: row.created_at as string,
    entriesKz: kz(row.entries_kz),
    refundsKz: kz(row.refunds_kz),
    withdrawalsKz: kz(row.withdrawals_kz),
    expensesKz: kz(row.expenses_kz),
    resultKz: kz(row.result_kz),
  };
}

export async function listExpenses(limit = 200) {
  const { data, error } = await createSupabaseAdminClient()
    .from("expenses")
    .select("*")
    .order("spent_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throwDatabaseError("listing expenses", error);
  return (data ?? []).map((row) => expenseFromDatabase(row));
}

export async function createExpense(input: {
  spentOn: string;
  category: ExpenseCategory;
  supplier: string;
  description: string;
  amountKz: number;
  proofReference: string | null;
  createdBy: string;
}) {
  const { data, error } = await createSupabaseAdminClient()
    .from("expenses")
    .insert({
      spent_on: input.spentOn,
      category: input.category,
      supplier: input.supplier,
      description: input.description,
      amount_kz: input.amountKz,
      proof_reference: input.proofReference,
      created_by: input.createdBy,
    })
    .select("*")
    .single();

  if (error) throwDatabaseError("creating expense", error);
  return expenseFromDatabase(data as Record<string, unknown>);
}

export async function voidExpense(id: string, reason: string, userId: string) {
  const { data, error } = await createSupabaseAdminClient()
    .from("expenses")
    .update({
      status: "voided",
      void_reason: reason,
      voided_at: new Date().toISOString(),
      voided_by: userId,
    })
    .eq("id", id)
    .eq("status", "active")
    .select("*")
    .maybeSingle();

  if (error) throwDatabaseError("voiding expense", error);
  return data ? expenseFromDatabase(data) : null;
}

export async function getFinanceData(months = 12): Promise<FinanceData> {
  const client = createSupabaseAdminClient();
  const [summaries, closures, expenses, recurring, launches] = await Promise.all([
    client.rpc("backoffice_period_summaries", { p_months: months }),
    client.from("period_closures").select("*").order("id", { ascending: false }).limit(200),
    listExpenses(),
    client.from("recurring_expenses").select("*").order("created_at", { ascending: true }),
    client
      .from("expenses")
      .select("recurring_expense_id, fixed_month")
      .not("fixed_month", "is", null)
      .limit(5000),
  ]);

  if (summaries.error) throwDatabaseError("loading period summaries", summaries.error);
  if (closures.error) throwDatabaseError("loading period closures", closures.error);
  if (recurring.error) throwDatabaseError("loading recurring expenses", recurring.error);
  if (launches.error) throwDatabaseError("loading recurring launches", launches.error);

  const history = (closures.data ?? []).map((row) => closureFromDatabase(row));
  const current = new Map<string, PeriodClosure>();
  const seen = new Set<string>();
  for (const event of history) {
    if (seen.has(event.month)) continue;
    seen.add(event.month);
    if (event.action === "closed") current.set(event.month, event);
  }

  const periods = ((summaries.data ?? []) as Record<string, unknown>[]).map((row) => {
    const month = String(row.month).slice(0, 7);
    const closure = current.get(month) ?? null;
    const live = {
      entriesKz: Number(row.entries_kz),
      refundsKz: Number(row.refunds_kz),
      withdrawalsKz: Number(row.withdrawals_kz),
      expensesKz: Number(row.expenses_kz),
    };
    const shown = closure
      ? {
          entriesKz: closure.entriesKz ?? 0,
          refundsKz: closure.refundsKz ?? 0,
          withdrawalsKz: closure.withdrawalsKz ?? 0,
          expensesKz: closure.expensesKz ?? 0,
        }
      : live;
    return {
      month,
      ...shown,
      entriesCount: Number(row.entries_count),
      refundsCount: Number(row.refunds_count),
      withdrawalsCount: Number(row.withdrawals_count),
      expensesCount: Number(row.expenses_count),
      unreconciledEntriesCount: Number(row.unreconciled_entries_count),
      unreconciledWithdrawalsCount: Number(row.unreconciled_withdrawals_count),
      pendingFixedCount: Number(row.pending_fixed_count),
      checkoutEntriesKz: row.checkout_entries_kz == null ? null : Number(row.checkout_entries_kz),
      manualEntriesKz: row.manual_entries_kz == null ? null : Number(row.manual_entries_kz),
      resultKz: shown.entriesKz - shown.refundsKz - shown.expensesKz,
      closure,
    } satisfies PeriodSummary;
  });

  return {
    periods,
    history: history.slice(0, 30),
    expenses,
    recurring: (recurring.data ?? []).map((row) => recurringFromDatabase(row)),
    launched: (launches.data ?? []).map(
      (row) => `${row.recurring_expense_id}|${String(row.fixed_month).slice(0, 7)}`,
    ),
  };
}

async function runPeriodRule(
  operation: string,
  fn: string,
  args: Record<string, unknown>,
) {
  const { error } = await createSupabaseAdminClient().rpc(fn, args);
  if (!error) return;
  if (periodRuleCodes.includes(error.message)) throw new PeriodRuleError(error.message);
  throwDatabaseError(operation, error);
}

export function closePeriod(month: string, userId: string) {
  return runPeriodRule("closing period", "backoffice_close_period", {
    p_month: `${month}-01`,
    p_user: userId,
  });
}

export function reopenPeriod(month: string, reason: string, userId: string) {
  return runPeriodRule("reopening period", "backoffice_reopen_period", {
    p_month: `${month}-01`,
    p_user: userId,
    p_reason: reason,
  });
}

export async function createRecurringExpense(input: {
  category: ExpenseCategory;
  supplier: string;
  description: string;
  amountKz: number;
  dayOfMonth: number;
  startMonth: string;
  createdBy: string;
}) {
  const { data, error } = await createSupabaseAdminClient()
    .from("recurring_expenses")
    .insert({
      category: input.category,
      supplier: input.supplier,
      description: input.description,
      amount_kz: input.amountKz,
      day_of_month: input.dayOfMonth,
      start_month: `${input.startMonth}-01`,
      created_by: input.createdBy,
    })
    .select("*")
    .single();

  if (error) throwDatabaseError("creating recurring expense", error);
  return recurringFromDatabase(data as Record<string, unknown>);
}

/** `endMonth` null reactiva o modelo; um valor termina-o nesse mês (inclusive). */
export async function updateRecurringExpense(
  id: string,
  patch: { amountKz: number } | { endMonth: string | null },
) {
  const update =
    "amountKz" in patch
      ? { amount_kz: patch.amountKz }
      : { end_month: patch.endMonth ? `${patch.endMonth}-01` : null };
  const { data, error } = await createSupabaseAdminClient()
    .from("recurring_expenses")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23514") throw new PeriodRuleError("invalid_end_month");
    throwDatabaseError("updating recurring expense", error);
  }
  return data ? recurringFromDatabase(data) : null;
}

export async function launchRecurringExpenses(
  month: string,
  items: { id: string; amountKz: number }[],
  userId: string,
) {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "backoffice_launch_recurring_expenses",
    {
      p_month: `${month}-01`,
      p_user: userId,
      p_items: items.map((item) => ({ id: item.id, amount_kz: item.amountKz })),
    },
  );
  if (error) {
    if (periodRuleCodes.includes(error.message)) throw new PeriodRuleError(error.message);
    throwDatabaseError("launching recurring expenses", error);
  }
  return Number(data);
}
