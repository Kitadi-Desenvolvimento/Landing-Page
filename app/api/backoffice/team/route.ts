import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { requireBackofficeUser } from "../../../lib/supabase/require-admin";

const roles = ["admin", "manager", "collaborator", "none"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  const authorization = await requireBackofficeUser();
  if (!authorization.authorized) {
    return failure(
      authorization.reason === "unauthenticated" ? "unauthorized" :
        authorization.reason === "unavailable" ? "area_access_unavailable" : "forbidden",
      authorization.reason === "unauthenticated" ? 401 :
        authorization.reason === "unavailable" ? 503 : 403,
    );
  }

  const admin = createSupabaseAdminClient();
  let areaQuery = admin.from("objective_areas").select("*").order("name");
  let memberQuery = admin.from("objective_area_members").select("*");
  if (authorization.role === "manager") {
    if (authorization.areaIds.length === 0) {
      return NextResponse.json({ users: [], areas: [], memberships: [], role: authorization.role },
        { headers: { "Cache-Control": "no-store" } });
    }
    areaQuery = areaQuery.in("id", authorization.areaIds);
    memberQuery = memberQuery.in("area_id", authorization.areaIds);
  }

  const [{ data: areas, error: areasError }, { data: memberships, error: membershipsError }] =
    await Promise.all([areaQuery, memberQuery]);
  if (areasError || membershipsError) {
    console.error("[backoffice] team access data load failed", areasError?.code ?? membershipsError?.code);
    return failure("team_unavailable", 503);
  }

  let users: { id: string; email: string; role: string }[] = [];
  if (authorization.role === "admin") {
    for (let page = 1; ; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) {
        console.error("[backoffice] team user list failed", error.code);
        return failure("team_unavailable", 503);
      }
      users.push(...data.users.map((user) => ({
        id: user.id,
        email: user.email ?? "",
        role: typeof user.app_metadata.role === "string" ? user.app_metadata.role : "none",
      })));
      if (data.users.length < 1000) break;
    }
  } else {
    const memberIds = [...new Set((memberships ?? []).map((membership) => membership.user_id))];
    for (const userId of memberIds) {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error) {
        console.error("[backoffice] team member lookup failed", error.code);
        return failure("team_unavailable", 503);
      }
      if (data.user) users.push({
        id: data.user.id,
        email: data.user.email ?? "",
        role: typeof data.user.app_metadata.role === "string" ? data.user.app_metadata.role : "none",
      });
    }
  }

  return NextResponse.json(
    { users, areas: areas ?? [], memberships: memberships ?? [], role: authorization.role },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin ||
      !request.headers.get("content-type")?.startsWith("application/json") ||
      Number(request.headers.get("content-length") ?? 0) > 8192) {
    return failure("invalid_request", 400);
  }
  const authorization = await requireBackofficeUser();
  if (!authorization.authorized) {
    return failure(
      authorization.reason === "unauthenticated" ? "unauthorized" :
        authorization.reason === "unavailable" ? "area_access_unavailable" : "forbidden",
      authorization.reason === "unauthenticated" ? 401 :
        authorization.reason === "unavailable" ? 503 : 403,
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return failure("invalid_json", 400);
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload) ||
      !("userId" in payload) || typeof payload.userId !== "string" ||
      !uuidPattern.test(payload.userId) ||
      ("role" in payload && (typeof payload.role !== "string" ||
        !roles.includes(payload.role as (typeof roles)[number]))) ||
      ("areaIds" in payload && (!Array.isArray(payload.areaIds) ||
        payload.areaIds.length > 50 ||
        payload.areaIds.some((id) => typeof id !== "string" || !uuidPattern.test(id))))) {
    return failure("invalid_team_update", 400);
  }
  if (authorization.role !== "admin" && "role" in payload) {
    return failure("role_change_forbidden", 403);
  }

  const admin = createSupabaseAdminClient();
  const { data: target, error: targetError } = await admin.auth.admin.getUserById(payload.userId);
  if (targetError || !target.user) {
    if (targetError) console.error("[backoffice] team user lookup failed", targetError.code);
    return failure(targetError ? "team_unavailable" : "user_not_found", targetError ? 503 : 404);
  }

  if ("areaIds" in payload) {
    const desiredAreaIds = [...new Set(payload.areaIds as string[])];
    const editableAreaIds = authorization.role === "admin"
      ? null
      : authorization.areaIds;
    if (editableAreaIds && desiredAreaIds.some((areaId) => !editableAreaIds.includes(areaId))) {
      return failure("area_membership_forbidden", 403);
    }

    if (desiredAreaIds.length > 0) {
      const { data: activeAreas, error } = await admin
        .from("objective_areas")
        .select("id")
        .in("id", desiredAreaIds);
      if (error) {
        console.error("[backoffice] team area validation failed", error.code);
        return failure("team_unavailable", 503);
      }
      if ((activeAreas ?? []).length !== desiredAreaIds.length) {
        return failure("invalid_area_membership", 400);
      }
    }

    const assignedAreaIds = editableAreaIds
      ? desiredAreaIds.filter((areaId) => editableAreaIds.includes(areaId))
      : desiredAreaIds;
    const { error: membershipError } = await admin.rpc("replace_objective_area_memberships", {
      p_user_id: payload.userId,
      p_area_ids: assignedAreaIds,
      p_assigned_by: authorization.user.id,
      p_scope_ids: editableAreaIds,
    });
    if (membershipError) {
      console.error("[backoffice] team membership update failed", membershipError.code);
      return failure("membership_update_failed", 503);
    }
  }

  if (authorization.role === "admin" && "role" in payload) {
    const appMetadata = { ...target.user.app_metadata };
    if (payload.role === "none") delete appMetadata.role;
    else appMetadata.role = payload.role;
    const { error } = await admin.auth.admin.updateUserById(payload.userId, {
      app_metadata: appMetadata,
    });
    if (error) {
      console.error("[backoffice] team role update failed", error.code);
      return failure("role_update_failed", 503);
    }
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
