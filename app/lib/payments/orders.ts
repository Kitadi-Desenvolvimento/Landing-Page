import "server-only";

import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "../supabase/admin";

export type PaymentStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "expired"
  | "canceled"
  | "refunded";

export type KitadiOrder = {
  reference: string;
  amountKz: number;
  courseSlug: string;
  productTitle: string;
  variantId: string;
  variantLabel: string;
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
};

function isMissingLedger(error: { code?: string }) {
  return error.code === "PGRST205" || error.code === "PGRST202";
}

function throwDatabaseError(operation: string, error: { code?: string }) {
  if (isMissingLedger(error)) throw new PaymentLedgerNotMigratedError();
  console.error(`[payments] ${operation} failed`, error.code ?? "unknown");
  throw new Error("Não foi possível aceder aos pagamentos.");
}

function fromDatabase(row: Record<string, unknown>): KitadiOrder {
  return {
    reference: row.reference as string,
    amountKz: row.amount_kz as number,
    courseSlug: row.course_slug as string,
    productTitle: row.product_title as string,
    variantId: row.variant_id as string,
    variantLabel: row.variant_label as string,
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
  };
}

function toDatabase(order: KitadiOrder) {
  return {
    reference: order.reference,
    amount_kz: order.amountKz,
    currency: "AOA",
    course_slug: order.courseSlug,
    product_title: order.productTitle,
    variant_id: order.variantId,
    variant_label: order.variantLabel,
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
    ["name", "customer_name"],
    ["email", "customer_email"],
    ["phone", "customer_phone"],
    ["status", "status"],
    ["paymentProvider", "payment_provider"],
    ["paymentMethod", "payment_method"],
    ["providerStatus", "provider_status"],
    ["providerTransactionId", "provider_transaction_id"],
    ["reason", "reason"],
    ["paidAt", "paid_at"],
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

  if (error) throwDatabaseError("saving order", error);
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
  return data ? fromDatabase(data) : null;
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
  };
}
