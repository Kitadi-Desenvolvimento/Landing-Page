import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, readAdminJson, readText } from "../../../../lib/backoffice-request";
import { voidExpense } from "../../../../lib/finance";
import { PaymentLedgerNotMigratedError, PeriodClosedError } from "../../../../lib/payments/orders";

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
  if (!reason) return errorResponse("invalid_action", 400);

  try {
    const expense = await voidExpense(id, reason, user.id);
    if (!expense) return errorResponse("expense_not_found_or_voided", 409);
    return NextResponse.json(
      { id: expense.id, status: expense.status },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PeriodClosedError) return errorResponse("period_closed", 409);
    if (error instanceof PaymentLedgerNotMigratedError) {
      return errorResponse("ledger_not_migrated", 503);
    }
    console.error("[backoffice] expense update failed", { id });
    return errorResponse("expense_update_failed", 503);
  }
}
