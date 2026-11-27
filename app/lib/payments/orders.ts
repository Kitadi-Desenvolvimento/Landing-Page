import "server-only";

import { randomUUID } from "node:crypto";
import { touchBackofficeData } from "../read-cache";
import { createSupabaseAdminClient } from "../supabase/admin";

export type PaymentStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "expired"
  | "canceled"
  | "refunded";

export type CartItem = {
  slug: string;
  title: string;
  variantId: string;
  variantLabel: string;
  amountKz: number;
};

export class CartLedgerNotReadyError extends Error {
  constructor() {
    super("Aplique a migração das linhas do carrinho para pagar vários produtos de uma vez.");
    this.name = "CartLedgerNotReadyError";
  }
}

export type KitadiOrder = {
  reference: string;
  amountKz: number;
  originalAmountKz?: number | null;
  studentDiscountPercent?: number | null;
  courseSlug: string;
  productTitle: string;
  variantId: string;
  variantLabel: string;
  edition: string | null;
  cartItems?: CartItem[];
  name: string;
  email: string;
  phone: string;
  status: PaymentStatus;
  paymentProvider: string;
  paymentMethod: string | null;
  providerStatus: string | null;
  providerTransactionId: string | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  checkedIn: boolean;
  checkedInAt: string | null;
  checkedInBy: string | null;
  analyticsSessionId?: string | null;
  customerCompany?: string | null;
  emailSentAt?: string | null;
  emailProviderMessageId?: string | null;
  ebookDownloadedAt?: string | null;
  reconciledAt?: string | null;
  createdBy?: string | null;
};

export type CashSummary = {
  entriesKz: number;
  entriesCount: number;
  manualEntriesKz: number;
  manualEntriesCount: number;
  reconciledEntriesKz: number;
  unreconciledEntriesCount: number;
  withdrawalsKz: number;
  withdrawalsCount: number;
  reconciledWithdrawalsKz: number;
  unreconciledWithdrawalsCount: number;
};

export type PaymentSummary = {
  totalCount: number;
  acceptedCount: number;
  pendingCount: number;
  failedCount: number;
  refundedCount: number;
  acceptedAmountKz: number;
  pendingAmountKz: number;
  refundedAmountKz: number;
  successRate: number;
  averageTicketKz: number;
  checkoutAcceptedKz: number | null;
  manualAcceptedKz: number | null;
};

export type WeeklyPaymentRevenue = {
  day: string;
  current: number;
  previous: number;
};

export class PaymentLedgerNotMigratedError extends Error {
  constructor() {
    super("A tabela de pagamentos ainda não foi criada no Supabase.");
    this.name = "PaymentLedgerNotMigratedError";
  }
}

const emptyPaymentSummary: PaymentSummary = {
  totalCount: 0,
  acceptedCount: 0,
  pendingCount: 0,
  failedCount: 0,
  refundedCount: 0,
  acceptedAmountKz: 0,
  pendingAmountKz: 0,
  refundedAmountKz: 0,
  successRate: 0,
  averageTicketKz: 0,
  checkoutAcceptedKz: null,
  manualAcceptedKz: null,
};

function isMissingLedger(error: { code?: string }) {
  return (
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    error.code === "PGRST202"
  );
}

export class PeriodClosedError extends Error {
  constructor() {
    super("O mês deste movimento está fechado.");
    this.name = "PeriodClosedError";
  }
}

export class ManualReconcileError extends Error {
  constructor() {
    super("manual_not_reconcilable");
    this.name = "ManualReconcileError";
  }
}

export function throwDatabaseError(
  operation: string,
  error: { code?: string; message?: string },
) {
  if (error.message === "period_closed") throw new PeriodClosedError();
  if (isMissingLedger(error)) throw new PaymentLedgerNotMigratedError();
  console.error(`[payments] ${operation} failed`, error.code ?? "unknown");
  throw new Error("Não foi possível aceder aos pagamentos.");
}

