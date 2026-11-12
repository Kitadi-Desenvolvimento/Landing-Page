import { NextResponse } from "next/server";
import { getOrder, isKitadiReference } from "../../../../lib/payments/orders";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  if (!isKitadiReference(reference)) {
    return NextResponse.json({ error: "invalid_reference" }, { status: 400 });
  }

  const order = await getOrder(reference);
  if (!order) {
    return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    reference: order.reference,
    status: order.status,
    amountKz: order.amountKz,
  });
}
