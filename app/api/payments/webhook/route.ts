import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { courses } from "../../../course-data";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function verifySignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
) {
  const fields = signatureHeader.split(",").map((field) => field.trim());
  const timestamps = fields
    .filter((field) => field.startsWith("t="))
    .map((field) => field.slice(2));
  const signatures = fields
    .filter((field) => field.startsWith("v1="))
    .map((field) => field.slice(3));

  if (
    timestamps.length !== 1 ||
    !/^\d+$/.test(timestamps[0]) ||
    signatures.length === 0 ||
    signatures.some((value) => !/^[\da-f]{64}$/i.test(value))
  ) {
    return false;
  }

  const timestamp = Number(timestamps[0]);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 300) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamps[0]}.${rawBody}`)
    .digest();

  return signatures.some((signature) => {
    const supplied = Buffer.from(signature, "hex");
    return (
      supplied.length === expected.length &&
      timingSafeEqual(supplied, expected)
    );
  });
}

export async function POST(request: Request) {
  const secret = process.env.BLUELEMON_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Blue Lemon webhook signing secret is not configured.");
    return NextResponse.json(
      { error: "O webhook de pagamentos ainda não está configurado." },
      { status: 503 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 32_768) {
    return NextResponse.json(
      { error: "O webhook excede o tamanho permitido." },
      { status: 413 },
    );
  }

  const rawBody = await request.text();
  if (rawBody.length > 32_768) {
    return NextResponse.json(
      { error: "O webhook excede o tamanho permitido." },
      { status: 413 },
    );
  }

  const signature = request.headers.get("x-bamboopay-signature");
  if (!signature || !verifySignature(rawBody, signature, secret)) {
    console.error("Blue Lemon webhook rejected: invalid signature.");
    return NextResponse.json(
      { error: "Assinatura do webhook inválida." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "O webhook não contém JSON válido." },
      { status: 400 },
    );
  }

  if (!isRecord(body) || !isRecord(body.data)) {
    return NextResponse.json(
      { error: "O envelope do webhook é inválido." },
      { status: 400 },
    );
  }

  const eventId = typeof body.id === "string" ? body.id : "";
  const eventType = typeof body.type === "string" ? body.type : "";
  if (
    !uuidPattern.test(eventId) ||
    !eventType ||
    typeof body.livemode !== "boolean"
  ) {
    return NextResponse.json(
      { error: "O envelope do evento é inválido." },
      { status: 400 },
    );
  }

  if (eventType !== "payment.succeeded") {
    return NextResponse.json({ received: true, ignored: true });
  }

  const data = body.data;
  const customId = typeof data.merchant_order_id === "string"
    ? data.merchant_order_id
    : "";
  const paymentId = typeof data.payment_id === "string" ? data.payment_id : "";
  const amountMinor = Number(data.amount_minor);
  const paidAt = typeof data.paid_at === "string" ? data.paid_at : "";
  const course = courses.find((item) =>
    customId.startsWith(`KITADI-${item.slug}-`),
  );
  const orderIdSuffix = course
    ? customId.slice(`KITADI-${course.slug}-`.length)
    : "";

  if (
    !course ||
    !uuidPattern.test(orderIdSuffix) ||
    data.environment !== (body.livemode ? "live" : "test") ||
    data.status !== "succeeded" ||
    !uuidPattern.test(paymentId) ||
    !Number.isSafeInteger(amountMinor) ||
    amountMinor !== course.priceAmount * 100 ||
    data.currency !== "AOA" ||
    !paidAt ||
    Number.isNaN(Date.parse(paidAt))
  ) {
    console.error("BambooPay webhook rejected: payment details do not match.");
    return NextResponse.json(
      { error: "Os dados do pagamento não correspondem à cobrança." },
      { status: 400 },
    );
  }

  return NextResponse.json({ received: true });
}
