import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";
import { canManageArea, requireBackofficeUser } from "../../../../../lib/supabase/require-admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (request.headers.get("origin") !== request.nextUrl.origin ||
      !request.headers.get("content-type")?.startsWith("application/json") ||
      Number(request.headers.get("content-length") ?? 0) > 1024) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const authorization = await requireBackofficeUser();
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.reason === "unauthenticated" ? "unauthorized" :
        authorization.reason === "unavailable" ? "area_access_unavailable" : "forbidden" },
      { status: authorization.reason === "unauthenticated" ? 401 :
        authorization.reason === "unavailable" ? 503 : 403 },
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
      !("archived" in payload) || typeof payload.archived !== "boolean") {
    return NextResponse.json({ error: "invalid_archive_state" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: objective, error: loadError } = await admin
    .from("objectives")
    .select("area_id")
    .eq("id", id)
    .maybeSingle();
  if (loadError) {
    console.error("[backoffice] objective archive lookup failed", loadError.code);
    return NextResponse.json({ error: "objective_unavailable" }, { status: 503 });
  }
  if (!objective) return NextResponse.json({ error: "objective_not_found" }, { status: 404 });
  if (!canManageArea(authorization, objective.area_id)) {
    return NextResponse.json({ error: "area_forbidden" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("objectives")
    .update({ archived: payload.archived, updated_by: authorization.user.id })
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    console.error("[backoffice] objective archive update failed", error.code);
    return NextResponse.json({ error: "objective_archive_failed" }, { status: 503 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
