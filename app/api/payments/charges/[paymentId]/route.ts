import { NextResponse } from "next/server";
import { courses } from "../../../../course-data";

const apiBaseUrl = "https://api.bluelemon.ao/v1";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getCourseFromOrderId(orderId: string) {
  return courses.find((course) => orderId.startsWith(`KITADI-${course.slug}-`));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const { paymentId } = await params;
  if (!uuidPattern.test(paymentId)) {
    return NextResponse.json(
      { error: "O identificador do pagamento é inválido." },
      { status: 400 },
    );
  }

  const apiKey = process.env.BLUELEMON_API_KEY_SECRET;
  if (!apiKey) {
    console.error("Blue Lemon API key is not configured.");
    return NextResponse.json(
      { error: "O serviço de pagamentos ainda não está configurado." },
      { status: 503 },
    );
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error(
      "Blue Lemon payment status request failed.",
      error instanceof Error ? error.message : "Unknown network error",
    );
    return NextResponse.json(
      { error: "Não foi possível consultar o estado do pagamento." },
      { status: 502 },
    );
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    console.error(
      `Blue Lemon returned an invalid status response (HTTP ${response.status}).`,
    );
    return NextResponse.json(
      { error: "O serviço de pagamentos devolveu uma resposta inválida." },
      { status: 502 },
    );
  }

  if (!response.ok || !isRecord(result)) {
    console.error(
      `Blue Lemon payment status request failed with HTTP ${response.status}.`,
    );
    return NextResponse.json(
      { error: "Não foi possível consultar o estado do pagamento." },
      { status: response.status === 404 ? 404 : 502 },
    );
  }

  const orderId =
    typeof result.merchant_order_id === "string"
      ? result.merchant_order_id
      : "";
  const course = getCourseFromOrderId(orderId);
  const orderIdSuffix = course
    ? orderId.slice(`KITADI-${course.slug}-`.length)
    : "";
  const amountMinor = Number(result.amount_minor);
  const status =
    typeof result.status === "string" ? result.status : "";
  const expiresAt =
    typeof result.expires_at === "string" ? result.expires_at : null;

  if (
    result.id !== paymentId ||
    !course ||
    !uuidPattern.test(orderIdSuffix) ||
    !Number.isSafeInteger(amountMinor) ||
    amountMinor !== course.priceAmount * 100 ||
    result.currency !== "AOA" ||
    ![
      "requires_method",
      "pending_confirmation",
      "succeeded",
      "failed",
      "expired",
      "canceled",
      "refunded",
    ].includes(status)
  ) {
    console.error("Blue Lemon returned mismatched payment status data.");
    return NextResponse.json(
      { error: "Os dados do pagamento devolvidos não correspondem à ordem." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    chargeId: paymentId,
    status:
      status === "succeeded"
        ? "paid"
        : status === "failed" ||
            status === "expired" ||
            status === "canceled" ||
            status === "refunded"
          ? status
          : "pending",
    amount: course.priceAmount,
    currency: "AOA",
    expiresAt,
  });
}
