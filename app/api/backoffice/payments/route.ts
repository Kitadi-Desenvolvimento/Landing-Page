import { NextResponse, type NextRequest } from "next/server";
import {
  errorResponse,
  readAdminJson,
  readAmountKz,
  readText,
  resolveEntryDate,
} from "../../../lib/backoffice-request";
import { getProductBySlugForDelivery } from "../../../lib/products";
import {
  createManualOrder,
  manualPaymentMethods,
  PaymentLedgerNotMigratedError,
  PeriodClosedError,
} from "../../../lib/payments/orders";

export async function POST(request: NextRequest) {
  const parsed = await readAdminJson(request, 4096);
  if (!parsed.ok) return parsed.response;
  const { body, user } = parsed;

  const courseSlug = readText(body.courseSlug, 100);
  const variantId = typeof body.variantId === "string" ? body.variantId : null;
  const amountKz = readAmountKz(body.amountKz);
  const name = readText(body.name, 120);
  const email = readText(body.email, 254);
  const phone = typeof body.phone === "string" ? body.phone.trim().replace(/\s+/g, "") : "";
  const method = manualPaymentMethods.find((item) => item === body.method);
  const providerReference = typeof body.providerReference === "string" && body.providerReference.trim()
    ? readText(body.providerReference, 80)
    : null;
  const paidAt = resolveEntryDate(body.paidAt);

  if (
    !courseSlug ||
    !amountKz ||
    !name ||
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    (phone && !/^\+?[0-9]{9,17}$/.test(phone)) ||
    !method ||
    (body.providerReference && !providerReference) ||
    !paidAt
  ) {
    return errorResponse("invalid_payment", 400);
  }

  try {
    const product = await getProductBySlugForDelivery(courseSlug);
    if (!product) return errorResponse("product_not_found", 404);

    const variants = product.data.course?.variants ?? [];
    const variant = variants.length
      ? variants.find((item) => item.id === variantId)
      : undefined;
    if (variants.length && !variant) return errorResponse("invalid_variant", 400);

    const order = await createManualOrder({
      product: {
        slug: product.slug,
        title: product.data.title,
        edition: product.data.edition?.trim() || null,
      },
      variant: variant
        ? { id: variant.id, label: variant.label }
        : { id: "default", label: "Compra" },
      amountKz,
      name,
      email,
      phone,
      method,
      providerReference,
      paidAt,
      createdBy: user.id,
    });

    return NextResponse.json(
      { reference: order.reference },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PaymentLedgerNotMigratedError) {
      return errorResponse("ledger_not_migrated", 503);
    }
    if (error instanceof PeriodClosedError) return errorResponse("period_closed", 409);
    console.error("[backoffice] manual payment failed", error instanceof Error ? error.message : "unknown");
    return errorResponse("manual_payment_failed", 503);
  }
}
