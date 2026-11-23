import { NextResponse, type NextRequest } from "next/server";
import { studentDiscountEnabled, verifyStudentCode } from "../../../../lib/students-server";

export async function POST(request: NextRequest) {
  if (!studentDiscountEnabled()) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 1024) return NextResponse.json({ error: "Pedido inválido." }, { status: 413 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  if (typeof body !== "object" || body === null || !("id" in body) || !("code" in body) ||
      typeof body.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id) ||
      typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) {
    return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  }
  try {
    const verified = await verifyStudentCode(body.id, body.code);
    if (!verified) return NextResponse.json({ error: "Código inválido ou expirado. Solicite outro se necessário." }, { status: 400 });
    return NextResponse.json(verified, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[students] code confirmation failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Não foi possível confirmar o código. Tente mais tarde." }, { status: 503 });
  }
}
