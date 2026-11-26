import { NextResponse, type NextRequest } from "next/server";
import { canReadObjective, loadObjectiveAccess } from "../../../../lib/objective-access";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { requireBackofficeUser } from "../../../../lib/supabase/require-admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isSchemaError(code?: string) {
  return Boolean(code && (code.startsWith("PGRST") || code === "42703" || code === "42P01" || code === "42883"));
}

export async function GET(request: NextRequest) {
  const authorization = await requireBackofficeUser();
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden" },
      { status: authorization.reason === "unauthenticated" ? 401 : 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  let access;
  try {
    access = await loadObjectiveAccess(
      authorization.role,
      authorization.user.id,
      authorization.role === "manager" ? authorization.areaIds : null,
    );
  } catch (error) {
    console.error("[backoffice] objective history access failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "objective_access_unavailable" }, { status: 503 });
  }

  const admin = createSupabaseAdminClient();
  const parentResult = await admin
    .from("objectives")
    .select("id,scope_type,area_id,assigned_to")
    .eq("id", id)
    .maybeSingle();
  if (parentResult.error) {
    return NextResponse.json({ error: "objectives_unavailable" }, { status: 503 });
  }
  if (!parentResult.data || !canReadObjective(access, parentResult.data)) {
    return NextResponse.json({ error: "objective_not_found" }, { status: 404 });
  }
  const childrenResult = await admin
    .from("objectives")
    .select("id,scope_type,area_id,assigned_to")
    .eq("parent_objective_id", id);
  if (childrenResult.error) {
    return NextResponse.json({ error: "objectives_unavailable" }, { status: 503 });
  }
  const visible = [parentResult.data, ...(childrenResult.data ?? [])].filter((objective) => canReadObjective(access, objective));
  const visibleIds = visible.map((objective) => objective.id);
  const scopeById = new Map(visible.map((objective) => [objective.id, objective.scope_type]));

  const checkins = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("objective_checkins")
      .select("id,objective_id,checkin_date,value,note,checked_in_by,checked_in_by_email,created_at,updated_at,updated_by_email")
      .in("objective_id", visibleIds)
      .order("checkin_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (error) {
      console.error("[backoffice] objective history load failed", error.code ?? "unknown");
      return NextResponse.json(
        { error: isSchemaError(error.code) ? "checkins_schema_missing" : "checkins_unavailable" },
        { status: 503 },
      );
    }
    checkins.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const visibleCheckins = checkins.filter((checkin) => {
    if (access.role === "collaborator") return checkin.checked_in_by === access.userId;
    if (access.role === "manager" && scopeById.get(checkin.objective_id) === "company") {
      return access.memberIds?.includes(checkin.checked_in_by ?? "") ?? false;
    }
    return true;
  }).map((checkin) => ({
    ...checkin,
    checkin_date: String(checkin.checkin_date).slice(0, 10),
    note: checkin.note ?? "",
    checked_in_by_email: checkin.checked_in_by_email ?? "",
    updated_by_email: checkin.updated_by_email ?? "",
  }));

  const edits = [];
  const checkinIds = visibleCheckins.map((checkin) => checkin.id);
  for (let index = 0; index < checkinIds.length; index += 150) {
    const slice = checkinIds.slice(index, index + 150);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from("objective_checkin_edits")
        .select("id,checkin_id,previous_value,previous_note,edited_by_email,edited_at")
        .in("checkin_id", slice)
        .order("edited_at", { ascending: false })
        .range(from, from + 999);
      if (error) {
        console.error("[backoffice] objective history edits failed", error.code ?? "unknown");
        return NextResponse.json({ error: "checkin_edits_unavailable" }, { status: 503 });
      }
      edits.push(...(data ?? []).map((edit) => ({
        ...edit,
        previous_note: edit.previous_note ?? "",
        edited_by_email: edit.edited_by_email ?? "",
      })));
      if (!data || data.length < 1000) break;
    }
  }

  return NextResponse.json(
    { checkins: visibleCheckins, edits },
    { headers: { "Cache-Control": "no-store" } },
  );
}
