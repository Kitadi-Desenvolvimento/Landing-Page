import { NextResponse, type NextRequest } from "next/server";
import { isRecord, isObjectiveValue, parseObjective } from "../../../../lib/objectives";
import {
  canManageObjective,
  loadObjectiveAccess,
  validateObjectiveRelations,
  validateObjectiveScope,
} from "../../../../lib/objective-access";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { requireBackofficeUser } from "../../../../lib/supabase/require-admin";

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
    .select("area_id,scope_type,assigned_to,parent_objective_id,archived")
    .eq("id", id)
    .maybeSingle();
  if (existingError) {
    console.error("[backoffice] objective access lookup failed", existingError.code);
    return NextResponse.json({ error: "objective_unavailable" }, { status: 503 });
  }
  if (!existing) return NextResponse.json({ error: "objective_not_found" }, { status: 404 });
  if (existing.archived) return NextResponse.json({ error: "objective_archived" }, { status: 409 });
  if (existing.parent_objective_id !== objective.parent_objective_id) {
    return NextResponse.json({ error: "parent_objective_immutable" }, { status: 400 });
  }

  let access;
  try {
    access = await loadObjectiveAccess(
      authorization.role,
      authorization.user.id,
      authorization.role === "manager" ? authorization.areaIds : null,
    );
    if (!canManageObjective(access, existing)) {
      return NextResponse.json({ error: "objective_scope_forbidden" }, { status: 403 });
    }
    const scopeError = await validateObjectiveScope(access, objective, existing.area_id);
    if (scopeError) {
      return NextResponse.json(
        { error: scopeError },
        { status: scopeError === "objective_scope_forbidden" ? 403 : 400 },
      );
    }
    const relationError = await validateObjectiveRelations(access, {
      ...objective,
      id,
    });
    if (relationError) {
      return NextResponse.json({ error: relationError }, { status: 400 });
    }
  } catch (error) {
    console.error("[backoffice] objective validation failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "objective_validation_unavailable" }, { status: 503 });
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
    .select("id,value_type,active,archived,scope_type,area_id,assigned_to,parent_objective_id")
    .eq("id", id)
    .maybeSingle();
  if (loadError) {
    console.error("[backoffice] objective check-in lookup failed", loadError.code);
    return NextResponse.json({ error: "checkin_unavailable" }, { status: 503 });
  }
  if (!objective) return NextResponse.json({ error: "objective_not_found" }, { status: 404 });
  let access;
  try {
    access = await loadObjectiveAccess(
      authorization.role,
      authorization.user.id,
      authorization.role === "manager" ? authorization.areaIds : null,
    );
  } catch (error) {
    console.error("[backoffice] objective access lookup failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "objective_access_unavailable" }, { status: 503 });
  }
  if (!canManageObjective(access, objective)) {
    return NextResponse.json({ error: "objective_scope_forbidden" }, { status: 403 });
  }
  if (objective.archived) return NextResponse.json({ error: "objective_archived" }, { status: 409 });
  if (!objective.active) return NextResponse.json({ error: "objective_inactive" }, { status: 409 });
  if (objective.parent_objective_id) {
    const { data: parent, error: parentError } = await admin
      .from("objectives")
      .select("active,archived,scope_type,area_id,assigned_to,parent_objective_id")
      .eq("id", objective.parent_objective_id)
      .maybeSingle();
    if (parentError) {
      console.error("[backoffice] parent objective check-in lookup failed", parentError.code);
      return NextResponse.json({ error: "checkin_unavailable" }, { status: 503 });
    }
    if (!parent || !parent.active || parent.archived ||
        !canManageObjective(access, parent)) {
      return NextResponse.json({ error: "objective_parent_inactive" }, { status: 409 });
    }
  }

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