function fromDatabase(row: Record<string, unknown>): KitadiOrder {
  return {
    reference: row.reference as string,
    amountKz: row.amount_kz as number,
    originalAmountKz: typeof row.original_amount_kz === "number" ? row.original_amount_kz : null,
    studentDiscountPercent: typeof row.student_discount_percent === "number" ? row.student_discount_percent : null,
    courseSlug: row.course_slug as string,
    productTitle: row.product_title as string,
    variantId: row.variant_id as string,
    variantLabel: row.variant_label as string,
    edition: typeof row.edition === "string" ? row.edition : null,
    name: row.customer_name as string,
    email: row.customer_email as string,
    phone: row.customer_phone as string,
    status: row.status as PaymentStatus,
    paymentProvider: row.payment_provider as string,
    paymentMethod: row.payment_method as string | null,
    providerStatus: row.provider_status as string | null,
    providerTransactionId: row.provider_transaction_id as string | null,
    reason: row.reason as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    paidAt: row.paid_at as string | null,
    checkedIn: row.checked_in === true,
    checkedInAt: typeof row.checked_in_at === "string" ? row.checked_in_at : null,
    checkedInBy: typeof row.checked_in_by === "string" ? row.checked_in_by : null,
    analyticsSessionId: typeof row.analytics_session_id === "string"
      ? row.analytics_session_id
      : null,
    customerCompany: typeof row.customer_company === "string"
      ? row.customer_company
      : null,
    emailSentAt: typeof row.email_sent_at === "string"
      ? row.email_sent_at
      : null,
    emailProviderMessageId: typeof row.email_provider_message_id === "string"
      ? row.email_provider_message_id
      : null,
    ebookDownloadedAt: typeof row.ebook_downloaded_at === "string"
      ? row.ebook_downloaded_at
      : null,
    reconciledAt: typeof row.reconciled_at === "string" ? row.reconciled_at : null,
    createdBy: typeof row.created_by === "string" ? row.created_by : null,
  };
}

function toDatabase(order: KitadiOrder) {
  return {
    reference: order.reference,
    amount_kz: order.amountKz,
    ...(order.studentDiscountPercent != null ? {
      original_amount_kz: order.originalAmountKz,
      student_discount_percent: order.studentDiscountPercent,
    } : {}),
    currency: "AOA",
    course_slug: order.courseSlug,
    product_title: order.productTitle,
    variant_id: order.variantId,
    variant_label: order.variantLabel,
    edition: order.edition,
    ...(order.cartItems ? { cart_items: order.cartItems } : {}),
    customer_name: order.name,
    customer_email: order.email,
    customer_phone: order.phone,
    status: order.status,
    payment_provider: order.paymentProvider,
    payment_method: order.paymentMethod,
    provider_status: order.providerStatus,
    provider_transaction_id: order.providerTransactionId,
    reason: order.reason,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    paid_at: order.paidAt,
    checked_in: order.checkedIn,
    checked_in_at: order.checkedInAt,
    checked_in_by: order.checkedInBy,
    analytics_session_id: order.analyticsSessionId ?? null,
    customer_company: order.customerCompany ?? null,
    ...(order.createdBy ? { created_by: order.createdBy } : {}),
  };
}

function toDatabasePatch(patch: Partial<KitadiOrder>) {
  const result: Record<string, unknown> = {};
  const columns: [keyof KitadiOrder, string][] = [
    ["amountKz", "amount_kz"],
    ["courseSlug", "course_slug"],
    ["productTitle", "product_title"],
    ["variantId", "variant_id"],
    ["variantLabel", "variant_label"],
    ["edition", "edition"],
    ["name", "customer_name"],
    ["email", "customer_email"],
    ["phone", "customer_phone"],
    ["customerCompany", "customer_company"],
    ["status", "status"],
    ["paymentProvider", "payment_provider"],
    ["paymentMethod", "payment_method"],
    ["providerStatus", "provider_status"],
    ["providerTransactionId", "provider_transaction_id"],
    ["reason", "reason"],
    ["paidAt", "paid_at"],
    ["checkedIn", "checked_in"],
    ["checkedInAt", "checked_in_at"],
    ["checkedInBy", "checked_in_by"],
    ["emailSentAt", "email_sent_at"],
    ["emailProviderMessageId", "email_provider_message_id"],
    ["ebookDownloadedAt", "ebook_downloaded_at"],
  ];

  for (const [key, column] of columns) {
    if (key in patch) result[column] = patch[key];
  }
  result.updated_at = new Date().toISOString();
  return result;
}

