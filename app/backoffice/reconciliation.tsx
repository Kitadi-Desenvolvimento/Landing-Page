"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { formatKz, formatPaymentDate, type DashboardProduct } from "./dashboard-data";
import { ScrollTable } from "./scroll-table";
import type { CashSummary, KitadiOrder } from "../lib/payments/orders";
import type { Withdrawal } from "../lib/payments/withdrawals";
import { DateField } from "./date-field";
import { messageForApiError } from "../lib/api-error-messages";

const migrationFile = "20261122000000_add_payment_reconciliation.sql";
const manualMethods = ["Numerário", "Transferência bancária", "Depósito", "Multicaixa Express", "Outro"];

export async function send(url: string, method: "POST" | "PATCH", body: unknown) {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return { error: null };
    const result: unknown = await response.json().catch(() => null);
    const code = typeof result === "object" && result !== null && "error" in result &&
      typeof result.error === "string"
      ? result.error
      : "";
    return { error: messageForApiError(code, "Não foi possível guardar. Tente novamente.") };
  } catch {
    return { error: "Sem ligação ao servidor. Tente novamente." };
  }
}

export function todayInLuanda() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Africa/Luanda" });
}

export const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-[#e7e1df] bg-white px-3 text-[12px]";

export function ModalShell({
  eyebrow,
  title,
  description,
  onClose,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#211d1e]/45 p-4">
      <section aria-label={title} aria-modal="true" className="my-auto w-full max-w-[640px] rounded-[24px] bg-white p-5 shadow-2xl sm:p-7" role="dialog">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a8792f]">{eyebrow}</p>
            <h2 className="mt-1 text-[20px] font-bold text-[#302829]">{title}</h2>
            <p className="mt-1 text-[12px] text-[#827976]">{description}</p>
          </div>
          <button aria-label="Fechar" className="rounded-full px-3 py-1 text-[20px] text-[#857b77] hover:bg-[#f5f2f1]" onClick={onClose} type="button">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function FormFooter({ error, saving, submitLabel, onClose }: { error: string; saving: boolean; submitLabel: string; onClose: () => void }) {
  return (
    <>
      {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-[11px] text-red-800" role="alert">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2 border-t border-[#f0ecea] pt-4">
        <button className="rounded-full border border-[#e7e1df] px-4 py-2.5 text-[11px] font-semibold text-[#716a69]" onClick={onClose} type="button">Cancelar</button>
        <button className="rounded-full bg-[#510f1d] px-5 py-2.5 text-[11px] font-semibold text-white disabled:opacity-60" disabled={saving} type="submit">{saving ? "A guardar…" : submitLabel}</button>
      </div>
    </>
  );
}

function ManualPaymentModal({ products, onClose }: { products: DashboardProduct[]; onClose: () => void }) {
  const router = useRouter();
  const [slug, setSlug] = useState(products[0]?.slug ?? "");
  const product = products.find((item) => item.slug === slug);
  const variants = product?.data.course?.variants ?? [];
  const [variantId, setVariantId] = useState("");
  const variant = variants.find((item) => item.id === variantId) ?? variants[0];
  const [amount, setAmount] = useState(
    String(variants[0]?.priceAmount ?? product?.data.priceAmount ?? ""),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function chooseProduct(next: string) {
    const nextProduct = products.find((item) => item.slug === next);
    const nextVariant = nextProduct?.data.course?.variants[0];
    setSlug(next);
    setVariantId(nextVariant?.id ?? "");
    setAmount(String(nextVariant?.priceAmount ?? nextProduct?.data.priceAmount ?? ""));
  }

  function chooseVariant(next: string) {
    setVariantId(next);
    const price = variants.find((item) => item.id === next)?.priceAmount;
    if (price) setAmount(String(price));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const result = await send("/api/backoffice/payments", "POST", {
      courseSlug: slug,
      variantId: variant?.id ?? null,
      amountKz: Number(amount),
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
      method: form.get("method"),
      providerReference: form.get("providerReference"),
      paidAt: form.get("paidAt"),
    });
    setSaving(false);
    if (result.error) return setError(result.error);
    onClose();
    router.refresh();
  }

  return (
    <ModalShell
      description="Regista uma entrada recebida fora do checkout. Conta como pagamento concluído em toda a app (receita, participantes e e-books)."
      eyebrow="Conciliação"
      onClose={onClose}
      title="Adicionar pagamento"
    >
      <form className="mt-5" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-[11px] font-semibold text-[#514849]">
            Produto
            <select className={inputClass} onChange={(event) => chooseProduct(event.target.value)} required value={slug}>
              {products.map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}
            </select>
          </label>
          {variants.length ? (
            <label className="text-[11px] font-semibold text-[#514849]">
              Variante
              <select className={inputClass} onChange={(event) => chooseVariant(event.target.value)} value={variant?.id ?? ""}>
                {variants.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.price}</option>)}
              </select>
            </label>
          ) : <div />}
          <label className="text-[11px] font-semibold text-[#514849]">
            Valor recebido (Kz)
            <input className={inputClass} min="1" onChange={(event) => setAmount(event.target.value)} required step="1" type="number" value={amount} />
          </label>
          <label className="text-[11px] font-semibold text-[#514849]">
            Data do pagamento
            <DateField className={inputClass} defaultValue={todayInLuanda()} max={todayInLuanda()} mode="date" name="paidAt" required />
          </label>
          <label className="text-[11px] font-semibold text-[#514849]">
            Nome do cliente
            <input className={inputClass} maxLength={120} name="name" required />
          </label>
          <label className="text-[11px] font-semibold text-[#514849]">
            Email
            <input className={inputClass} maxLength={254} name="email" required type="email" />
          </label>
          <label className="text-[11px] font-semibold text-[#514849]">
            Telefone (opcional)
            <input className={inputClass} maxLength={17} name="phone" type="tel" />
          </label>
          <label className="text-[11px] font-semibold text-[#514849]">
            Método
            <select className={inputClass} defaultValue={manualMethods[0]} name="method">
              {manualMethods.map((method) => <option key={method}>{method}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-semibold text-[#514849] sm:col-span-2">
            Referência / comprovativo (opcional)
            <input className={inputClass} maxLength={80} name="providerReference" placeholder="Ex.: número da transferência" />
          </label>
        </div>
        <FormFooter error={error} onClose={onClose} saving={saving} submitLabel="Adicionar pagamento" />
      </form>
    </ModalShell>
  );
}

function WithdrawalModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const result = await send("/api/backoffice/withdrawals", "POST", {
      amountKz: Number(form.get("amountKz")),
      withdrawnAt: form.get("withdrawnAt"),
      providerReference: form.get("providerReference"),
    });
    setSaving(false);
    if (result.error) return setError(result.error);
    onClose();
    router.refresh();
  }

  return (
    <ModalShell
      description="O levantamento verdadeiro é feito na WiPay. Regista aqui o mesmo valor e a referência para manter os saldos iguais."
      eyebrow="Conciliação"
      onClose={onClose}
      title="Registar levantamento"
    >
      <form className="mt-5" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-[11px] font-semibold text-[#514849]">
            Valor levantado (Kz)
            <input className={inputClass} min="1" name="amountKz" required step="1" type="number" />
          </label>
          <label className="text-[11px] font-semibold text-[#514849]">
            Data do levantamento
            <DateField className={inputClass} defaultValue={todayInLuanda()} max={todayInLuanda()} mode="date" name="withdrawnAt" required />
          </label>
          <label className="text-[11px] font-semibold text-[#514849] sm:col-span-2">
            Referência WiPay
            <input className={inputClass} maxLength={80} name="providerReference" required />
          </label>
        </div>
        <FormFooter error={error} onClose={onClose} saving={saving} submitLabel="Registar levantamento" />
      </form>
    </ModalShell>
  );
}

export function ReasonModal({
  eyebrow = "Conciliação",
  title,
  description,
  submitLabel,
  onClose,
  onSubmit,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<{ error: string | null }>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
    const result = await onSubmit(reason);
    setSaving(false);
    if (result.error) return setError(result.error);
    onClose();
  }

  return (
    <ModalShell description={description} eyebrow={eyebrow} onClose={onClose} title={title}>
      <form className="mt-5" onSubmit={submit}>
        <label className="text-[11px] font-semibold text-[#514849]">
          Motivo
          <input autoFocus className={inputClass} maxLength={200} name="reason" required />
        </label>
        <FormFooter error={error} onClose={onClose} saving={saving} submitLabel={submitLabel} />
      </form>
    </ModalShell>
  );
}

function ReconcileButton({ reconciled, onToggle }: { reconciled: boolean; onToggle: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={`rounded-full px-2.5 py-1 text-[9px] font-bold disabled:opacity-60 ${reconciled ? "bg-[#edf4ee] text-[#52765e]" : "border border-[#e4dcd8] text-[#762838] hover:bg-[#fcfbfa]"}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await onToggle();
        setBusy(false);
      }}
      title={reconciled ? "Clique para desfazer a conciliação" : "Confirmar que existe igual na WiPay"}
      type="button"
    >
      {reconciled ? "✓ Conciliado" : "Conciliar"}
    </button>
  );
}

/** Coluna "Conciliação" da tabela de pagamentos. */
export function PaymentReconciliationCell({ order }: { order: KitadiOrder }) {
  const router = useRouter();
  const [refunding, setRefunding] = useState(false);
  const [error, setError] = useState("");

  if (order.status !== "accepted") return <span className="text-[#b5aca8]">—</span>;

  return (
    <>
      <ReconcileButton
        onToggle={async () => {
          setError("");
          const result = await send(`/api/backoffice/payments/${order.reference}`, "PATCH", {
            reconciled: !order.reconciledAt,
          });
          if (result.error) setError(result.error);
          else router.refresh();
        }}
        reconciled={Boolean(order.reconciledAt)}
      />
      {order.reconciledAt ? (
        <p className="mt-1 text-[9px] text-[#a19894]">{formatPaymentDate(order.reconciledAt)}</p>
      ) : null}
      {order.paymentProvider === "manual" ? (
        <button className="mt-1.5 block text-[9px] font-semibold text-[#a43832] hover:underline" onClick={() => setRefunding(true)} type="button">
          Estornar
        </button>
      ) : null}
      {error ? <p className="mt-1 max-w-40 text-[9px] leading-4 text-[#a43832]" role="alert">{error}</p> : null}
      {refunding ? (
        <ReasonModal
          description={`O pagamento ${order.reference} deixa de contar como receita. O registo fica guardado com o motivo.`}
          onClose={() => setRefunding(false)}
          onSubmit={async (reason) => {
            const result = await send(`/api/backoffice/payments/${order.reference}`, "PATCH", { refundReason: reason });
            if (!result.error) router.refresh();
            return result;
          }}
          submitLabel="Estornar pagamento"
          title="Estornar pagamento manual"
        />
      ) : null}
    </>
  );
}

function CashStat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "warn" }) {
  return (
    <div className="rounded-2xl border border-[#eee9e6] bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#a39995]">{label}</p>
      <p className={`mt-2 text-[20px] font-bold ${tone === "warn" ? "text-[#a43832]" : "text-[#342c2d]"}`}>{value}</p>
      <p className="mt-1 text-[10px] leading-4 text-[#968c88]">{note}</p>
    </div>
  );
}

function WithdrawalRow({ withdrawal }: { withdrawal: Withdrawal }) {
  const router = useRouter();
  const [voiding, setVoiding] = useState(false);
  const [error, setError] = useState("");
  const voided = withdrawal.status === "voided";

  return (
    <tr className={`align-top text-[10px] ${voided ? "text-[#b5aca8]" : ""}`}>
      <td className="py-3 pr-4 text-[#968c88]">{formatPaymentDate(withdrawal.withdrawnAt)}</td>
      <td className="py-3 pr-4 font-semibold text-[#4a4141]">{withdrawal.providerReference}</td>
      <td className={`py-3 pr-4 font-semibold ${voided ? "line-through" : "text-[#554b4b]"}`}>{formatKz(withdrawal.amountKz)}</td>
      <td className="py-3 pr-4">
        {voided ? (
          <>
            <span className="rounded-full bg-[#f1edeb] px-2.5 py-1 text-[9px] font-bold text-[#786e6b]">Anulado</span>
            {withdrawal.voidReason ? <p className="mt-1 max-w-48 text-[9px] leading-4">{withdrawal.voidReason}</p> : null}
          </>
        ) : (
          <ReconcileButton
            onToggle={async () => {
              setError("");
              const result = await send(`/api/backoffice/withdrawals/${withdrawal.id}`, "PATCH", {
                reconciled: !withdrawal.reconciledAt,
              });
              if (result.error) setError(result.error);
              else router.refresh();
            }}
            reconciled={Boolean(withdrawal.reconciledAt)}
          />
        )}
        {error ? <p className="mt-1 max-w-40 text-[9px] leading-4 text-[#a43832]" role="alert">{error}</p> : null}
      </td>
      <td className="py-3">
        {!voided ? (
          <button className="text-[9px] font-semibold text-[#a43832] hover:underline" onClick={() => setVoiding(true)} type="button">Anular</button>
        ) : null}
        {voiding ? (
          <ReasonModal
            description={`O levantamento ${withdrawal.providerReference} deixa de reduzir o saldo. O registo fica guardado com o motivo.`}
            onClose={() => setVoiding(false)}
            onSubmit={async (reason) => {
              const result = await send(`/api/backoffice/withdrawals/${withdrawal.id}`, "PATCH", { voidReason: reason });
              if (!result.error) router.refresh();
              return result;
            }}
            submitLabel="Anular levantamento"
            title="Anular levantamento"
          />
        ) : null}
      </td>
    </tr>
  );
}

export function ReconciliationPanel({
  cashSummary,
  withdrawals,
  products,
  ready,
}: {
  cashSummary: CashSummary | null;
  withdrawals: Withdrawal[];
  products: DashboardProduct[];
  ready: boolean;
}) {
  const [modal, setModal] = useState<"payment" | "withdrawal" | null>(null);

  if (!ready || !cashSummary) {
    return (
      <div className="mt-5 rounded-2xl border border-[#e9d8b5] bg-[#fffaf0] px-4 py-3 text-[11px] leading-5 text-[#6b542d]" role="status">
        A conciliação com a WiPay ainda não está configurada. Aplique a migração
        <code className="mx-1 rounded bg-white px-1.5 py-0.5">{migrationFile}</code>
        no Supabase para registar pagamentos manuais e levantamentos.
      </div>
    );
  }

  const available = cashSummary.entriesKz - cashSummary.withdrawalsKz;
  const reconciledBalance = cashSummary.reconciledEntriesKz - cashSummary.reconciledWithdrawalsKz;
  const pendingMovements = cashSummary.unreconciledEntriesCount + cashSummary.unreconciledWithdrawalsCount;

  return (
    <section className="mt-5 rounded-[22px] border border-[#eee9e6] bg-white p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h3 className="text-[14px] font-bold text-[#342c2d]">Conciliação com a WiPay</h3>
          <p className="mt-1 max-w-xl text-[11px] leading-5 text-[#9b918d]">
            Marque cada movimento como conciliado depois de confirmar que existe igual na WiPay. Quando tudo estiver conciliado, o saldo conciliado deve ser igual ao saldo da WiPay.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-full bg-[#510f1d] px-4 py-2.5 text-[11px] font-semibold text-white" onClick={() => setModal("payment")} type="button">Adicionar pagamento</button>
          <button className="rounded-full border border-[#e4dcd8] px-4 py-2.5 text-[11px] font-semibold text-[#762838] hover:bg-[#fcfbfa]" onClick={() => setModal("withdrawal")} type="button">Registar levantamento</button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CashStat label="Entradas" note={`${cashSummary.entriesCount} pagamentos · ${cashSummary.manualEntriesCount} manuais (${formatKz(cashSummary.manualEntriesKz)})`} value={formatKz(cashSummary.entriesKz)} />
        <CashStat label="Levantamentos" note={`${cashSummary.withdrawalsCount} levantamentos activos`} value={formatKz(cashSummary.withdrawalsKz)} />
        <CashStat
          label="Saldo disponível"
          note={available < 0 ? "Negativo: faltam entradas registadas aqui" : "Entradas menos levantamentos"}
          tone={available < 0 ? "warn" : undefined}
          value={formatKz(available)}
        />
        <CashStat
          label="Saldo conciliado"
          note={pendingMovements === 0 ? "Tudo conciliado" : `${pendingMovements} movimentos por conciliar · diferença ${formatKz(available - reconciledBalance)}`}
          value={formatKz(reconciledBalance)}
        />
      </div>

      <h4 className="mt-6 text-[12px] font-bold text-[#342c2d]">Levantamentos</h4>
      <div className="mt-2">
        <ScrollTable>
        <table className="w-full min-w-[640px] text-left">
          <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#f0ecea]">
            <tr className="border-b border-[#f0ecea] text-[9px] font-bold uppercase tracking-[0.1em] text-[#a39995]">
              <th className="py-3 pr-4">Data</th>
              <th className="py-3 pr-4">Referência WiPay</th>
              <th className="py-3 pr-4">Valor</th>
              <th className="py-3 pr-4">Conciliação</th>
              <th className="py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f2eeec]">
            {withdrawals.map((withdrawal) => <WithdrawalRow key={withdrawal.id} withdrawal={withdrawal} />)}
            {withdrawals.length === 0 ? (
              <tr>
                <td className="py-6 text-center text-[11px] text-[#968c88]" colSpan={5}>Ainda não há levantamentos registados.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </ScrollTable>
      </div>

      {modal === "payment" ? <ManualPaymentModal onClose={() => setModal(null)} products={products} /> : null}
      {modal === "withdrawal" ? <WithdrawalModal onClose={() => setModal(null)} /> : null}
    </section>
  );
}
