import { NextResponse, type NextRequest } from "next/server";
import { isStaffSchemaMissing, listVisibleStaff } from "../../../lib/staff-profiles";
import { isBlockSubjectType, listOpenBlocks, saveWorkBlock } from "../../../lib/work-blocks";
import { requireBackofficeUser } from "../../../lib/supabase/require-admin";

function failure(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const authorization = await requireBackofficeUser();
  if (!authorization.authorized) {
    return failure(authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden", authorization.reason === "unauthenticated" ? 401 : 403);
  }
  const subjectType = request.nextUrl.searchParams.get("subjectType");
  const subjectId = request.nextUrl.searchParams.get("subjectId") ?? undefined;
  if (subjectType && !isBlockSubjectType(subjectType)) return failure("invalid_block", 400);
  try {
    const [blocks, people] = await Promise.all([
      listOpenBlocks(subjectType && isBlockSubjectType(subjectType) ? subjectType : undefined, subjectId),
      listVisibleStaff(authorization.role, authorization.user.id, authorization.role === "manager" ? authorization.areaIds : null),
    ]);
    return NextResponse.json({
      blocks,
      block: subjectId ? blocks[0] ?? null : null,
      people,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    return failure(isStaffSchemaMissing(code) ? "blocks_schema_missing" : "blocks_unavailable", 503);
  }
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return failure("invalid_origin", 403);
  const authorization = await requireBackofficeUser();
  if (!authorization.authorized) {
    return failure(authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden", authorization.reason === "unauthenticated" ? 401 : 403);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure("invalid_json", 400);
  }
  if (typeof body !== "object" || body === null) return failure("invalid_block", 400);
  const subjectType = "subjectType" in body ? body.subjectType : null;
  const subjectId = "subjectId" in body ? body.subjectId : null;
  const reason = "reason" in body ? body.reason : "";
  const userIds = "userIds" in body ? body.userIds : null;
  if (!isBlockSubjectType(subjectType) || typeof subjectId !== "string" || typeof reason !== "string" || !Array.isArray(userIds) || userIds.some((id) => typeof id !== "string")) {
    return failure("invalid_block", 400);
  }
  try {
    const result = await saveWorkBlock({
      role: authorization.role,
      userId: authorization.user.id,
      managerAreaIds: authorization.role === "manager" ? authorization.areaIds : null,
      subjectType,
      subjectId,
      reason,
      userIds,
    });
    if ("error" in result && result.error) {
      const status = result.error === "forbidden" ? 403 : result.error === "block_subject_not_found" ? 404 : 400;
      return failure(result.error, status);
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    return failure(isStaffSchemaMissing(code) ? "blocks_schema_missing" : "blocks_unavailable", 503);
  }
}
