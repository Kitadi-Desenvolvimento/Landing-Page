import { NextResponse } from "next/server";
import { getProductEbook } from "../../../../lib/ebooks";
import { getProductBySlugForDelivery } from "../../../../lib/products";
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

  let ebook: { downloaded: boolean } | null = null;
  if (order.status === "accepted") {
    try {
      const product = await getProductBySlugForDelivery(order.courseSlug);
      if (getProductEbook(product?.data)) {
        ebook = { downloaded: Boolean(order.ebookDownloadedAt) };
      }
    } catch {
      // Sem catálogo, mostra-se apenas a confirmação do pagamento.
    }
  }

  return NextResponse.json(
    {
      reference: order.reference,
      status: order.status,
      amountKz: order.amountKz,
      ticket: order.status === "accepted" ? {
        customerName: order.name,
        customerEmail: order.email,
        productTitle: order.productTitle,
        edition: order.edition,
        variantLabel: order.variantLabel,
        paidAt: order.paidAt,
        amountKz: order.amountKz,
      } : null,
      ebook,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
