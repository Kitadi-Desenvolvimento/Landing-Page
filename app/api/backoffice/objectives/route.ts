import { NextResponse, type NextRequest } from "next/server";
import { parseObjective } from "../../../lib/objectives";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { canManageArea, requireBackofficeUser } from "../../../lib/supabase/require-admin";

function isSchemaError(code?: string) {
  return Boolean(code && (
    code.startsWith("PGRST") ||
    code === "42703" ||
    code === "42P01" ||
    code === "42883"
  ));
}

export async function GET() {
  const authorization = await requireBackofficeUser();
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.reason === "unavailable" ? "area_access_unavailable" :
        authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden" },
      { status: authorization.reason === "unavailable" ? 503 :
        authorization.reason === "unauthenticated" ? 401 : 403 },
    );
  }

  const admin = createSupabaseAdminClient();
  let areasQuery = admin.from("objective_areas")
    .select("id,name,slug,active,created_at,updated_at,created_by")
    .order("name");
  let objectivesQuery = admin.from("objectives")
    .select("id,area_id,due_date,archived,title,description,value_type,target_value,unit,active,created_at,updated_at,created_by,updated_by")
    .order("active", { ascending: false }).order("title");
  if (authorization.role === "manager") {
    if (authorization.areaIds.length === 0) {
      return NextResponse.json({
        objectives: [],
        checkins: [],
        edits: [],
        areas: [],
        role: authorization.role,
        readOnly: false,
      }, { headers: { "Cache-Control": "no-store" } });
    }
    areasQuery = areasQuery.in("id", authorization.areaIds);
    objectivesQuery = objectivesQuery.in("area_id", authorization.areaIds);
  }

  const [{ data: objectives, error: objectivesError }, { data: areas, error: areasError }] =
    await Promise.all([objectivesQuery, areasQuery]);

  if (objectivesError) {
    console.error("[backoffice] objective data load failed", objectivesError.code ?? "unknown");
    return NextResponse.json(
      { error: isSchemaError(objectivesError.code) ? "objectives_schema_missing" : "objectives_unavailable" },
      { status: isSchemaError(objectivesError.code) ? 503 : 500 },
    );
  }
  if (areasError) {
    console.error("[backoffice] objective areas load failed", areasError.code ?? "unknown");
    return NextResponse.json({
      error: isSchemaError(areasError.code) ? "areas_schema_missing" : "areas_unavailable",
    }, { status: 503 });
  }

  const checkins = [];
  const objectiveIds = (objectives ?? []).map((objective) => objective.id);
  if (objectiveIds.length > 0) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from("objective_checkins")
        .select("id,objective_id,checkin_date,value,note,checked_in_by,checked_in_by_email,created_at,updated_at,updated_by,updated_by_email")
        .in("objective_id", objectiveIds)
        .order("checkin_date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, from + 999);
      if (error) {
        console.error("[backoffice] objective check-in history load failed", error.code ?? "unknown");
        return NextResponse.json(
          { error: isSchemaError(error.code) ? "checkins_schema_missing" : "checkins_unavailable" },
          { status: isSchemaError(error.code) ? 503 : 500 },
        );
      }
      checkins.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
  }

  const checkinIds = checkins.map((checkin) => checkin.id);
  let edits: unknown[] = [];
  if (checkinIds.length > 0) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from("objective_checkin_edits")
        .select("id,checkin_id,previous_value,previous_note,edited_by,edited_by_email,edited_at")
        .in("checkin_id", checkinIds)
        .order("edited_at", { ascending: false })
        .range(from, from + 999);
      if (error) {
        console.error("[backoffice] objective check-in edit history load failed", error.code ?? "unknown");
        return NextResponse.json({
          error: isSchemaError(error.code) ? "checkin_edits_schema_missing" : "checkin_edits_unavailable",
        }, { status: 503 });
      }
      edits.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
  }

  return NextResponse.json(
    {
      objectives: objectives ?? [],
      checkins,
      edits,
      areas: areas ?? [],
      role: authorization.role,
      readOnly: authorization.role === "collaborator",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const authorization = await requireBackofficeUser();
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden" },
      { status: authorization.reason === "unauthenticated" ? 401 : authorization.reason === "unavailable" ? 503 : 403 },
    );
  }
  if (!request.headers.get("content-type")?.startsWith("application/json") ||
      Number(request.headers.get("content-length") ?? 0) > 8192) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const objective = parseObjective(payload);
  if (!objective) return NextResponse.json({ error: "invalid_objective" }, { status: 400 });
  if (!canManageArea(authorization, objective.area_id)) {
    return NextResponse.json({ error: "area_forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
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

  const { data, error } = await admin
    .from("objectives")
    .insert({ ...objective, created_by: authorization.user.id, updated_by: authorization.user.id })
    .select("*")
    .single();
  if (error) {
    console.error("[backoffice] objective create failed", error.code);
    return NextResponse.json({ error: "objective_create_failed" }, { status: 503 });
  }
  return NextResponse.json(data, { status: 201, headers: { "Cache-Control": "no-store" } });
}
