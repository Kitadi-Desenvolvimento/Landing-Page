import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { requireAdmin } from "../../../lib/supabase/require-admin";

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function readPayload(request: NextRequest): Promise<Record<string, unknown> | null> {
  if (request.headers.get("origin") !== request.nextUrl.origin ||
      !request.headers.get("content-type")?.startsWith("application/json") ||
      Number(request.headers.get("content-length") ?? 0) > 4096) return null;
  try {
    const payload: unknown = await request.json();
    return typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const authorization = await requireAdmin();
  if (!authorization.authorized) {
    return errorResponse(authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden",
      authorization.reason === "unauthenticated" ? 401 : 403);
  }
  const payload = await readPayload(request);
  if (!payload || typeof payload.name !== "string" ||
      !payload.name.trim() || payload.name.trim().length > 120) {
    return errorResponse("invalid_area", 400);
  }
  const slug = slugify(payload.name);
  if (!slug) return errorResponse("invalid_area_name", 400);
  const { data, error } = await createSupabaseAdminClient()
    .from("objective_areas")
    .insert({ name: payload.name.trim(), slug, created_by: authorization.user.id })
    .select("*")
    .single();
  if (error) {
    console.error("[backoffice] objective area create failed", error.code);
    return errorResponse(error.code === "23505" ? "area_already_exists" : "area_create_failed",
      error.code === "23505" ? 409 : 503);
  }
  return NextResponse.json(data, { status: 201, headers: { "Cache-Control": "no-store" } });
}
