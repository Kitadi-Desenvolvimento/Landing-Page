import { NextResponse, type NextRequest } from "next/server";
import {
  getAcceptedOrders,
  PaymentLedgerNotMigratedError,
} from "../../../lib/payments/orders";
import { requireAdmin } from "../../../lib/supabase/require-admin";

function isDate(value: string | null) {
  if (value === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function GET(request: NextRequest) {
  const authorization = await requireAdmin();
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden" },
      { status: authorization.reason === "unauthenticated" ? 401 : 403 },
    );
  }

  const params = request.nextUrl.searchParams;
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  const courseSlug = params.get("courseSlug")?.trim() ?? "";
  const edition = params.get("edition")?.trim() ?? "";
  if (
    !isDate(startDate) ||
    !isDate(endDate) ||
    (startDate && endDate && startDate > endDate) ||
    courseSlug.length > 100 ||
    edition.length > 120
  ) {
    return NextResponse.json({ error: "invalid_filters" }, { status: 400 });
  }

  try {
    const orders = await getAcceptedOrders({
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
      courseSlug: courseSlug || undefined,
      edition: edition || undefined,
    });

    return NextResponse.json(
      {
        attendees: orders.map((order) => ({
          reference: order.reference,
          name: order.name,
          email: order.email,
          phone: order.phone,
          courseSlug: order.courseSlug,
          productTitle: order.productTitle,
          edition: order.edition,
          variantLabel: order.variantLabel,
          amountKz: order.amountKz,
          paidAt: order.paidAt,
          checkedIn: order.checkedIn,
          checkedInAt: order.checkedInAt,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof PaymentLedgerNotMigratedError ? 503 : 500;
    return NextResponse.json(
      { error: status === 503 ? "payment_ledger_not_configured" : "attendees_unavailable" },
      { status },
    );
  }
}
