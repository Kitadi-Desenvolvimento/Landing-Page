import { NextResponse, type NextRequest } from "next/server";
import {
  errorResponse,
  readAdminJson,
  readAmountKz,
  readText,
} from "../../../lib/backoffice-request";
import { expenseCategories } from "../../../lib/expense-categories";
import { createRecurringExpense, isValidMonth } from "../../../lib/finance";
import { PaymentLedgerNotMigratedError } from "../../../lib/payments/orders";

export async function POST(request: NextRequest) {
  const parsed = await readAdminJson(request);
  if (!parsed.ok) return parsed.response;
  const { body, user } = parsed;

  const category = expenseCategories.find((item) => item.id === body.category)?.id;
  const supplier = readText(body.supplier, 120);
  const description = readText(body.description, 300);
  const amountKz = readAmountKz(body.amountKz);
  const dayOfMonth = body.dayOfMonth;
  const startMonth = body.startMonth;

  if (
    !category ||
    !supplier ||
    !description ||
    !amountKz ||
    typeof dayOfMonth !== "number" ||
    !Number.isInteger(dayOfMonth) ||
    dayOfMonth < 1 ||
    dayOfMonth > 31 ||
    !isValidMonth(startMonth)
  ) {
    return errorResponse("invalid_recurring", 400);
  }

  try {
    const recurring = await createRecurringExpense({
      category,
      supplier,
      description,
      amountKz,
      dayOfMonth,
      startMonth,
      createdBy: user.id,
    });
    return NextResponse.json({ id: recurring.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PaymentLedgerNotMigratedError) {
      return errorResponse("ledger_not_migrated", 503);
    }
    console.error("[backoffice] recurring expense failed", error instanceof Error ? error.message : "unknown");
    return errorResponse("recurring_failed", 503);
  }
}
