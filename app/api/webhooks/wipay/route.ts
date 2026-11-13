import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getOrder,
  isKitadiReference,
  PaymentLedgerNotMigratedError,
  updateOrder,
  type KitadiOrder,
} from "../../../lib/payments/orders";
import { getWipaySignatureToken } from "../../../lib/payments/wipay";

function isValidSignature(rawBody: string, signature: string | null, token: string) {
  if (!signature || !/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", token).update(rawBody).digest();
  const provided = Buffer.from(signature, "hex");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("signature");

  let signatureToken: string;
  try {
    signatureToken = await getWipaySignatureToken();
  } catch {
    console.error("[wipay:webhook] signature token unavailable");
    return NextResponse.json({ error: "signature_validation_unavailable" }, { status: 503 });
  }

  if (!isValidSignature(rawBody, signature, signatureToken)) {
    console.error("[wipay:webhook] rejected invalid callback signature", {
      hasSignature: Boolean(signature),
    });
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const reference = typeof body.reference_id === "string" ? body.reference_id.trim() : "";
  if (!reference || !isKitadiReference(reference)) {
    return NextResponse.json({ error: "invalid_reference" }, { status: 400 });
  }

  const status =
    typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
  let order;
  try {
    order = await getOrder(reference);
  } catch (error) {
    console.error("[wipay:webhook] payment ledger unavailable", {
      code: error instanceof PaymentLedgerNotMigratedError ? "not_migrated" : "database_error",
    });
    return NextResponse.json({ error: "payment_storage_unavailable" }, { status: 503 });
  }
  const amount = Number(body.amount);
  const currency = String(body.currency ?? "").toLowerCase();
  if (!order) {
    console.error("[wipay:webhook] callback has no matching local order", {
      reference,
      status: status || "missing",
    });
    return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
  }

  if (!Number.isFinite(amount) || amount !== order.amountKz || currency !== "aoa") {
    console.error("[wipay:webhook] callback details do not match the order", {
      reference,
      expectedAmount: order.amountKz,
      receivedAmount: Number.isFinite(amount) ? amount : "invalid",
      currency,
    });
    return NextResponse.json({ error: "payment_details_mismatch" }, { status: 400 });
  }

  if (
    order.status === "accepted" &&
    ["rejected", "expired", "canceled", "cancelled", "pending", "pending_confirmation", "processing"].includes(status)
  ) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (status === "accepted") {
    const metadata = getProviderMetadata(body);
    const saved = await updateWebhookUpdate(reference, {
      status: "accepted",
      providerStatus: status,
      ...metadata,
      reason: null,
      paidAt: order.paidAt ?? getProviderEventAt(body) ?? new Date().toISOString(),
    });
    if (!saved) return paymentStorageError();
    return NextResponse.json({ ok: true, status: "accepted" });
  }

  if (status === "rejected") {
    const reasonCode = getStatusReasonCode(body);
    const expired = reasonCode === "3003" || reasonCode === "4004";
    const metadata = getProviderMetadata(body);
    const saved = await updateWebhookUpdate(reference, {
      status: expired ? "expired" : "rejected",
      providerStatus: status,
      ...metadata,
      reason: getStatusReason(reasonCode),
    });
    if (!saved) return paymentStorageError();
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  if (["pending", "pending_confirmation", "processing"].includes(status)) {
    const metadata = getProviderMetadata(body);
    const saved = await updateWebhookUpdate(reference, {
      status: "pending",
      providerStatus: status,
      ...metadata,
    });
    if (!saved) return paymentStorageError();
    return NextResponse.json({ ok: true, status: "pending" });
  }

  if (["expired", "canceled", "cancelled", "refunded"].includes(status)) {
    const normalizedStatus: KitadiOrder["status"] =
      status === "expired"
        ? "expired"
        : status === "refunded"
          ? "refunded"
          : "canceled";
    const saved = await updateWebhookUpdate(reference, {
      status: normalizedStatus,
      providerStatus: status,
      ...getProviderMetadata(body),
      reason: getStatusReason(getStatusReasonCode(body)),
    });
    if (!saved) return paymentStorageError();
    return NextResponse.json({ ok: true, status: normalizedStatus });
  }

  console.warn("[wipay:webhook] callback contains an undocumented status", {
    reference,
    status: status || "missing",
  });
  const saved = await updateWebhookUpdate(reference, {
    status: "pending",
    providerStatus: status || "missing",
    ...getProviderMetadata(body),
    reason: `Estado WiPay não reconhecido: ${status || "ausente"}`.slice(0, 500),
  });
  if (!saved) return paymentStorageError();
  return NextResponse.json({ ok: true, status: "pending", unrecognized: true });
}

async function updateWebhookUpdate(
  reference: string,
  patch: Partial<KitadiOrder>,
) {
  try {
    const order = await updateOrder(reference, patch);
    if (!order) {
      console.error("[wipay:webhook] payment order disappeared before update");
      return false;
    }
    return true;
  } catch (error) {
    console.error("[wipay:webhook] payment update failed", {
      code: error instanceof PaymentLedgerNotMigratedError ? "not_migrated" : "database_error",
    });
    return false;
  }
}

function paymentStorageError() {
  return NextResponse.json({ error: "payment_storage_unavailable" }, { status: 503 });
}

function getProviderMetadata(body: Record<string, unknown>) {
  const metadata: {
    paymentMethod?: string;
    providerTransactionId?: string;
  } = {};
  for (const key of [
    "processor",
    "payment_method",
    "payment_type",
    "payment_channel",
    "payment_mode",
    "payment_method_name",
    "channel",
    "method",
  ]) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) {
      metadata.paymentMethod = value.trim().slice(0, 80);
      break;
    }
  }
  for (const key of [
    "id",
    "transaction_id",
    "payment_id",
    "transaction_reference",
  ]) {
    const value = body[key];
    if (
      (typeof value === "string" && value.trim()) ||
      (typeof value === "number" && Number.isSafeInteger(value))
    ) {
      metadata.providerTransactionId = String(value).trim().slice(0, 160);
      break;
    }
  }
  return metadata;
}

function getStatusReasonCode(body: Record<string, unknown>) {
  const reason = body.status_reason;
  if (typeof reason === "string") return reason.trim();
  return typeof reason === "number" && Number.isSafeInteger(reason)
    ? String(reason)
    : "";
}

function getProviderEventAt(body: Record<string, unknown>) {
  if (typeof body.status_datetime !== "string") return null;
  const timestamp = Date.parse(body.status_datetime);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function getStatusReason(code: string) {
  const reasons: Record<string, string> = {
    "2000": "2000 · Sucesso",
    "3000": "3000 · Conta inválida ou desactivada",
    "3001": "3001 · Saldo insuficiente",
    "3002": "3002 · Pagamento rejeitado pelo cliente",
    "3003": "3003 · Tempo de pagamento expirado",
    "3004": "3004 · Confirmação inválida",
    "3005": "3005 · PIN inválido",
    "3006": "3006 · Valor abaixo do limite mínimo",
    "4000": "4000 · Erro do processador de pagamento",
    "4003": "4003 · Processador indisponível",
    "4004": "4004 · Transacção expirada",
    "9000": "9000 · Erro desconhecido",
  };
  return reasons[code] ?? (code ? `Código WiPay: ${code}` : "Pagamento rejeitado");
}
