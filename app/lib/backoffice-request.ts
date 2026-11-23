import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { requireAdmin } from "./supabase/require-admin";

type AdminJsonResult =
  | { ok: true; user: User; body: Record<string, unknown> }
  | { ok: false; response: NextResponse };

/** Valida origem, papel de administrador e corpo JSON de um pedido de escrita. */
export async function readAdminJson(
  request: NextRequest,
  maxBytes = 2048,
): Promise<AdminJsonResult> {
  const fail = (error: string, status: number) => ({
    ok: false as const,
    response: NextResponse.json({ error }, { status }),
  });

  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return fail("invalid_origin", 403);
  }

  const authorization = await requireAdmin();
  if (!authorization.authorized) {
    return authorization.reason === "unauthenticated"
      ? fail("unauthorized", 401)
      : fail("forbidden", 403);
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return fail("invalid_content_type", 415);
  }
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) {
    return fail("request_too_large", 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_json", 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return fail("invalid_body", 400);
  }

  return { ok: true, user: authorization.user, body: body as Record<string, unknown> };
}

export function readText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
}

export function readAmountKz(value: unknown) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= 1_000_000_000
    ? value
    : null;
}

/**
 * Converte uma data AAAA-MM-DD (hora de Luanda) num instante. Hoje usa a hora
 * actual; dias anteriores usam o meio-dia. Datas futuras são recusadas.
 */
export function resolveEntryDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Africa/Luanda" });
  if (value > today) return null;
  if (value === today) return new Date().toISOString();
  const instant = new Date(`${value}T12:00:00+01:00`);
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

/** Dia AAAA-MM-DD válido (hora de Luanda) que não seja futuro. */
export function readEntryDay(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Africa/Luanda" });
  return value <= today ? value : null;
}

export function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}