export function newKitadiReference() {
  return `KT${randomUUID().replace(/-/g, "").slice(0, 13).toUpperCase()}`;
}

export function isKitadiReference(reference: string) {
  return /^KT[A-Z0-9]{13}$/i.test(reference.trim());
}

export async function saveOrder(order: KitadiOrder) {
  const { data, error } = await createSupabaseAdminClient()
    .from("payment_orders")
    .insert(toDatabase(order))
    .select("*")
    .single();

  if (error) {
    if (order.cartItems && error.code === "PGRST204") throw new CartLedgerNotReadyError();
    throwDatabaseError("saving order", error);
  }
  touchBackofficeData();
  return fromDatabase(data);
}

export async function getOrder(reference: string) {
  const { data, error } = await createSupabaseAdminClient()
    .from("payment_orders")
    .select("*")
    .eq("reference", reference.toUpperCase())
    .maybeSingle();

  if (error) throwDatabaseError("loading order", error);
  return data ? fromDatabase(data) : null;
}

export async function updateOrder(
  reference: string,
  patch: Partial<KitadiOrder>,
) {
  const { data, error } = await createSupabaseAdminClient()
    .from("payment_orders")
    .update(toDatabasePatch(patch))
    .eq("reference", reference.toUpperCase())
    .select("*")
    .maybeSingle();

  if (error) throwDatabaseError("updating order", error);
  touchBackofficeData();
  return data ? fromDatabase(data) : null;
}

/**
 * Reserva o único download de um e-book pago. Só uma chamada concorrente
 * consegue a reserva; devolve null se o download já foi feito.
 */
