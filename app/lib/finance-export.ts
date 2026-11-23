import "server-only";

import { createSupabaseAdminClient } from "./supabase/admin";
import { expenseCategoryLabel } from "./expense-categories";
import { monthRange } from "./finance";
import { throwDatabaseError } from "./payments/orders";

export const exportTypes = ["entries", "withdrawals", "expenses", "reconciliation"] as const;
export type ExportType = (typeof exportTypes)[number];

type Cell = string | number | null;

const rowLimit = 5000;

function luandaDateTime(value: unknown) {
  if (typeof value !== "string") return "";
  return new Date(value).toLocaleString("sv-SE", { timeZone: "Africa/Luanda" });
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

/** Valores de texto que começariam por = + - @ seriam lidos como fórmulas no Excel. */
function csvCell(cell: Cell) {
  if (cell === null) return "";
  if (typeof cell === "number") return String(cell);
  const safe = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
  return /[;"\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function toCsv(header: string[], rows: Cell[][]) {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(";"));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

async function loadEntries(month: string) {
  const range = monthRange(month);
  const { data, error } = await createSupabaseAdminClient()
    .from("payment_orders")
    .select("*")
    .in("status", ["accepted", "refunded"])
    .or(
      `and(paid_at.gte.${range.from},paid_at.lt.${range.to}),` +
        `and(paid_at.is.null,created_at.gte.${range.from},created_at.lt.${range.to})`,
    )
    .order("paid_at", { ascending: true })
    .limit(rowLimit);
  if (error) throwDatabaseError("exporting entries", error);
  return (data ?? []) as Record<string, unknown>[];
}

async function loadWithdrawals(month: string) {
  const range = monthRange(month);
  const { data, error } = await createSupabaseAdminClient()
    .from("wipay_withdrawals")
    .select("*")
    .gte("withdrawn_at", range.from)
    .lt("withdrawn_at", range.to)
    .order("withdrawn_at", { ascending: true })
    .limit(rowLimit);
  if (error) throwDatabaseError("exporting withdrawals", error);
  return (data ?? []) as Record<string, unknown>[];
}

async function loadExpenses(month: string) {
  const range = monthRange(month);
  const { data, error } = await createSupabaseAdminClient()
    .from("expenses")
    .select("*")
    .gte("spent_on", range.fromDate)
    .lt("spent_on", range.toDate)
    .order("spent_on", { ascending: true })
    .limit(rowLimit);
  if (error) throwDatabaseError("exporting expenses", error);
  return (data ?? []) as Record<string, unknown>[];
}

function entryState(row: Record<string, unknown>) {
  if (row.status === "refunded") return "Estornado";
  return row.reconciled_at ? "Conciliado" : "Por conciliar";
}

export async function buildExport(type: ExportType, month: string) {
  if (type === "entries") {
    const rows = await loadEntries(month);
    return toCsv(
      ["Data de pagamento", "Referência", "Origem", "Método", "Produto", "Variante", "Cliente", "Email", "Telefone", "Valor (Kz)", "Estado", "Conciliado em", "Estornado em", "Motivo do estorno"],
      rows.map((row) => [
        luandaDateTime(row.paid_at ?? row.created_at),
        text(row.reference),
        row.payment_provider === "manual" ? "Manual" : "WiPay",
        text(row.payment_method),
        text(row.product_title),
        text(row.variant_label),
        text(row.customer_name),
        text(row.customer_email),
        text(row.customer_phone),
        row.amount_kz as number,
        entryState(row),
        luandaDateTime(row.reconciled_at),
        luandaDateTime(row.refunded_at),
        row.status === "refunded" ? text(row.reason) : "",
      ]),
    );
  }

  if (type === "withdrawals") {
    const rows = await loadWithdrawals(month);
    return toCsv(
      ["Data", "Referência WiPay", "Valor (Kz)", "Estado", "Conciliado em", "Motivo da anulação"],
      rows.map((row) => [
        luandaDateTime(row.withdrawn_at),
        text(row.provider_reference),
        row.amount_kz as number,
        row.status === "voided" ? "Anulado" : row.reconciled_at ? "Conciliado" : "Por conciliar",
        luandaDateTime(row.reconciled_at),
        text(row.void_reason),
      ]),
    );
  }

  if (type === "expenses") {
    const rows = await loadExpenses(month);
    return toCsv(
      ["Data", "Categoria", "Fornecedor", "Descrição", "Valor (Kz)", "Comprovativo", "Origem", "Estado", "Motivo da anulação"],
      rows.map((row) => [
        text(row.spent_on),
        expenseCategoryLabel(text(row.category)),
        text(row.supplier),
        text(row.description),
        row.amount_kz as number,
        text(row.proof_reference),
        row.recurring_expense_id ? "Fixa" : "Avulsa",
        row.status === "voided" ? "Anulada" : "Activa",
        text(row.void_reason),
      ]),
    );
  }

  const [entries, withdrawals] = await Promise.all([loadEntries(month), loadWithdrawals(month)]);
  const movements: { at: string; row: Cell[] }[] = [
    ...entries.map((row) => ({
      at: String(row.paid_at ?? row.created_at),
      row: [
        "Entrada",
        luandaDateTime(row.paid_at ?? row.created_at),
        text(row.reference),
        text(row.product_title),
        row.amount_kz as number,
        entryState(row),
        luandaDateTime(row.reconciled_at),
      ] as Cell[],
    })),
    ...withdrawals
      .filter((row) => row.status === "active")
      .map((row) => ({
        at: String(row.withdrawn_at),
        row: [
          "Levantamento",
          luandaDateTime(row.withdrawn_at),
          text(row.provider_reference),
          "Levantamento WiPay",
          -(row.amount_kz as number),
          row.reconciled_at ? "Conciliado" : "Por conciliar",
          luandaDateTime(row.reconciled_at),
        ] as Cell[],
      })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return toCsv(
    ["Tipo", "Data", "Referência", "Descrição", "Valor (Kz)", "Estado", "Conciliado em"],
    movements.map((movement) => movement.row),
  );
}
