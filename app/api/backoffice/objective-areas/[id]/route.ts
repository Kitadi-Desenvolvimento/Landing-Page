import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { requireAdmin } from "../../../../lib/supabase/require-admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (request.headers.get("origin") !== request.nextUrl.origin ||
      !request.headers.get("content-type")?.startsWith("application/json") ||
      Number(request.headers.get("content-length") ?? 0) > 4096) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const authorization = await requireAdmin();
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden" },
      { status: authorization.reason === "unauthenticated" ? 401 : 403 },
    );
  }
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload) ||
      !("name" in payload) || typeof payload.name !== "string" ||
      !payload.name.trim() || payload.name.trim().length > 120 ||
      !("active" in payload) || typeof payload.active !== "boolean") {
    return NextResponse.json({ error: "invalid_area" }, { status: 400 });
  }
  const slug = payload.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) return NextResponse.json({ error: "invalid_area_name" }, { status: 400 });

  const { data, error } = await createSupabaseAdminClient()
    .from("objective_areas")
    .update({ name: payload.name.trim(), slug, active: payload.active })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[backoffice] objective area update failed", error.code);
    return NextResponse.json({ error: error.code === "23505" ? "area_already_exists" : "area_update_failed" },
      { status: error.code === "23505" ? 409 : 503 });
  }
  if (!data) return NextResponse.json({ error: "area_not_found" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
