import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { requireBackofficeUser } from "../../../lib/supabase/require-admin";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const roles = ["admin", "manager", "collaborator"] as const;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return jsonError("invalid_origin", 403);
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return jsonError("invalid_content_type", 415);
  }
  if (Number(request.headers.get("content-length") ?? 0) > 4096) {
    return jsonError("request_too_large", 413);
  }

  const authorization = await requireBackofficeUser();
  if (!authorization.authorized) {
    return jsonError(
      authorization.reason === "unauthenticated" ? "unauthorized" :
        authorization.reason === "unavailable" ? "area_access_unavailable" : "forbidden",
      authorization.reason === "unauthenticated" ? 401 :
        authorization.reason === "unavailable" ? 503 : 403,
    );
  }
  if (authorization.role === "collaborator") return jsonError("forbidden", 403);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return jsonError("supabase_not_configured", 503);
  }

  let payload: unknown;
  try {
    const body = await request.text();
    if (body.length > 4096) return jsonError("request_too_large", 413);
    payload = JSON.parse(body);
  } catch {
    return jsonError("invalid_json", 400);
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload) ||
      !("email" in payload) || typeof payload.email !== "string" ||
      ("role" in payload && (typeof payload.role !== "string" ||
        !roles.includes(payload.role as (typeof roles)[number]))) ||
      ("areaIds" in payload && (!Array.isArray(payload.areaIds) ||
        payload.areaIds.length > 50 ||
        payload.areaIds.some((id) => typeof id !== "string" || !uuidPattern.test(id))))) {
    return jsonError("invalid_invite", 400);
  }

  const email = payload.email.trim().toLowerCase();
  if (email.length > 254 || !emailPattern.test(email)) return jsonError("invalid_email", 400);
  const inviteRole = authorization.role === "admin"
    ? ("role" in payload ? payload.role : "collaborator")
    : "collaborator";
  if (!roles.includes(inviteRole as (typeof roles)[number])) return jsonError("invalid_role", 400);
  const areaIds = "areaIds" in payload ? [...new Set(payload.areaIds as string[])] : [];
  if (authorization.role === "manager" &&
      areaIds.some((areaId) => !authorization.areaIds.includes(areaId))) {
    return jsonError("area_membership_forbidden", 403);
  }

  const admin = createSupabaseAdminClient();
  if (areaIds.length > 0) {
    const { data: areas, error: areasError } = await admin
      .from("objective_areas")
      .select("id")
      .in("id", areaIds);
    if (areasError) {
      console.error("[backoffice] invite area validation failed", areasError.code);
      return jsonError("invite_areas_update_failed", 503);
    }
    if ((areas ?? []).length !== areaIds.length) return jsonError("invalid_area_membership", 400);
  }

  const redirectTo = new URL("/", request.nextUrl.origin).toString();
  let linkType: "invite" | "magiclink" = "invite";
  let result = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo },
  });
  if (result.error && ["email_exists", "user_already_exists"].includes(result.error.code ?? "")) {
    linkType = "magiclink";
    result = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
  }
  const { data, error } = result;
  if (error || !data.user) {
    console.error("[backoffice] invite link generation failed", { code: error?.code ?? "missing_user" });
    return jsonError("invite_unavailable", 502);
  }
  if (!data.properties.action_link) {
    console.error("[backoffice] invite link missing from Supabase response", { type: linkType });
    return jsonError("invite_link_missing", 502);
  }

  if (areaIds.length > 0) {
    const { error: membershipError } = await admin.from("objective_area_members").upsert(
      areaIds.map((areaId) => ({
        area_id: areaId,
        user_id: data.user.id,
        assigned_by: authorization.user.id,
      })),
      { onConflict: "area_id,user_id", ignoreDuplicates: true },
    );
    if (membershipError) {
      console.error("[backoffice] invite area assignment failed", membershipError.code);
      return jsonError("invite_areas_update_failed", 503);
    }
  }

  const { error: roleError } = await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { ...data.user.app_metadata, role: inviteRole },
  });
  if (roleError) {
    console.error("[backoffice] invited user role update failed", { code: roleError.code });
    return jsonError("invite_role_update_failed", 500);
  }

  return NextResponse.json(
    { ok: true, link: data.properties.action_link, type: linkType },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
