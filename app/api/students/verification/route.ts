import { NextResponse, type NextRequest } from "next/server";
import { startStudentVerification, studentDiscountEnabled } from "../../../lib/students-server";

export async function POST(request: NextRequest) {
  if (!studentDiscountEnabled()) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 1024) return NextResponse.json({ error: "Pedido inválido." }, { status: 413 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  const identifier = typeof body === "object" && body !== null && "identifier" in body && typeof body.identifier === "string" ? body.identifier.trim() : "";
  if (!identifier || identifier.length > 254 || !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier) || /^\+?[0-9 ()-]{9,24}$/.test(identifier))) {
    return NextResponse.json({ error: "Indique um email ou telefone válido." }, { status: 400 });
  }
  try {
    const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const id = await startStudentVerification(identifier, ip);
    if (!id) return NextResponse.json({ error: "Aguarde antes de pedir outro código." }, { status: 429 });
    return NextResponse.json({ id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[students] verification request failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Não foi possível enviar o código. Tente mais tarde." }, { status: 503 });
  }
}