export async function claimEbookDownload(reference: string) {
  const { data, error } = await createSupabaseAdminClient()
    .from("payment_orders")
    .update({
      ebook_downloaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("reference", reference.toUpperCase())
    .eq("status", "accepted")
    .is("ebook_downloaded_at", null)
    .select("*")
    .maybeSingle();

  if (error) throwDatabaseError("claiming ebook download", error);
  return data ? fromDatabase(data) : null;
}

/** Desfaz a reserva quando a cópia do e-book não chegou a ser gerada. */
export async function releaseEbookDownload(reference: string, claimedAt: string) {
  const { error } = await createSupabaseAdminClient()
    .from("payment_orders")
    .update({ ebook_downloaded_at: null, updated_at: new Date().toISOString() })
    .eq("reference", reference.toUpperCase())
    .eq("ebook_downloaded_at", claimedAt);

  if (error) throwDatabaseError("releasing ebook download", error);
}

export async function getRecentPaymentOrders(limit = 100) {
  const { data, error } = await createSupabaseAdminClient()
    .from("payment_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throwDatabaseError("listing orders", error);
  return (data ?? []).map((row) => fromDatabase(row));
}

export async function getAcceptedOrders(filters: {
  startDate?: string;
  endDate?: string;
  courseSlug?: string;
  edition?: string;
}) {
  const admin = createSupabaseAdminClient();
  const pageSize = 1000;
  const orders: KitadiOrder[] = [];

  for (let from = 0; ; from += pageSize) {
    let query = admin
      .from("payment_orders")
      .select("reference,amount_kz,course_slug,product_title,variant_id,variant_label,edition,customer_name,customer_email,customer_phone,status,payment_provider,payment_method,provider_status,provider_transaction_id,reason,created_at,updated_at,paid_at,checked_in,checked_in_at,checked_in_by")
      .eq("status", "accepted")
      .order("paid_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (filters.startDate) query = query.gte("paid_at", `${filters.startDate}T00:00:00.000Z`);
    if (filters.endDate) query = query.lte("paid_at", `${filters.endDate}T23:59:59.999Z`);
    if (filters.courseSlug) query = query.eq("course_slug", filters.courseSlug);
    if (filters.edition) query = query.eq("edition", filters.edition);

    const { data, error } = await query;
    if (error) throwDatabaseError("listing accepted attendees", error);
    const page = data ?? [];
    orders.push(...page.map((row) => fromDatabase(row)));
    if (page.length < pageSize) return orders;
  }
}

export async function getAcceptedOrderSalesByProduct() {
  const admin = createSupabaseAdminClient();
  const pageSize = 1000;
  const byProduct: Record<string, { sales: number; revenueKz: number }> = {};
  let checkoutRevenueKz = 0;
  let manualRevenueKz = 0;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("payment_orders")
      .select("course_slug,amount_kz,payment_provider")
      .eq("status", "accepted")
      .order("paid_at", { ascending: false })
      .order("reference", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throwDatabaseError("aggregating accepted sales by product", error);
    const page = data ?? [];

    for (const order of page) {
      const amount = Number(order.amount_kz);
      const product = byProduct[order.course_slug] ?? { sales: 0, revenueKz: 0 };
      product.sales += 1;
      product.revenueKz += amount;
      byProduct[order.course_slug] = product;
      if (order.payment_provider === "manual") manualRevenueKz += amount;
      else checkoutRevenueKz += amount;
    }

    if (page.length < pageSize) return { byProduct, checkoutRevenueKz, manualRevenueKz };
  }
}

export async function getWeeklyPaymentRevenue(): Promise<WeeklyPaymentRevenue[]> {
  const now = new Date();
  const currentWeekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysSinceMonday = (currentWeekStart.getUTCDay() + 6) % 7;
  currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - daysSinceMonday);
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7);
  const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const totals = new Map<string, number>();
  const pageSize = 1000;
  const admin = createSupabaseAdminClient();

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("payment_orders")
      .select("paid_at,amount_kz")
      .eq("status", "accepted")
      .gte("paid_at", previousWeekStart.toISOString())
      .lt("paid_at", now.toISOString())
      .order("paid_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throwDatabaseError("loading weekly revenue", error);
    const page = data ?? [];
    for (const order of page) {
      if (typeof order.paid_at !== "string" || typeof order.amount_kz !== "number") continue;
      const date = order.paid_at.slice(0, 10);
      totals.set(date, (totals.get(date) ?? 0) + order.amount_kz);
    }
    if (page.length < pageSize) break;
  }

  return dayLabels.map((day, index) => {
    const currentDate = new Date(currentWeekStart);
    currentDate.setUTCDate(currentDate.getUTCDate() + index);
    const previousDate = new Date(previousWeekStart);
    previousDate.setUTCDate(previousDate.getUTCDate() + index);
    return {
      day,
      current: totals.get(currentDate.toISOString().slice(0, 10)) ?? 0,
      previous: totals.get(previousDate.toISOString().slice(0, 10)) ?? 0,
    };
  });
}

export async function getPaymentSummary(): Promise<PaymentSummary> {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "backoffice_payment_summary",
  );

  if (error) throwDatabaseError("loading payment summary", error);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return emptyPaymentSummary;

  return {
    totalCount: Number(row.total_count),
    acceptedCount: Number(row.accepted_count),
    pendingCount: Number(row.pending_count),
    failedCount: Number(row.failed_count),
    refundedCount: Number(row.refunded_count),
    acceptedAmountKz: Number(row.accepted_amount_kz),
    pendingAmountKz: Number(row.pending_amount_kz),
    refundedAmountKz: Number(row.refunded_amount_kz),
    successRate: Number(row.success_rate),
    averageTicketKz: Number(row.average_ticket_kz),
    checkoutAcceptedKz: row.checkout_accepted_kz == null ? null : Number(row.checkout_accepted_kz),
    manualAcceptedKz: row.manual_accepted_kz == null ? null : Number(row.manual_accepted_kz),
  };
}

export const manualPaymentMethods = [
  "Numerário",
  "Transferência bancária",
  "Depósito",
  "Multicaixa Express",
  "Outro",
] as const;

export type ManualPaymentInput = {
  product: { slug: string; title: string; edition: string | null };
  variant: { id: string; label: string };
  amountKz: number;
  name: string;
  email: string;
  phone: string;
  method: (typeof manualPaymentMethods)[number];
  providerReference: string | null;
  paidAt: string;
  createdBy: string;
};

/**
 * Pagamento recebido fora do checkout. Entra como "accepted" em payment_orders,
 * pelo que participantes, e-books, receita por produto e totais o contam
 * automaticamente, tal como um pagamento WiPay.
 */
export async function createManualOrder(input: ManualPaymentInput) {
  const now = new Date().toISOString();
  return saveOrder({
    reference: newKitadiReference(),
    amountKz: input.amountKz,
    courseSlug: input.product.slug,
    productTitle: input.product.title,
    variantId: input.variant.id,
    variantLabel: input.variant.label,
    edition: input.product.edition,
    name: input.name,
    email: input.email,
    phone: input.phone,
    status: "accepted",
    paymentProvider: "manual",
    paymentMethod: input.method,
    providerStatus: null,
    providerTransactionId: input.providerReference,
    reason: null,
    createdAt: now,
    updatedAt: now,
    paidAt: input.paidAt,
    checkedIn: false,
    checkedInAt: null,
    checkedInBy: null,
    createdBy: input.createdBy,
  });
}

export async function setOrderReconciled(
  reference: string,
  reconciled: boolean,
  userId: string,
) {
  const admin = createSupabaseAdminClient();
  const normalized = reference.toUpperCase();
  const { data, error } = await admin
    .from("payment_orders")
    .update({
      reconciled_at: reconciled ? new Date().toISOString() : null,
      reconciled_by: reconciled ? userId : null,
      updated_at: new Date().toISOString(),
    })
    .eq("reference", normalized)
    .eq("status", "accepted")
    .neq("payment_provider", "manual")
    .select("*")
    .maybeSingle();

  if (error) throwDatabaseError("reconciling order", error);
  if (!data) {
    const existing = await admin
      .from("payment_orders")
      .select("payment_provider,status")
      .eq("reference", normalized)
      .maybeSingle();
    if (existing.data?.payment_provider === "manual" && existing.data.status === "accepted") {
      throw new ManualReconcileError();
    }
    return null;
  }
  touchBackofficeData();
  return fromDatabase(data);
}

/** Só pagamentos manuais podem ser estornados aqui; os da WiPay seguem o webhook. */
export async function refundManualOrder(reference: string, reason: string, userId: string) {
  const { data, error } = await createSupabaseAdminClient()
    .from("payment_orders")
    .update({
      status: "refunded",
      reason,
      refunded_at: new Date().toISOString(),
      refunded_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("reference", reference.toUpperCase())
    .eq("status", "accepted")
    .eq("payment_provider", "manual")
    .select("*")
    .maybeSingle();

  if (error) throwDatabaseError("refunding manual order", error);
  touchBackofficeData();
  return data ? fromDatabase(data) : null;
}

const emptyCashSummary: CashSummary = {
  entriesKz: 0,
  entriesCount: 0,
  manualEntriesKz: 0,
  manualEntriesCount: 0,
  reconciledEntriesKz: 0,
  unreconciledEntriesCount: 0,
  withdrawalsKz: 0,
  withdrawalsCount: 0,
  reconciledWithdrawalsKz: 0,
  unreconciledWithdrawalsCount: 0,
};

export async function getCashSummary(): Promise<CashSummary> {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "backoffice_cash_summary",
  );

  if (error) throwDatabaseError("loading cash summary", error);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return emptyCashSummary;

  return {
    entriesKz: Number(row.entries_kz),
    entriesCount: Number(row.entries_count),
    manualEntriesKz: Number(row.manual_entries_kz),
    manualEntriesCount: Number(row.manual_entries_count),
    reconciledEntriesKz: Number(row.reconciled_entries_kz),
    unreconciledEntriesCount: Number(row.unreconciled_entries_count),
    withdrawalsKz: Number(row.withdrawals_kz),
    withdrawalsCount: Number(row.withdrawals_count),
    reconciledWithdrawalsKz: Number(row.reconciled_withdrawals_kz),
    unreconciledWithdrawalsCount: Number(row.unreconciled_withdrawals_count),
  };
}
