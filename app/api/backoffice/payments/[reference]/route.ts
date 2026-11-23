import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, readAdminJson, readText } from "../../../../lib/backoffice-request";
import {
  isKitadiReference,
  PaymentLedgerNotMigratedError,
  PeriodClosedError,
  refundManualOrder,
  setOrderReconciled,
} from "../../../../lib/payments/orders";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  const parsed = await readAdminJson(request);
  if (!parsed.ok) return parsed.response;
  const { body, user } = parsed;

  const { reference } = await params;
  if (!isKitadiReference(reference)) return errorResponse("invalid_reference", 400);

  const reason = readText(body.refundReason, 200);
  const wantsRefund = "refundReason" in body;
  const wantsReconcile = typeof body.reconciled === "boolean";
  if (wantsRefund === wantsReconcile || (wantsRefund && !reason)) {
    return errorResponse("invalid_action", 400);
  }

  try {
    const order = wantsRefund
      ? await refundManualOrder(reference, reason as string, user.id)
      : await setOrderReconciled(reference, body.reconciled as boolean, user.id);
    if (!order) return errorResponse("payment_not_found_or_not_accepted", 409);

    return NextResponse.json(
      { reference: order.reference, status: order.status, reconciledAt: order.reconciledAt ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PaymentLedgerNotMigratedError) {
      return errorResponse("ledger_not_migrated", 503);
    }
    if (error instanceof PeriodClosedError) return errorResponse("period_closed", 409);
    console.error("[backoffice] payment update failed", { reference });
    return errorResponse("payment_update_failed", 503);
  }
}
