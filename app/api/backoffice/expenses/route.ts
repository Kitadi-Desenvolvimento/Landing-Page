import { NextResponse, type NextRequest } from "next/server";
import {
  errorResponse,
  readAdminJson,
  readAmountKz,
  readEntryDay,
  readText,
} from "../../../lib/backoffice-request";
import { expenseCategories } from "../../../lib/expense-categories";
import { createExpense } from "../../../lib/finance";
import { PaymentLedgerNotMigratedError, PeriodClosedError } from "../../../lib/payments/orders";

export async function POST(request: NextRequest) {
  const parsed = await readAdminJson(request);
  if (!parsed.ok) return parsed.response;
  const { body, user } = parsed;

  const spentOn = readEntryDay(body.spentOn);
  const category = expenseCategories.find((item) => item.id === body.category)?.id;
  const supplier = readText(body.supplier, 120);
  const description = readText(body.description, 300);
  const amountKz = readAmountKz(body.amountKz);
  const proofReference = typeof body.proofReference === "string" && body.proofReference.trim()
    ? readText(body.proofReference, 80)
    : null;

  if (
    !spentOn ||
    !category ||
    !supplier ||
    !description ||
    !amountKz ||
    (body.proofReference && !proofReference)
  ) {
    return errorResponse("invalid_expense", 400);
  }

  try {
    const expense = await createExpense({
      spentOn,
      category,
      supplier,
      description,
      amountKz,
      proofReference,
      createdBy: user.id,
    });
    return NextResponse.json({ id: expense.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PeriodClosedError) return errorResponse("period_closed", 409);
    if (error instanceof PaymentLedgerNotMigratedError) {
      return errorResponse("ledger_not_migrated", 503);
    }
    console.error("[backoffice] expense failed", error instanceof Error ? error.message : "unknown");
    return errorResponse("expense_failed", 503);
  }
}
