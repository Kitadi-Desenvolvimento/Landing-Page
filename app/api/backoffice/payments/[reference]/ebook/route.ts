import { after, NextResponse } from "next/server";
import {
  cleanupExpiredDeliveries,
  createEbookDelivery,
  EbookError,
  getProductEbook,
} from "../../../../../lib/ebooks";
import { getOrder, isKitadiReference } from "../../../../../lib/payments/orders";
import { getProductBySlugForDelivery } from "../../../../../lib/products";
import { requireAdmin } from "../../../../../lib/supabase/require-admin";

export const maxDuration = 60;

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Gera a cópia protegida do e-book de uma compra paga para a equipa enviar
 * ao cliente pelo WhatsApp. Não altera o estado do download do cliente.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const authorization = await requireAdmin();
  if (!authorization.authorized) {
    return jsonError(
      authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden",
      authorization.reason === "unauthenticated" ? 401 : 403,
    );
  }

  const { reference } = await params;
  if (!isKitadiReference(reference)) return jsonError("invalid_reference", 400);

  try {
    const order = await getOrder(reference);
    if (!order) return jsonError("payment_not_found", 404);
    if (order.status !== "accepted") return jsonError("payment_not_confirmed", 409);

    const product = await getProductBySlugForDelivery(order.courseSlug);
    const ebook = getProductEbook(product?.data);
    if (!ebook) return jsonError("not_an_ebook", 404);

    after(cleanupExpiredDeliveries);
    const url = await createEbookDelivery({
      reference: order.reference,
      email: order.email,
      ebook,
    });
    console.info("[ebooks] backoffice copy generated", {
      reference: order.reference,
      by: authorization.user.id,
    });
    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof EbookError ? error.code : "ebook_delivery_unavailable";
    console.error("[ebooks] backoffice copy failed", { reference, code });
    return jsonError(code, 503);
  }
}
