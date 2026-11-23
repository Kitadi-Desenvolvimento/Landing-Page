import { NextResponse, type NextRequest } from "next/server";
import {
  errorResponse,
  readAdminJson,
  readAmountKz,
  readText,
  resolveEntryDate,
} from "../../../lib/backoffice-request";
import { PaymentLedgerNotMigratedError, PeriodClosedError } from "../../../lib/payments/orders";
import {
  createWithdrawal,
  DuplicateWithdrawalReferenceError,
} from "../../../lib/payments/withdrawals";

export async function POST(request: NextRequest) {
  const parsed = await readAdminJson(request);
  if (!parsed.ok) return parsed.response;
  const { body, user } = parsed;

  const amountKz = readAmountKz(body.amountKz);
  const providerReference = readText(body.providerReference, 80);
  const withdrawnAt = resolveEntryDate(body.withdrawnAt);
  if (!amountKz || !providerReference || !withdrawnAt) {
    return errorResponse("invalid_withdrawal", 400);
  }

  try {
    const withdrawal = await createWithdrawal({
      amountKz,
      withdrawnAt,
      providerReference,
      createdBy: user.id,
    });
    return NextResponse.json({ id: withdrawal.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DuplicateWithdrawalReferenceError) {
      return errorResponse("duplicate_reference", 409);
    }
    if (error instanceof PaymentLedgerNotMigratedError) {
      return errorResponse("ledger_not_migrated", 503);
    }
    if (error instanceof PeriodClosedError) return errorResponse("period_closed", 409);
    console.error("[backoffice] withdrawal failed", error instanceof Error ? error.message : "unknown");
    return errorResponse("withdrawal_failed", 503);
  }
}
