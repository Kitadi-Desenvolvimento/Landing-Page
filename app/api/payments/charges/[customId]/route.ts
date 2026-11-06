import { NextResponse } from "next/server";
import { getPayment } from "../../../../lib/payments";

type PaymentStatusRouteProps = {
  params: Promise<{ customId: string }>;
};

export async function GET(
  _request: Request,
  { params }: PaymentStatusRouteProps,
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "A consulta de pagamentos de teste não está ativa em produção." },
      { status: 503 },
    );
  }

  const { customId } = await params;
  const payment = getPayment(customId);

  if (!payment) {
    return NextResponse.json(
      { error: "A cobrança não existe nesta sessão de teste." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    customId: payment.customId,
    chargeId: payment.chargeId,
    status: payment.status,
    checkoutUrl: payment.checkoutUrl,
    entity: payment.entity,
    reference: payment.reference,
    amount: payment.amount,
    currency: "AOA",
    expiresAt: payment.expiresAt,
  });
}
