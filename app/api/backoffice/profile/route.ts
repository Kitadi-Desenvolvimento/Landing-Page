import { NextResponse, type NextRequest } from "next/server";
import { isStaffSchemaMissing, loadDisplayNames, saveDisplayName } from "../../../lib/staff-profiles";
import { requireBackofficeUser } from "../../../lib/supabase/require-admin";

function failure(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  const authorization = await requireBackofficeUser();
  if (!authorization.authorized) {
    return failure(authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden", authorization.reason === "unauthenticated" ? 401 : 403);
  }
  try {
    const names = await loadDisplayNames([authorization.user.id]);
    return NextResponse.json({
      displayName: names.get(authorization.user.id) ?? "",
      email: authorization.user.email ?? "",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    return failure(isStaffSchemaMissing(code) ? "profile_schema_missing" : "profile_unavailable", 503);
  }
}

export async function PATCH(request: NextRequest) {
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
  const displayName = typeof body === "object" && body !== null && "displayName" in body ? body.displayName : undefined;
  if (typeof displayName !== "string" || displayName.trim().length > 80) return failure("invalid_display_name", 400);
  try {
    const saved = await saveDisplayName(authorization.user.id, displayName);
    return NextResponse.json({ displayName: saved, email: authorization.user.email ?? "" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    return failure(isStaffSchemaMissing(code) ? "profile_schema_missing" : "profile_unavailable", 503);
  }
}
