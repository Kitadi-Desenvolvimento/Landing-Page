import { NextResponse, type NextRequest } from "next/server";
import { isRecord, isObjectiveValue, parseObjective } from "../../../../lib/objectives";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { canManageArea, requireBackofficeUser } from "../../../../lib/supabase/require-admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
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
  if (!request.headers.get("content-type")?.startsWith("application/json") ||
      Number(request.headers.get("content-length") ?? 0) > 8192) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const objective = parseObjective(payload);
  if (!objective) return NextResponse.json({ error: "invalid_objective" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("objectives")
    .select("area_id,archived")
    .eq("id", id)
    .maybeSingle();
  if (existingError) {
    console.error("[backoffice] objective access lookup failed", existingError.code);
    return NextResponse.json({ error: "objective_unavailable" }, { status: 503 });
  }
  if (!existing) return NextResponse.json({ error: "objective_not_found" }, { status: 404 });
  if (existing.archived) return NextResponse.json({ error: "objective_archived" }, { status: 409 });
  if (!canManageArea(authorization, existing.area_id) || !canManageArea(authorization, objective.area_id)) {
    return NextResponse.json({ error: "area_forbidden" }, { status: 403 });
  }
  if (existing.area_id !== objective.area_id) {
    const { data: area, error: areaError } = await admin
      .from("objective_areas")
      .select("id")
      .eq("id", objective.area_id)
      .eq("active", true)
      .maybeSingle();
    if (areaError) {
      console.error("[backoffice] objective area validation failed", areaError.code);
      return NextResponse.json({ error: "areas_unavailable" }, { status: 503 });
    }
    if (!area) return NextResponse.json({ error: "invalid_area" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("objectives")
    .update({ ...objective, updated_by: authorization.user.id })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[backoffice] objective update failed", error.code);
    return NextResponse.json({ error: "objective_update_failed" }, { status: 503 });
  }
  if (!data) return NextResponse.json({ error: "objective_not_found" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
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
  if (!request.headers.get("content-type")?.startsWith("application/json") ||
      Number(request.headers.get("content-length") ?? 0) > 8192) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
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
  const { data: objective, error: loadError } = await admin
    .from("objectives")
    .select("id,value_type,active,archived,area_id")
    .eq("id", id)
    .maybeSingle();
  if (loadError) {
    console.error("[backoffice] objective check-in lookup failed", loadError.code);
    return NextResponse.json({ error: "checkin_unavailable" }, { status: 503 });
  }
  if (!objective) return NextResponse.json({ error: "objective_not_found" }, { status: 404 });
  if (!canManageArea(authorization, objective.area_id)) {
    return NextResponse.json({ error: "area_forbidden" }, { status: 403 });
  }
  if (objective.archived) return NextResponse.json({ error: "objective_archived" }, { status: 409 });
  if (!objective.active) return NextResponse.json({ error: "objective_inactive" }, { status: 409 });

  if (!isObjectiveValue(payload.value, objective.value_type)) {
    return NextResponse.json({ error: "invalid_checkin_value" }, { status: 400 });
  }

  const dateParts = new Intl.DateTimeFormat("en", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const datePart = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((part) => part.type === type)?.value ?? "";
  const day = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
  const { data, error } = await admin
    .from("objective_checkins")
    .insert({
      objective_id: id,
      checkin_date: day,
      value: payload.value,
      note: payload.note.trim(),
      checked_in_by: authorization.user.id,
      checked_in_by_email: authorization.user.email ?? "",
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "already_checked_in_today" }, { status: 409 });
    }
    console.error("[backoffice] objective daily check-in failed", error.code);
    return NextResponse.json({ error: "checkin_save_failed" }, { status: 503 });
  }
  return NextResponse.json(data, { status: 201, headers: { "Cache-Control": "no-store" } });
}
