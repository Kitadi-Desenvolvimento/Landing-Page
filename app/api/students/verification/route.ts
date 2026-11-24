import { NextResponse, type NextRequest } from "next/server";
import {
  CeuApiError,
  CeuRateLimitError,
  studentDiscountEnabled,
  verifyCeuStudentCard,
} from "../../../lib/students-server";

export async function POST(request: NextRequest) {
  if (!studentDiscountEnabled()) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 1024) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const cardNumber =
    typeof body === "object" &&
    body !== null &&
    "cardNumber" in body &&
    typeof body.cardNumber === "string"
      ? body.cardNumber.trim()
      : "";
  if (!cardNumber || cardNumber.length > 128) {
    return NextResponse.json({ error: "Indique um número de cartão CEU válido." }, { status: 400 });
  }

  try {
    const verified = await verifyCeuStudentCard(cardNumber);
    if (!verified) {
      return NextResponse.json(
        { error: "Estudante não encontrado." },
        { status: 404 },
      );
    }
    return NextResponse.json(verified, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof CeuRateLimitError) {
      return NextResponse.json(
        { error: "Limite de pedidos excedido. Aguarde antes de tentar novamente." },
        { status: 429 },
      );
    }
    if (error instanceof CeuApiError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: "Limite de pedidos excedido. Aguarde antes de tentar novamente." },
          { status: 429 },
        );
      }
      console.error("[students] CEU API request failed", error.status);
    } else {
      console.error(
        "[students] CEU validation failed",
        error instanceof Error ? error.message : "unknown",
      );
    }
    return NextResponse.json(
      { error: "Não foi possível validar o cartão CEU. Tente mais tarde." },
      { status: 503 },
    );
  }
}
