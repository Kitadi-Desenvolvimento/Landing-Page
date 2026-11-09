import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { courses } from "../../../course-data";

const apiBaseUrl = "https://api.bluelemon.ao/v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim().length <= maxLength
    ? value.trim()
    : null;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16_384) {
    return NextResponse.json(
      { error: "O pedido excede o tamanho permitido." },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "O corpo do pedido não contém JSON válido." },
      { status: 400 },
    );
  }

  if (!isRecord(body)) {
    return NextResponse.json(
      { error: "Os dados da inscrição são inválidos." },
      { status: 400 },
    );
  }

  const courseSlug = readString(body.courseSlug, 100);
  const name = readString(body.name, 120);
  const email = readString(body.email, 254);
  const phone = readString(body.phone, 24);
  const course = courses.find((item) => item.slug === courseSlug);

  if (
    !course ||
    !name ||
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !phone ||
    !/^\+?[0-9 ]{9,17}$/.test(phone)
  ) {
    return NextResponse.json(
      { error: "Verifique o curso e os dados de contacto antes de continuar." },
      { status: 400 },
    );
  }
  const normalizedPhone = phone.replace(/\s+/g, "");

  const apiKey = process.env.BLUELEMON_API_KEY_SECRET;
  if (!apiKey) {
    console.error("Blue Lemon API key is not configured.");
    return NextResponse.json(
      { error: "O serviço de pagamentos ainda não está configurado." },
      { status: 503 },
    );
  }

  const baseUrl = process.env.BLUELEMON_API_BASE_URL ?? apiBaseUrl;
  if (baseUrl !== apiBaseUrl) {
    console.error("Only the configured Blue Lemon API endpoint is enabled.");
    return NextResponse.json(
      { error: "A configuração do serviço de pagamentos é inválida." },
      { status: 500 },
    );
  }

  const customId = `KITADI-${course.slug}-${randomUUID()}`;

  let providerResponse: Response;
  try {
    providerResponse = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount_minor: course.priceAmount * 100,
        merchant_order_id: customId,
        currency: "AOA",
        description: `Inscrição — ${course.title}`,
        expiry_days: 3,
        customer: {
          name,
          email,
          phone: normalizedPhone,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error(
      "Blue Lemon charge request failed.",
      error instanceof Error ? error.message : "Unknown network error",
    );
    return NextResponse.json(
      { error: "Não foi possível contactar o serviço de pagamentos. Tente novamente." },
      { status: 502 },
    );
  }

  let providerBody: unknown;
  try {
    providerBody = await providerResponse.json();
  } catch {
    console.error(
      `Blue Lemon returned an invalid response (HTTP ${providerResponse.status}).`,
    );
    return NextResponse.json(
      { error: "O serviço de pagamentos devolveu uma resposta inválida." },
      { status: 502 },
    );
  }

  if (!providerResponse.ok || !isRecord(providerBody)) {
    console.error(
      `Blue Lemon charge request failed with HTTP ${providerResponse.status}.`,
    );
    return NextResponse.json(
      { error: "Não foi possível criar a cobrança. Tente novamente." },
      { status: 502 },
    );
  }

  const providerPayment = isRecord(providerBody.payment)
    ? providerBody.payment
    : null;
  const paymentId = providerPayment
    ? readString(providerPayment.id, 100)
    : null;
  const merchantOrderId = providerPayment
    ? readString(providerPayment.merchant_order_id, 100)
    : null;
  const amountMinor = providerPayment
    ? Number(providerPayment.amount_minor)
    : Number.NaN;
  const currency = providerPayment?.currency;
  const expiresAt = providerPayment
    ? readString(providerPayment.expires_at, 100)
    : null;
  const providerStatus =
    typeof providerPayment?.status === "string"
      ? providerPayment.status
      : "";
  const checkoutUrl = readString(providerBody.checkout_url, 2048);
  let validCheckoutUrl = false;
  if (checkoutUrl) {
    try {
      const url = new URL(checkoutUrl);
      validCheckoutUrl =
        url.protocol === "https:" &&
        url.hostname === "checkout.bluelemon.ao";
    } catch {
      validCheckoutUrl = false;
    }
  }

  if (
    !paymentId ||
    merchantOrderId !== customId ||
    !Number.isSafeInteger(amountMinor) ||
    amountMinor !== course.priceAmount * 100 ||
    currency !== "AOA" ||
    providerStatus !== "requires_method" ||
    !validCheckoutUrl ||
    (expiresAt !== null && Number.isNaN(Date.parse(expiresAt)))
  ) {
    console.error("Blue Lemon returned an incomplete or mismatched payment.");
    return NextResponse.json(
      { error: "A cobrança devolvida pelo serviço não pôde ser validada." },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      customId,
      chargeId: paymentId,
      status: "pending",
      checkoutUrl,
      entity: null,
      reference: null,
      amount: course.priceAmount,
      currency,
      expiresAt,
    },
    { status: 201 },
  );
}
