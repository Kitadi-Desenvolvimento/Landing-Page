import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, readAdminJson, readAmountKz } from "../../../../lib/backoffice-request";
import { isValidMonth, PeriodRuleError, updateRecurringExpense } from "../../../../lib/finance";
import { PaymentLedgerNotMigratedError } from "../../../../lib/payments/orders";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = await readAdminJson(request);
  if (!parsed.ok) return parsed.response;
  const { body } = parsed;

  const { id } = await params;
  if (!uuidPattern.test(id)) return errorResponse("invalid_id", 400);

  const wantsAmount = "amountKz" in body;
  const wantsEnd = "endMonth" in body;
  const amountKz = readAmountKz(body.amountKz);
  const endMonth = body.endMonth === null ? null : isValidMonth(body.endMonth) ? body.endMonth : undefined;
  if (wantsAmount === wantsEnd || (wantsAmount && !amountKz) || (wantsEnd && endMonth === undefined)) {
    return errorResponse("invalid_action", 400);
  }

  try {
    const recurring = await updateRecurringExpense(
      id,
      wantsAmount ? { amountKz: amountKz as number } : { endMonth: endMonth as string | null },
    );
    if (!recurring) return errorResponse("recurring_not_found", 404);
    return NextResponse.json({ id: recurring.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PeriodRuleError) return errorResponse(error.code, 409);
    if (error instanceof PaymentLedgerNotMigratedError) {
      return errorResponse("ledger_not_migrated", 503);
    }
    console.error("[backoffice] recurring update failed", { id });
    return errorResponse("recurring_failed", 503);
  }
}
