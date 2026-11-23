import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, readAdminJson, readText } from "../../../../lib/backoffice-request";
import { closePeriod, isValidMonth, PeriodRuleError, reopenPeriod } from "../../../../lib/finance";
import { PaymentLedgerNotMigratedError } from "../../../../lib/payments/orders";

export async function POST(request: NextRequest) {
  const parsed = await readAdminJson(request);
  if (!parsed.ok) return parsed.response;
  const { body, user } = parsed;

  const month = body.month;
  const action = body.action;
  const reason = readText(body.reason, 200);
  if (!isValidMonth(month) || (action !== "close" && action !== "reopen") || (action === "reopen" && !reason)) {
    return errorResponse("invalid_action", 400);
  }

  try {
    if (action === "close") await closePeriod(month, user.id);
    else await reopenPeriod(month, reason as string, user.id);
    return NextResponse.json({ month, action }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PeriodRuleError) return errorResponse(error.code, 409);
    if (error instanceof PaymentLedgerNotMigratedError) {
      return errorResponse("ledger_not_migrated", 503);
    }
    console.error("[backoffice] period closure failed", error instanceof Error ? error.message : "unknown");
    return errorResponse("closure_failed", 503);
  }
}
