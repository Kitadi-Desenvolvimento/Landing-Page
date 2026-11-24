import { NextResponse } from "next/server";
import { offersPublicCheckout } from "../../../course-data";
import { getPublishedProductBySlug } from "../../../lib/products";
import { newKitadiReference, saveOrder, updateOrder } from "../../../lib/payments/orders";
import { studentDiscountedAmount, studentDiscountPercent } from "../../../lib/student-discount";
import { getVerifiedStudent } from "../../../lib/students-server";
import {
  createWipayHostedPayment,
  ensureWipaySignatureToken,
  isWipayConfigured,
  WipayError,
} from "../../../lib/payments/wipay";

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
  let name = readString(body.name, 120);
  let email = readString(body.email, 254);
  let phone = readString(body.phone, 24);
  const companyName = typeof body.companyName === "string"
    ? body.companyName.trim()
    : "";
  const analyticsSessionId =
    typeof body.analyticsSessionId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.analyticsSessionId)
      ? body.analyticsSessionId
      : null;
  const product = courseSlug
    ? await getPublishedProductBySlug(courseSlug)
    : undefined;
  const course = product?.data.course;
  const variant = course
    ? variantId
      ? course.variants.find((item) => item.id === variantId)
      : course.variants[0]
    : undefined;
  const originalAmountKz = course
    ? variant?.priceAmount
    : product?.data.priceAmount;
  let amountKz = originalAmountKz;
  let discountPercent: number | null = null;

  if (body.studentToken !== undefined) {
    if (typeof body.studentToken !== "string") {
      return NextResponse.json({ error: "Verificação de aluno inválida." }, { status: 400 });
    }
    try {
      const studentVerified = await getVerifiedStudent(body.studentToken);
      if (!studentVerified) return NextResponse.json({ error: "A verificação de aluno expirou. Confirme novamente." }, { status: 401 });
      if (amountKz !== undefined) {
        discountPercent = studentDiscountPercent(amountKz);
        amountKz = studentDiscountedAmount(amountKz);
      }
    } catch (error) {
      console.error("[payments] student verification failed", error instanceof Error ? error.message : "unknown");
      return NextResponse.json({ error: "Não foi possível verificar o desconto de aluno." }, { status: 503 });
    }
  }

  if (
    !product ||
    !offersPublicCheckout(product.data) ||
    amountKz === undefined ||
    !Number.isSafeInteger(amountKz) ||
    (course !== null && course !== undefined && !variant) ||
    (!course && variantId !== null) ||
    !name ||
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !phone ||
    !/^\+?[0-9 ]{9,17}$/.test(phone) ||
    companyName.length > 160 ||
    (body.companyName !== undefined && typeof body.companyName !== "string")
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

  try {
    await ensureWipaySignatureToken();
  } catch (error) {
    const code = error instanceof WipayError ? error.code : "signature_token_cache_unavailable";
    console.error("[payments] could not prepare WiPay callback verification", { code });
    return NextResponse.json(
      { error: "Não foi possível preparar a confirmação segura do pagamento." },
      { status: 503 },
    );
  }

  const reference = newKitadiReference();
  const now = new Date().toISOString();
  try {
    await saveOrder({
      reference,
      amountKz,
      originalAmountKz: discountPercent === null ? null : originalAmountKz,
      studentDiscountPercent: discountPercent,
      courseSlug: product.slug,
      productTitle: product.data.title,
      variantId: variant?.id ?? "default",
      variantLabel: variant?.label ?? "Compra",
      edition: product?.data.edition?.trim() || null,
      name,
      email,
      phone: phone.replace(/\s+/g, ""),
      customerCompany: companyName || null,
      status: "pending",
      paymentProvider: "wipay",
      paymentMethod: null,
      providerStatus: null,
      providerTransactionId: null,
      reason: null,
      createdAt: now,
      updatedAt: now,
      paidAt: null,
      checkedIn: false,
      checkedInAt: null,
      checkedInBy: null,
      analyticsSessionId,
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
      amountKz,
      customer: phone.replace(/\s+/g, ""),
      reference,
      successUrl: `${origin}/checkout/retorno?status=success&reference=${reference}`,
      failureUrl: `${origin}/checkout/retorno?status=error&reference=${reference}`,
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
      amount: amountKz,
      currency: "AOA",
      expiresAt: null,
    },
    { status: 201 },
  );
}
