import { NextResponse } from "next/server";
import {
  getOrder,
  isKitadiReference,
  PaymentLedgerNotMigratedError,
} from "../../../../lib/payments/orders";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  if (!isKitadiReference(reference)) {
    return NextResponse.json({ error: "invalid_reference" }, { status: 400 });
  }

  let order;
  try {
    order = await getOrder(reference);
  } catch (error) {
    if (error instanceof PaymentLedgerNotMigratedError) {
      return NextResponse.json(
        { error: "payment_ledger_not_configured" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "payment_status_unavailable" },
      { status: 503 },
    );
  }
  if (!order) {
    return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      reference: order.reference,
      status: order.status,
      amountKz: order.amountKz,
      ticket: order.status === "accepted" ? {
        customerName: order.name,
        productTitle: order.productTitle,
        edition: order.edition,
        variantLabel: order.variantLabel,
        paidAt: order.paidAt,
        amountKz: order.amountKz,
      } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
