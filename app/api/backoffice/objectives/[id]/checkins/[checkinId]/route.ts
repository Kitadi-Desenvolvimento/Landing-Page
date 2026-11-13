import { NextResponse, type NextRequest } from "next/server";
import { isRecord, isObjectiveValue } from "../../../../../../lib/objectives";
import { createSupabaseAdminClient } from "../../../../../../lib/supabase/admin";
import { canManageArea, requireBackofficeUser } from "../../../../../../lib/supabase/require-admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; checkinId: string }> },
) {
  if (request.headers.get("origin") !== request.nextUrl.origin ||
      !request.headers.get("content-type")?.startsWith("application/json") ||
      Number(request.headers.get("content-length") ?? 0) > 8192) {
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

  const { id, checkinId } = await params;
  if (!uuidPattern.test(id) || !uuidPattern.test(checkinId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isRecord(payload) || typeof payload.note !== "string" ||
      payload.note.length > 1000 || !("value" in payload)) {
    return NextResponse.json({ error: "invalid_checkin" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: objective, error: objectiveError } = await admin
    .from("objectives")
    .select("area_id,value_type,archived")
    .eq("id", id)
    .maybeSingle();
  if (objectiveError) {
    console.error("[backoffice] objective check-in edit lookup failed", objectiveError.code);
    return NextResponse.json({ error: "checkin_unavailable" }, { status: 503 });
  }
  if (!objective) return NextResponse.json({ error: "objective_not_found" }, { status: 404 });
  if (!canManageArea(authorization, objective.area_id)) {
    return NextResponse.json({ error: "area_forbidden" }, { status: 403 });
  }
  if (objective.archived) return NextResponse.json({ error: "objective_archived" }, { status: 409 });
  if (!isObjectiveValue(payload.value, objective.value_type)) {
    return NextResponse.json({ error: "invalid_checkin_value" }, { status: 400 });
  }

  const { data: existingCheckin, error: checkinError } = await admin
    .from("objective_checkins")
    .select("id")
    .eq("id", checkinId)
    .eq("objective_id", id)
    .maybeSingle();
  if (checkinError) {
    console.error("[backoffice] objective check-in edit lookup failed", checkinError.code);
    return NextResponse.json({ error: "checkin_unavailable" }, { status: 503 });
  }
  if (!existingCheckin) return NextResponse.json({ error: "checkin_not_found" }, { status: 404 });

  const { data, error } = await admin.rpc("update_objective_checkin", {
    p_checkin_id: checkinId,
    p_value: payload.value,
    p_note: payload.note.trim(),
    p_editor_id: authorization.user.id,
    p_editor_email: authorization.user.email ?? "",
  });
  if (error) {
    console.error("[backoffice] objective check-in edit failed", error.code);
    return NextResponse.json({ error: "checkin_update_failed" }, { status: 503 });
  }
  if (!data) return NextResponse.json({ error: "checkin_not_found" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
