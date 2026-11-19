import { after, NextResponse, type NextRequest } from "next/server";
import {
  cleanupExpiredDeliveries,
  createEbookDelivery,
  EbookError,
  getProductEbook,
} from "../../../../../lib/ebooks";
import {
  claimEbookDownload,
  getOrder,
  isKitadiReference,
  PaymentLedgerNotMigratedError,
  releaseEbookDownload,
} from "../../../../../lib/payments/orders";
import { getProductBySlugForDelivery } from "../../../../../lib/products";

export const maxDuration = 60;

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Entrega única do e-book comprado: gera a cópia protegida com
 * palavra-passe (o email do comprador) e devolve um link temporário.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return jsonError("invalid_origin", 403);
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
    if (order.ebookDownloadedAt) return jsonError("already_downloaded", 410);

    const claimed = await claimEbookDownload(order.reference);
    if (!claimed?.ebookDownloadedAt) return jsonError("already_downloaded", 410);

    try {
      after(cleanupExpiredDeliveries);
      const url = await createEbookDelivery({
        reference: claimed.reference,
        email: claimed.email,
        ebook,
      });
      console.info("[ebooks] ebook delivered", { reference: claimed.reference });
      return NextResponse.json(
        { url },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      // A cópia não foi gerada: o cliente pode voltar a tentar.
      await releaseEbookDownload(claimed.reference, claimed.ebookDownloadedAt).catch(
        () => undefined,
      );
      throw error;
    }
  } catch (error) {
    if (error instanceof PaymentLedgerNotMigratedError) {
      return jsonError("ebook_delivery_not_configured", 503);
    }
    if (error instanceof EbookError) {
      console.error("[ebooks] delivery failed", { reference, code: error.code });
      return jsonError(error.code, 503);
    }
    console.error("[ebooks] delivery failed", { reference });
    return jsonError("ebook_delivery_unavailable", 503);
  }
}
