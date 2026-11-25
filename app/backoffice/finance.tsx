"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { formatKz, formatPaymentDate } from "./dashboard-data";
import { DateField } from "./date-field";
import {
  FormFooter,
  inputClass,
  ModalShell,
  ReasonModal,
  send,
  todayInLuanda,
} from "./reconciliation";
import { ScrollTable } from "./scroll-table";
import { expenseCategories, expenseCategoryLabel } from "../lib/expense-categories";
import type { Expense, FinanceData, PeriodSummary, RecurringExpense } from "../lib/finance";

const migrationFile = "20261122020000_add_finance_closing_and_expenses.sql";

const exportOptions = [
  { type: "entries", label: "Entradas" },
  { type: "withdrawals", label: "Levantamentos" },
  { type: "expenses", label: "Despesas" },
  { type: "reconciliation", label: "Relatório de conciliação" },
] as const;

function monthLabel(month: string) {
  const label = new Date(`${month}-01T12:00:00Z`).toLocaleDateString("pt-PT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function NotMigrated() {
  return (
    <div className="mt-5 rounded-2xl border border-[#e9d8b5] bg-[#fffaf0] px-4 py-3 text-[11px] leading-5 text-[#6b542d]" role="status">
      O fecho mensal e as despesas ainda não estão configurados. Aplique a migração
      <code className="mx-1 rounded bg-white px-1.5 py-0.5">{migrationFile}</code>
      no Supabase.
    </div>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "warn" }) {
  return (
    <div className="rounded-2xl border border-[#eee9e6] bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#a39995]">{label}</p>
      <p className={`mt-2 text-[20px] font-bold ${tone === "warn" ? "text-[#a43832]" : "text-[#342c2d]"}`}>{value}</p>
      <p className="mt-1 text-[10px] leading-4 text-[#968c88]">{note}</p>
    </div>
  );
}

function CloseModal({ period, onClose }: { period: PeriodSummary; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const result = await send("/api/backoffice/finance/closures", "POST", {
      month: period.month,
      action: "close",
    });
    setSaving(false);
    if (result.error) return setError(result.error);
    onClose();
    router.refresh();
  }

  return (
    <ModalShell
      description="Depois de fechado, não é possível adicionar, conciliar ou anular registos deste mês sem o reabrir."
      eyebrow="Fecho e relatórios"
      onClose={onClose}
      title={`Fechar ${monthLabel(period.month)}`}
    >
      <form className="mt-5" onSubmit={submit}>
        <dl className="grid gap-2 rounded-2xl bg-[#faf8f7] p-4 text-[11px] text-[#514849] sm:grid-cols-2">
          <div className="flex justify-between gap-3"><dt>Entradas</dt><dd className="font-semibold">{formatKz(period.entriesKz)}</dd></div>
          <div className="flex justify-between gap-3"><dt>Estornos</dt><dd className="font-semibold">{formatKz(period.refundsKz)}</dd></div>
          <div className="flex justify-between gap-3"><dt>Despesas</dt><dd className="font-semibold">{formatKz(period.expensesKz)}</dd></div>
          <div className="flex justify-between gap-3"><dt>Resultado</dt><dd className="font-bold text-[#510f1d]">{formatKz(period.resultKz)}</dd></div>
        </dl>
        <FormFooter error={error} onClose={onClose} saving={saving} submitLabel="Fechar mês" />
      </form>
    </ModalShell>
  );
}

export function FinancePanel({
  finance,
  ready,
  onGoToReconciliation,
  onGoToExpenses,
}: {
  finance: FinanceData | null;
  ready: boolean;
  onGoToReconciliation: () => void;
  onGoToExpenses: () => void;
}) {
  const router = useRouter();
  const currentMonth = todayInLuanda().slice(0, 7);
  const periods = finance?.periods ?? [];
  const [selected, setSelected] = useState(
    () => (periods.find((period) => period.month < currentMonth) ?? periods[0])?.month ?? currentMonth,
  );
  const [modal, setModal] = useState<"close" | "reopen" | null>(null);

  if (!ready || !finance) return <NotMigrated />;

  const period = periods.find((item) => item.month === selected) ?? periods[0];
  if (!period) return <NotMigrated />;

  const ended = period.month < currentMonth;
  const pending = period.unreconciledEntriesCount + period.unreconciledWithdrawalsCount;
  const pendingFixed = period.pendingFixedCount;
  const closed = Boolean(period.closure);

  return (
    <section className="mt-5 rounded-[22px] border border-[#eee9e6] bg-white p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h3 className="text-[14px] font-bold text-[#342c2d]">Fecho mensal</h3>
          <p className="mt-1 max-w-xl text-[11px] leading-5 text-[#9b918d]">
            Entradas e levantamentos pela data do movimento, estornos pela data do estorno. Um mês só fecha depois de tudo estar conciliado com a WiPay.
          </p>
        </div>
        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#a39995]">
          Mês
          <select
            className="mt-1.5 block h-11 min-w-48 rounded-xl border border-[#e7e1df] bg-white px-3 text-[12px] font-semibold normal-case tracking-normal text-[#342c2d]"
            onChange={(event) => setSelected(event.target.value)}
            value={period.month}
          >
            {periods.map((item) => (
              <option key={item.month} value={item.month}>
                {monthLabel(item.month)}{item.closure ? " · fechado" : item.month >= currentMonth ? " · em curso" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={`mt-5 flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${closed ? "border-[#cfe3d4] bg-[#f3faf5]" : "border-[#eee9e6] bg-[#faf8f7]"}`}>
        <div>
          <p className={`text-[12px] font-bold ${closed ? "text-[#2d6a3f]" : "text-[#4a4141]"}`}>
            {closed ? `✓ Mês fechado em ${formatPaymentDate(period.closure!.createdAt)}` : ended ? "Mês em aberto" : "Mês em curso"}
          </p>
          <p className="mt-1 text-[10px] leading-4 text-[#7d7370]">
            {closed
              ? "Os valores abaixo são os registados no fecho. Registos deste mês estão bloqueados."
              : !ended
                ? "Só é possível fechar depois de o mês terminar."
                : pending > 0 || pendingFixed > 0
                  ? [
                      pending > 0 ? `Faltam conciliar ${period.unreconciledEntriesCount} entradas e ${period.unreconciledWithdrawalsCount} levantamentos.` : "",
                      pendingFixed > 0 ? `Faltam lançar ${pendingFixed} despesas fixas.` : "",
                    ].filter(Boolean).join(" ")
                  : "Tudo conciliado e lançado. Pode fechar o mês."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {closed ? (
            <button className="rounded-full border border-[#e4dcd8] bg-white px-4 py-2.5 text-[11px] font-semibold text-[#a43832]" onClick={() => setModal("reopen")} type="button">Reabrir mês</button>
          ) : (
            <>
              {ended && pending > 0 ? (
                <button className="rounded-full border border-[#e4dcd8] bg-white px-4 py-2.5 text-[11px] font-semibold text-[#762838]" onClick={onGoToReconciliation} type="button">Ir para Conciliação</button>
              ) : null}
              {ended && pendingFixed > 0 ? (
                <button className="rounded-full border border-[#e4dcd8] bg-white px-4 py-2.5 text-[11px] font-semibold text-[#762838]" onClick={onGoToExpenses} type="button">Ir para Despesas</button>
              ) : null}
              <button className="rounded-full bg-[#510f1d] px-4 py-2.5 text-[11px] font-semibold text-white disabled:opacity-40" disabled={!ended || pending > 0 || pendingFixed > 0} onClick={() => setModal("close")} type="button">Fechar mês</button>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Entradas" note={`${period.entriesCount} pagamentos`} value={formatKz(period.entriesKz)} />
        <Stat label="Estornos" note={`${period.refundsCount} estornados`} value={formatKz(period.refundsKz)} />
        <Stat label="Despesas" note={`${period.expensesCount} despesas activas`} value={formatKz(period.expensesKz)} />
        <Stat label="Resultado" note="Entradas − estornos − despesas" tone={period.resultKz < 0 ? "warn" : undefined} value={formatKz(period.resultKz)} />
        <Stat label="Levantamentos" note="Movimento de caixa, não entra no resultado" value={formatKz(period.withdrawalsKz)} />
      </div>

      <h4 className="mt-6 text-[12px] font-bold text-[#342c2d]">Exportar {monthLabel(period.month)} (CSV)</h4>
      <div className="mt-2 flex flex-wrap gap-2">
        {exportOptions.map((option) => (
          <a
            className="rounded-full border border-[#e4dcd8] px-4 py-2.5 text-[11px] font-semibold text-[#762838] hover:bg-[#fcfbfa]"
            download
            href={`/api/backoffice/finance/export?type=${option.type}&month=${period.month}`}
            key={option.type}
          >
            ↓ {option.label}
          </a>
        ))}
      </div>

      <h4 className="mt-6 text-[12px] font-bold text-[#342c2d]">Histórico de fechos</h4>
      <div className="mt-2">
        <ScrollTable>
          <table className="w-full min-w-[520px] text-left">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#f0ecea]">
              <tr className="border-b border-[#f0ecea] text-[9px] font-bold uppercase tracking-[0.1em] text-[#a39995]">
                <th className="py-3 pr-4">Quando</th>
                <th className="py-3 pr-4">Mês</th>
                <th className="py-3 pr-4">Acção</th>
                <th className="py-3">Motivo / resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2eeec]">
              {finance.history.map((event) => (
                <tr className="align-top text-[10px]" key={event.id}>
                  <td className="py-3 pr-4 text-[#968c88]">{formatPaymentDate(event.createdAt)}</td>
                  <td className="py-3 pr-4 font-semibold text-[#4a4141]">{monthLabel(event.month)}</td>
                  <td className="py-3 pr-4">
                    <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${event.action === "closed" ? "bg-[#e7f4ea] text-[#2d6a3f]" : "bg-[#fdf0e6] text-[#9a5a1c]"}`}>
                      {event.action === "closed" ? "Fechado" : "Reaberto"}
                    </span>
                  </td>
                  <td className="py-3 text-[#554b4b]">
                    {event.action === "reopened" ? event.reason : `Resultado ${formatKz(event.resultKz ?? 0)}`}
                  </td>
                </tr>
              ))}
              {finance.history.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-[11px] text-[#968c88]" colSpan={4}>Ainda não há meses fechados.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </ScrollTable>
      </div>

      {modal === "close" ? <CloseModal onClose={() => setModal(null)} period={period} /> : null}
      {modal === "reopen" ? (
        <ReasonModal
          description="O mês volta a aceitar alterações. A reabertura fica registada no histórico com o motivo."
          eyebrow="Fecho e relatórios"
          onClose={() => setModal(null)}
          onSubmit={async (reason) => {
            const result = await send("/api/backoffice/finance/closures", "POST", {
              month: period.month,
              action: "reopen",
              reason,
            });
            if (!result.error) router.refresh();
            return result;
          }}
          submitLabel="Reabrir mês"
          title={`Reabrir ${monthLabel(period.month)}`}
        />
      ) : null}
    </section>
  );
}

function ExpenseModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const result = await send("/api/backoffice/expenses", "POST", {
      spentOn: form.get("spentOn"),
      category: form.get("category"),
      amountKz: Number(form.get("amountKz")),
      supplier: form.get("supplier"),
      description: form.get("description"),
      proofReference: form.get("proofReference"),
    });
    setSaving(false);
    if (result.error) return setError(result.error);
    onClose();
    router.refresh();
  }

  return (
    <ModalShell
      description="Regista o custo para o resultado mensal. As despesas não se apagam; se houver erro, anule com um motivo."
      eyebrow="Despesas"
      onClose={onClose}
      title="Adicionar despesa"
    >
      <form className="mt-5" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-[11px] font-semibold text-[#514849]">
            Data
            <DateField className={inputClass} defaultValue={todayInLuanda()} max={todayInLuanda()} mode="date" name="spentOn" required />
          </label>
          <label className="text-[11px] font-semibold text-[#514849]">
            Categoria
            <select className={inputClass} name="category" required>
              {expenseCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-semibold text-[#514849]">
            Valor (Kz)
            <input className={inputClass} min="1" name="amountKz" required step="1" type="number" />
          </label>
          <label className="text-[11px] font-semibold text-[#514849]">
            Fornecedor
            <input className={inputClass} maxLength={120} name="supplier" required />
          </label>
          <label className="text-[11px] font-semibold text-[#514849] sm:col-span-2">
            Descrição
            <input className={inputClass} maxLength={300} name="description" required />
          </label>
          <label className="text-[11px] font-semibold text-[#514849] sm:col-span-2">
            Referência do comprovativo (opcional)
            <input className={inputClass} maxLength={80} name="proofReference" />
          </label>
        </div>
        <FormFooter error={error} onClose={onClose} saving={saving} submitLabel="Guardar despesa" />
      </form>
    </ModalShell>
  );
}

function ExpenseRow({ expense }: { expense: Expense }) {
  const router = useRouter();
  const [voiding, setVoiding] = useState(false);
  const voided = expense.status === "voided";

  return (
    <tr className={`align-top text-[10px] ${voided ? "text-[#b5aca8]" : ""}`}>
      <td className="py-3 pr-4 text-[#968c88]">{new Date(`${expense.spentOn}T12:00:00Z`).toLocaleDateString("pt-PT", { dateStyle: "medium", timeZone: "UTC" })}</td>
      <td className="py-3 pr-4 font-semibold text-[#4a4141]">{expenseCategoryLabel(expense.category)}</td>
      <td className="py-3 pr-4">
        <p className="font-semibold text-[#4a4141]">
          {expense.supplier}
          {expense.recurringExpenseId ? (
            <span className="ml-2 rounded-full bg-[#f3ecf5] px-2 py-0.5 text-[8px] font-bold text-[#6b3f7a]">Fixa</span>
          ) : (
            <span className="ml-2 rounded-full bg-[#f1edeb] px-2 py-0.5 text-[8px] font-bold text-[#786e6b]">Avulsa</span>
          )}
        </p>
        <p className="mt-0.5 max-w-64 leading-4">{expense.description}</p>
        {expense.proofReference ? <p className="mt-0.5 text-[9px] text-[#968c88]">Comprovativo: {expense.proofReference}</p> : null}
      </td>
      <td className={`py-3 pr-4 font-semibold ${voided ? "line-through" : "text-[#554b4b]"}`}>{formatKz(expense.amountKz)}</td>
      <td className="py-3">
        {voided ? (
          <>
            <span className="rounded-full bg-[#f1edeb] px-2.5 py-1 text-[9px] font-bold text-[#786e6b]">Anulada</span>
            {expense.voidReason ? <p className="mt-1 max-w-40 text-[9px] leading-4">{expense.voidReason}</p> : null}
          </>
        ) : (
          <button className="text-[9px] font-semibold text-[#a43832] hover:underline" onClick={() => setVoiding(true)} type="button">Anular</button>
        )}
        {voiding ? (
          <ReasonModal
            description={`A despesa "${expense.description}" deixa de contar para o resultado. O registo fica guardado com o motivo.`}
            eyebrow="Despesas"
            onClose={() => setVoiding(false)}
            onSubmit={async (reason) => {
              const result = await send(`/api/backoffice/expenses/${expense.id}`, "PATCH", { voidReason: reason });
              if (!result.error) router.refresh();
              return result;
            }}
            submitLabel="Anular despesa"
            title="Anular despesa"
          />
        ) : null}
      </td>
    </tr>
  );
}

function RecurringModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const result = await send("/api/backoffice/recurring-expenses", "POST", {
      category: form.get("category"),
      amountKz: Number(form.get("amountKz")),
      dayOfMonth: Number(form.get("dayOfMonth")),
      startMonth: form.get("startMonth"),
      supplier: form.get("supplier"),
      description: form.get("description"),
    });
    setSaving(false);
    if (result.error) return setError(result.error);
    onClose();
    router.refresh();
  }

  return (
    <ModalShell
      description="Cria o modelo uma vez. Em cada mês, use Lançar fixas para gerar a despesa, podendo ajustar o valor desse mês."
      eyebrow="Despesas"
      onClose={onClose}
      title="Adicionar despesa fixa"
    >
      <form className="mt-5" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-[11px] font-semibold text-[#514849]">
            Categoria
            <select className={inputClass} name="category" required>
              {expenseCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-semibold text-[#514849]">
            Valor mensal (Kz)
            <input className={inputClass} min="1" name="amountKz" required step="1" type="number" />
          </label>
          <label className="text-[11px] font-semibold text-[#514849]">
            Dia do mês
            <input className={inputClass} defaultValue={1} max="31" min="1" name="dayOfMonth" required step="1" type="number" />
          </label>
          <label className="text-[11px] font-semibold text-[#514849]">
            Começa em
            <DateField className={inputClass} defaultValue={todayInLuanda().slice(0, 7)} mode="month" name="startMonth" required />
          </label>
          <label className="text-[11px] font-semibold text-[#514849] sm:col-span-2">
            Fornecedor
            <input className={inputClass} maxLength={120} name="supplier" required />
          </label>
          <label className="text-[11px] font-semibold text-[#514849] sm:col-span-2">
            Descrição
            <input className={inputClass} maxLength={300} name="description" required />
          </label>
        </div>
        <FormFooter error={error} onClose={onClose} saving={saving} submitLabel="Guardar despesa fixa" />
      </form>
    </ModalShell>
  );
}

function isDue(item: RecurringExpense, month: string) {
  return item.startMonth <= month && (!item.endMonth || item.endMonth >= month);
}

function LaunchModal({ finance, onClose }: { finance: FinanceData; onClose: () => void }) {
  const router = useRouter();
  const currentMonth = todayInLuanda().slice(0, 7);
  const months = finance.periods.filter((period) => period.month <= currentMonth && !period.closure);
  const launched = new Set(finance.launched);
  const [month, setMonth] = useState(
    () => (months.find((period) => period.pendingFixedCount > 0) ?? months[0])?.month ?? currentMonth,
  );
  const due = finance.recurring.filter((item) => isDue(item, month) && !launched.has(`${item.id}|${month}`));
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const result = await send("/api/backoffice/recurring-expenses/launch", "POST", {
      month,
      items: due.map((item) => ({ id: item.id, amountKz: Number(amounts[item.id] ?? item.amountKz) })),
    });
    setSaving(false);
    if (result.error) return setError(result.error);
    onClose();
    router.refresh();
  }

  return (
    <ModalShell
      description="Revê os valores deste mês. Ajustar aqui não muda o valor do modelo."
      eyebrow="Despesas"
      onClose={onClose}
      title="Lançar despesas fixas"
    >
      <form className="mt-5" onSubmit={submit}>
        <label className="text-[11px] font-semibold text-[#514849]">
          Mês
          <select className={inputClass} onChange={(event) => setMonth(event.target.value)} value={month}>
            {months.map((period) => (
              <option key={period.month} value={period.month}>
                {monthLabel(period.month)}{period.pendingFixedCount > 0 ? ` · ${period.pendingFixedCount} por lançar` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
          {due.map((item) => (
            <div className="grid grid-cols-[1fr_9rem] items-center gap-3 rounded-xl bg-[#faf8f7] p-3" key={`${item.id}|${month}`}>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-[#4a4141]">{item.description}</p>
                <p className="truncate text-[10px] text-[#968c88]">{item.supplier} · {expenseCategoryLabel(item.category)}</p>
              </div>
              <input
                aria-label={`Valor de ${item.description}`}
                className="h-10 w-full rounded-xl border border-[#e7e1df] bg-white px-3 text-[12px]"
                min="1"
                onChange={(event) => setAmounts((current) => ({ ...current, [item.id]: event.target.value }))}
                required
                step="1"
                type="number"
                value={amounts[item.id] ?? String(item.amountKz)}
              />
            </div>
          ))}
          {due.length === 0 ? (
            <p className="rounded-xl bg-[#faf8f7] px-3 py-4 text-center text-[11px] text-[#968c88]">Não há despesas fixas por lançar neste mês.</p>
          ) : null}
        </div>
        {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-[11px] text-red-800" role="alert">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2 border-t border-[#f0ecea] pt-4">
          <button className="rounded-full border border-[#e4dcd8] px-4 py-2.5 text-[11px] font-semibold text-[#716a69]" onClick={onClose} type="button">Cancelar</button>
          <button className="rounded-full bg-[#510f1d] px-5 py-2.5 text-[11px] font-semibold text-white disabled:opacity-60" disabled={saving || due.length === 0} type="submit">
            {saving ? "A lançar…" : `Lançar ${due.length} ${due.length === 1 ? "despesa" : "despesas"}`}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function RecurringRow({ item }: { item: RecurringExpense }) {
  const router = useRouter();
  const currentMonth = todayInLuanda().slice(0, 7);
  const [modal, setModal] = useState<"amount" | "end" | null>(null);
  const [error, setError] = useState("");
  const ended = Boolean(item.endMonth) && item.endMonth! < currentMonth;

  async function patch(body: Record<string, unknown>) {
    const result = await send(`/api/backoffice/recurring-expenses/${item.id}`, "PATCH", body);
    if (!result.error) router.refresh();
    return result;
  }

  return (
    <tr className={`align-top text-[10px] ${ended ? "text-[#b5aca8]" : ""}`}>
      <td className="py-3 pr-4">
        <p className="font-semibold text-[#4a4141]">{item.description}</p>
        <p className="mt-0.5 text-[9px] text-[#968c88]">{item.supplier} · {expenseCategoryLabel(item.category)}</p>
      </td>
      <td className="py-3 pr-4 font-semibold text-[#554b4b]">{formatKz(item.amountKz)}</td>
      <td className="py-3 pr-4 text-[#968c88]">Dia {item.dayOfMonth}</td>
      <td className="py-3 pr-4 text-[#968c88]">
        {monthLabel(item.startMonth)}
        {item.endMonth ? ` → ${monthLabel(item.endMonth)}` : ""}
      </td>
      <td className="py-3">
        <div className="flex flex-wrap gap-3">
          <button className="text-[9px] font-semibold text-[#762838] hover:underline" onClick={() => setModal("amount")} type="button">Alterar valor</button>
          {item.endMonth ? (
            <button className="text-[9px] font-semibold text-[#2d6a3f] hover:underline" onClick={async () => setError((await patch({ endMonth: null })).error ?? "")} type="button">Reactivar</button>
          ) : (
            <button className="text-[9px] font-semibold text-[#a43832] hover:underline" onClick={() => setModal("end")} type="button">Terminar</button>
          )}
        </div>
        {error ? <p className="mt-1 max-w-40 text-[9px] leading-4 text-[#a43832]" role="alert">{error}</p> : null}
        {modal === "amount" ? (
          <ModalShell
            description="O novo valor aplica-se aos meses ainda por lançar. Meses já lançados não mudam."
            eyebrow="Despesas"
            onClose={() => setModal(null)}
            title={`Alterar valor · ${item.description}`}
          >
            <SingleFieldForm
              defaultValue={String(item.amountKz)}
              label="Valor mensal (Kz)"
              onClose={() => setModal(null)}
              onSubmit={(value) => patch({ amountKz: Number(value) })}
              submitLabel="Guardar valor"
              type="number"
            />
          </ModalShell>
        ) : null}
        {modal === "end" ? (
          <ModalShell
            description="Escolhe o último mês em que esta despesa se aplica. Os meses seguintes deixam de a exigir."
            eyebrow="Despesas"
            onClose={() => setModal(null)}
            title={`Terminar · ${item.description}`}
          >
            <SingleFieldForm
              defaultValue={currentMonth < item.startMonth ? item.startMonth : currentMonth}
              label="Último mês"
              min={item.startMonth}
              onClose={() => setModal(null)}
              onSubmit={(value) => patch({ endMonth: value })}
              submitLabel="Terminar despesa fixa"
              type="month"
            />
          </ModalShell>
        ) : null}
      </td>
    </tr>
  );
}

function SingleFieldForm({
  label,
  type,
  defaultValue,
  min,
  submitLabel,
  onClose,
  onSubmit,
}: {
  label: string;
  type: "number" | "month";
  defaultValue: string;
  min?: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (value: string) => Promise<{ error: string | null }>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const value = String(new FormData(event.currentTarget).get("value") ?? "");
    const result = await onSubmit(value);
    setSaving(false);
    if (result.error) return setError(result.error);
    onClose();
  }

  return (
    <form className="mt-5" onSubmit={submit}>
      <label className="text-[11px] font-semibold text-[#514849]">
        {label}
        {type === "month" ? (
          <DateField autoFocus className={inputClass} defaultValue={defaultValue} min={min} mode="month" name="value" required />
        ) : (
          <input autoFocus className={inputClass} defaultValue={defaultValue} min="1" name="value" required step="1" type="number" />
        )}
      </label>
      <FormFooter error={error} onClose={onClose} saving={saving} submitLabel={submitLabel} />
    </form>
  );
}

export function ExpensesPanel({ finance, ready }: { finance: FinanceData | null; ready: boolean }) {
  const [modal, setModal] = useState<"expense" | "recurring" | "launch" | null>(null);
  const [filter, setFilter] = useState<"all" | "one-off" | "fixed">("all");

  if (!ready || !finance) return <NotMigrated />;

  const currentMonth = todayInLuanda().slice(0, 7);
  const thisMonth = finance.expenses
    .filter((expense) => expense.status === "active" && expense.spentOn.startsWith(currentMonth))
    .reduce((total, expense) => total + expense.amountKz, 0);
  const pendingFixed = finance.periods
    .filter((period) => !period.closure && period.month <= currentMonth)
    .reduce((total, period) => total + period.pendingFixedCount, 0);
  const activeFixed = finance.recurring.filter((item) => isDue(item, currentMonth));
  const fixedMonthly = activeFixed.reduce((total, item) => total + item.amountKz, 0);
  const visible = finance.expenses.filter((expense) =>
    filter === "all" ? true : filter === "fixed" ? Boolean(expense.recurringExpenseId) : !expense.recurringExpenseId,
  );
  const filters = [
    { id: "all", label: "Todas", count: finance.expenses.length },
    { id: "one-off", label: "Avulsas", count: finance.expenses.filter((expense) => !expense.recurringExpenseId).length },
    { id: "fixed", label: "Fixas", count: finance.expenses.filter((expense) => expense.recurringExpenseId).length },
  ] as const;

  return (
    <>
      <section className="mt-5 rounded-[22px] border border-[#eee9e6] bg-white p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div>
            <h3 className="text-[14px] font-bold text-[#342c2d]">Despesas</h3>
            <p className="mt-1 max-w-xl text-[11px] leading-5 text-[#9b918d]">
              Despesas avulsas e fixas lançadas. Entram no resultado do mês em Fecho e relatórios.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-full bg-[#510f1d] px-4 py-2.5 text-[11px] font-semibold text-white" onClick={() => setModal("launch")} type="button">
              Lançar fixas{pendingFixed > 0 ? ` (${pendingFixed})` : ""}
            </button>
            <button className="rounded-full border border-[#e4dcd8] px-4 py-2.5 text-[11px] font-semibold text-[#762838] hover:bg-[#fcfbfa]" onClick={() => setModal("recurring")} type="button">Adicionar despesa fixa</button>
            <button className="rounded-full border border-[#e4dcd8] px-4 py-2.5 text-[11px] font-semibold text-[#762838] hover:bg-[#fcfbfa]" onClick={() => setModal("expense")} type="button">Adicionar despesa</button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Stat label={`Despesas de ${monthLabel(currentMonth)}`} note="Activas no mês em curso" value={formatKz(thisMonth)} />
          <Stat label="Fixas por mês" note={`${activeFixed.length} despesas fixas activas`} value={formatKz(fixedMonthly)} />
          <Stat label="Fixas por lançar" note="Meses em aberto até ao actual" tone={pendingFixed > 0 ? "warn" : undefined} value={String(pendingFixed)} />
        </div>

        <div className="mt-5 inline-flex gap-1 rounded-full bg-[#f6f2f0] p-1" role="tablist">
          {filters.map((item) => (
            <button
              aria-selected={filter === item.id}
              className={`rounded-full px-4 py-2 text-[11px] font-semibold transition ${filter === item.id ? "bg-white text-[#510f1d] shadow-sm" : "text-[#8a807d] hover:text-[#510f1d]"}`}
              key={item.id}
              onClick={() => setFilter(item.id)}
              role="tab"
              type="button"
            >
              {item.label} <span className="ml-1 text-[9px] opacity-70">{item.count}</span>
            </button>
          ))}
        </div>

        {filter === "fixed" ? (
          <div className="mt-5 rounded-2xl bg-[#faf8f7] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#a39995]">Modelos de despesas fixas</p>
            <ScrollTable>
              <table className="w-full min-w-[640px] text-left">
                <thead className="sticky top-0 z-10 bg-[#faf8f7] shadow-[0_1px_0_#f0ecea]">
                  <tr className="border-b border-[#f0ecea] text-[9px] font-bold uppercase tracking-[0.1em] text-[#a39995]">
                    <th className="py-3 pr-4">Despesa</th>
                    <th className="py-3 pr-4">Valor mensal</th>
                    <th className="py-3 pr-4">Dia</th>
                    <th className="py-3 pr-4">Período</th>
                    <th className="py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2eeec]">
                  {finance.recurring.map((item) => <RecurringRow item={item} key={item.id} />)}
                  {finance.recurring.length === 0 ? (
                    <tr>
                      <td className="py-6 text-center text-[11px] text-[#968c88]" colSpan={5}>Ainda não há despesas fixas. Adicione a renda, a internet, os salários…</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </ScrollTable>
          </div>
        ) : null}

        <div className="mt-5">
          <ScrollTable>
            <table className="w-full min-w-[640px] text-left">
              <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#f0ecea]">
                <tr className="border-b border-[#f0ecea] text-[9px] font-bold uppercase tracking-[0.1em] text-[#a39995]">
                  <th className="py-3 pr-4">Data</th>
                  <th className="py-3 pr-4">Categoria</th>
                  <th className="py-3 pr-4">Fornecedor</th>
                  <th className="py-3 pr-4">Valor</th>
                  <th className="py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2eeec]">
                {visible.map((expense) => <ExpenseRow expense={expense} key={expense.id} />)}
                {visible.length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-[11px] text-[#968c88]" colSpan={5}>Não há despesas neste filtro.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </ScrollTable>
        </div>
      </section>

      {modal === "expense" ? <ExpenseModal onClose={() => setModal(null)} /> : null}
      {modal === "recurring" ? <RecurringModal onClose={() => setModal(null)} /> : null}
      {modal === "launch" ? <LaunchModal finance={finance} onClose={() => setModal(null)} /> : null}
    </>
  );
}
