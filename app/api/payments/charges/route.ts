import { NextResponse } from "next/server";
import { offersPublicCheckout } from "../../../course-data";
import { getPublishedProductBySlug } from "../../../lib/products";
import {
  CartLedgerNotReadyError,
  newKitadiReference,
  saveOrder,
  updateOrder,
  type CartItem,
} from "../../../lib/payments/orders";
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

const maxCartLines = 6;

type ChargeLine = {
  slug: string;
  title: string;
  variantId: string;
  variantLabel: string;
  edition: string | null;
  originalAmountKz: number;
  amountKz: number;
  discountPercent: number | null;
};

async function priceCheckoutLine(
  slug: string,
  variantId: string | null,
  applyStudentDiscount: boolean,
): Promise<ChargeLine | null> {
  const product = await getPublishedProductBySlug(slug);
  if (!product || !offersPublicCheckout(product.data)) return null;
  const course = product.data.course;
  const variant = course
    ? variantId
      ? course.variants.find((item) => item.id === variantId) ?? null
      : course.variants[0] ?? null
    : null;
  if (course && !variant) return null;
  if (!course && variantId !== null && variantId !== "default") return null;
  const originalAmountKz = course ? variant?.priceAmount : product.data.priceAmount;
  if (
    originalAmountKz === undefined ||
    !Number.isSafeInteger(originalAmountKz) ||
    originalAmountKz <= 0
  ) {
    return null;
  }
  return {
    slug: product.slug,
    title: product.data.title,
    variantId: variant?.id ?? "default",
    variantLabel: variant?.label ?? "Compra",
    edition: product.data.edition?.trim() || null,
    originalAmountKz,
    amountKz: applyStudentDiscount ? studentDiscountedAmount(originalAmountKz) : originalAmountKz,
    discountPercent: applyStudentDiscount ? studentDiscountPercent(originalAmountKz) : null,
  };
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

  const requestedItems = Array.isArray(body.items) ? body.items : null;
  const requests: { slug: string; variantId: string | null }[] = [];
  if (requestedItems) {
    if (requestedItems.length < 1 || requestedItems.length > maxCartLines) {
      return NextResponse.json(
        { error: "O carrinho precisa de ter entre 1 e 6 produtos." },
        { status: 400 },
      );
    }
    for (const item of requestedItems) {
      if (!isRecord(item)) {
        return NextResponse.json(
          { error: "Verifique os produtos do carrinho antes de continuar." },
          { status: 400 },
        );
      }
      const slug = readString(item.courseSlug, 100);
      if (!slug) {
        return NextResponse.json(
          { error: "Verifique os produtos do carrinho antes de continuar." },
          { status: 400 },
        );
      }
      requests.push({ slug, variantId: readString(item.variantId, 40) });
    }
  } else {
    const slug = readString(body.courseSlug, 100);
    if (!slug) {
      return NextResponse.json(
        { error: "Verifique o curso e os dados de contacto antes de continuar." },
        { status: 400 },
      );
    }
    requests.push({ slug, variantId: readString(body.variantId, 40) });
  }
  if (new Set(requests.map((item) => item.slug)).size !== requests.length) {
    return NextResponse.json(
      { error: "Cada produto entra uma vez no carrinho." },
      { status: 400 },
    );
  }

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
  let applyStudentDiscount = false;

  if (body.studentToken !== undefined) {
    if (typeof body.studentToken !== "string") {
      return NextResponse.json({ error: "Verificação de aluno inválida." }, { status: 400 });
    }
    try {
      const studentVerified = await getVerifiedStudent(body.studentToken);
      if (!studentVerified) return NextResponse.json({ error: "A verificação de aluno expirou. Confirme novamente." }, { status: 401 });
      applyStudentDiscount = true;
    } catch (error) {
      console.error("[payments] student verification failed", error instanceof Error ? error.message : "unknown");
      return NextResponse.json({ error: "Não foi possível verificar o desconto de aluno." }, { status: 503 });
    }
  }

  const lines: ChargeLine[] = [];
  for (const request of requests) {
    const line = await priceCheckoutLine(request.slug, request.variantId, applyStudentDiscount);
    if (!line) {
      return NextResponse.json(
        { error: "Verifique os produtos e os dados de contacto antes de continuar." },
        { status: 400 },
      );
    }
    lines.push(line);
  }
  const amountKz = lines.reduce((sum, line) => sum + line.amountKz, 0);
  const originalAmountKz = lines.reduce((sum, line) => sum + line.originalAmountKz, 0);
  const discountPercent = applyStudentDiscount && lines.every((line) => line.discountPercent === lines[0]?.discountPercent)
    ? lines[0]?.discountPercent ?? null
    : null;
  const first = lines[0];
  const cartItems: CartItem[] | undefined = lines.length > 1
    ? lines.map((line) => ({
      slug: line.slug,
      title: line.title,
      variantId: line.variantId,
      variantLabel: line.variantLabel,
      amountKz: line.amountKz,
    }))
    : undefined;
  const editions = [...new Set(lines.map((line) => line.edition))];

  if (
    !first ||
    !Number.isSafeInteger(amountKz) ||
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
      originalAmountKz: applyStudentDiscount ? originalAmountKz : null,
      studentDiscountPercent: discountPercent,
      courseSlug: first.slug,
      productTitle: lines.length === 1
        ? first.title
        : lines.map((line) => line.title).join(" + ").slice(0, 180),
      variantId: lines.length === 1 ? first.variantId : "carrinho",
      variantLabel: lines.length === 1 ? first.variantLabel : `${lines.length} itens`,
      edition: editions.length === 1 ? editions[0] : null,
      cartItems,
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
    if (error instanceof CartLedgerNotReadyError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
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
