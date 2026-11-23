import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, readAdminJson, readText } from "../../../../lib/backoffice-request";
import { PaymentLedgerNotMigratedError, PeriodClosedError } from "../../../../lib/payments/orders";
import { setWithdrawalReconciled, voidWithdrawal } from "../../../../lib/payments/withdrawals";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = await readAdminJson(request);
  if (!parsed.ok) return parsed.response;
  const { body, user } = parsed;

  const { id } = await params;
  if (!uuidPattern.test(id)) return errorResponse("invalid_id", 400);

  const reason = readText(body.voidReason, 200);
  const wantsVoid = "voidReason" in body;
  const wantsReconcile = typeof body.reconciled === "boolean";
  if (wantsVoid === wantsReconcile || (wantsVoid && !reason)) {
    return errorResponse("invalid_action", 400);
  }

  try {
    const withdrawal = wantsVoid
      ? await voidWithdrawal(id, reason as string, user.id)
      : await setWithdrawalReconciled(id, body.reconciled as boolean, user.id);
    if (!withdrawal) return errorResponse("withdrawal_not_found_or_voided", 409);

    return NextResponse.json(
      { id: withdrawal.id, status: withdrawal.status, reconciledAt: withdrawal.reconciledAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PaymentLedgerNotMigratedError) {
      return errorResponse("ledger_not_migrated", 503);
    }
    if (error instanceof PeriodClosedError) return errorResponse("period_closed", 409);
    console.error("[backoffice] withdrawal update failed", { id });
    return errorResponse("withdrawal_update_failed", 503);
  }
}
