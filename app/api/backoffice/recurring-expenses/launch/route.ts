import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, readAdminJson, readAmountKz } from "../../../../lib/backoffice-request";
import { isValidMonth, launchRecurringExpenses, PeriodRuleError } from "../../../../lib/finance";
import { PaymentLedgerNotMigratedError, PeriodClosedError } from "../../../../lib/payments/orders";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const parsed = await readAdminJson(request, 8192);
  if (!parsed.ok) return parsed.response;
  const { body, user } = parsed;

  const month = body.month;
  const rawItems = body.items;
  if (!isValidMonth(month) || !Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 100) {
    return errorResponse("invalid_launch", 400);
  }

  const items: { id: string; amountKz: number }[] = [];
  for (const item of rawItems) {
    const entry = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
    const amountKz = readAmountKz(entry.amountKz);
    if (typeof entry.id !== "string" || !uuidPattern.test(entry.id) || !amountKz) {
      return errorResponse("invalid_launch", 400);
    }
    items.push({ id: entry.id, amountKz });
  }

  try {
    const launched = await launchRecurringExpenses(month, items, user.id);
    return NextResponse.json({ launched }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PeriodClosedError) return errorResponse("period_closed", 409);
    if (error instanceof PeriodRuleError) return errorResponse(error.code, 409);
    if (error instanceof PaymentLedgerNotMigratedError) {
      return errorResponse("ledger_not_migrated", 503);
    }
    console.error("[backoffice] recurring launch failed", error instanceof Error ? error.message : "unknown");
    return errorResponse("recurring_failed", 503);
  }
}
