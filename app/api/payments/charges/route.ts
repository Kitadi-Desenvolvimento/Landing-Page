import { NextResponse } from "next/server";
import { offersCheckout } from "../../../course-data";
import { getPublishedCourseBySlug } from "../../../lib/products";
import { newKitadiReference, saveOrder, updateOrder } from "../../../lib/payments/orders";
import { createWipayHostedPayment, isWipayConfigured, WipayError } from "../../../lib/payments/wipay";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim().length <= maxLength
    ? value.trim()
    : null;
}

function siteOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostname = forwardedHost || new URL(request.url).hostname;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  if (hostname === "localhost" || hostname.endsWith("kitadi.co.ao")) {
    const localProtocol = hostname === "localhost" ? "http" : protocol;
    return `${localProtocol}://${hostname}`;
  }
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return configured ? configured.replace(/\/$/, "") : new URL(request.url).origin;
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
  const variantId = readString(body.variantId, 40);
  const name = readString(body.name, 120);
  const email = readString(body.email, 254);
  const phone = readString(body.phone, 24);
  const course = courseSlug
    ? await getPublishedCourseBySlug(courseSlug)
    : undefined;
  const variant = course
    ? variantId
      ? course.variants.find((item) => item.id === variantId)
      : course.variants[0]
    : undefined;

  if (
    !course ||
    !offersCheckout(course) ||
    !variant ||
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

  if (!isWipayConfigured()) {
    console.error("WiPay credentials are not configured.");
    return NextResponse.json(
      { error: "O serviço de pagamentos ainda não está configurado." },
      { status: 503 },
    );
  }

  const reference = newKitadiReference();
  const now = new Date().toISOString();
  try {
    await saveOrder({
      reference,
      amountKz: variant.priceAmount,
      courseSlug: course.slug,
      productTitle: course.title,
      variantId: variant.id,
      variantLabel: variant.label,
      name,
      email,
      phone: phone.replace(/\s+/g, ""),
      status: "pending",
      paymentProvider: "wipay",
      paymentMethod: null,
      providerStatus: null,
      providerTransactionId: null,
      reason: null,
      createdAt: now,
      updatedAt: now,
      paidAt: null,
    });
  } catch (error) {
    console.error(
      "[payments] could not persist order before checkout",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "Não foi possível registar o pagamento. Tente novamente." },
      { status: 503 },
    );
  }

  const origin = siteOrigin(request);
  let checkoutUrl: string;
  try {
    const payment = await createWipayHostedPayment({
      amountKz: variant.priceAmount,
      customer: email,
      reference,
      successUrl: `${origin}/checkout/retorno?reference=${reference}`,
      failureUrl: `${origin}/checkout/retorno?reference=${reference}`,
      callbackUrl: origin.startsWith("https://") ? `${origin}/api/webhooks/wipay` : undefined,
    });
    checkoutUrl = payment.checkoutUrl;
  } catch (error) {
    const code = error instanceof WipayError ? error.code : "unknown";
    console.error("WiPay hosted payment failed.", code);
    await updateOrder(reference, {
      status: "rejected",
      providerStatus: code,
      reason: code,
    });
    const status = code === "config_missing" ? 503 : 502;
    return NextResponse.json(
      {
        error:
          code === "config_missing"
            ? "O serviço de pagamentos ainda não está configurado."
            : "Não foi possível criar a cobrança. Tente novamente.",
      },
      { status },
    );
  }

  return NextResponse.json(
    {
      customId: reference,
      chargeId: reference,
      status: "pending",
      checkoutUrl,
      entity: null,
      reference,
      amount: variant.priceAmount,
      currency: "AOA",
      expiresAt: null,
    },
    { status: 201 },
  );
}
