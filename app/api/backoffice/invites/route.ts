import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { requireAdmin } from "../../../lib/supabase/require-admin";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return jsonError("invalid_origin", 403);
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return jsonError("invalid_content_type", 415);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 2048) return jsonError("request_too_large", 413);

  const authorization = await requireAdmin();
  if (!authorization.authorized) {
    return jsonError(
      authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden",
      authorization.reason === "unauthenticated" ? 401 : 403,
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return jsonError("supabase_not_configured", 503);
  }

  let payload: unknown;
  try {
    const body = await request.text();
    if (body.length > 2048) return jsonError("request_too_large", 413);
    payload = JSON.parse(body);
  } catch {
    return jsonError("invalid_json", 400);
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !("email" in payload) ||
    typeof payload.email !== "string"
  ) {
    return jsonError("invalid_email", 400);
  }

  const email = payload.email.trim().toLowerCase();
  if (email.length > 254 || !emailPattern.test(email)) {
    return jsonError("invalid_email", 400);
  }

  const admin = createSupabaseAdminClient();
  const redirectTo = new URL("/", request.nextUrl.origin).toString();
  let linkType: "invite" | "magiclink" = "invite";
  let result = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo },
  });
  if (
    result.error &&
    ["email_exists", "user_already_exists"].includes(result.error.code ?? "")
  ) {
    linkType = "magiclink";
    result = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
  }
  const { data, error } = result;

  if (error || !data.user) {
    console.error("[backoffice] invite link generation failed", {
      code: error?.code ?? "missing_user",
    });
    return jsonError("invite_unavailable", 502);
  }

  if (!data.properties.action_link) {
    console.error("[backoffice] invite link missing from Supabase response", {
      type: linkType,
    });
    return jsonError("invite_link_missing", 502);
  }

  const { error: roleError } = await admin.auth.admin.updateUserById(
    data.user.id,
    { app_metadata: { ...data.user.app_metadata, role: "admin" } },
  );
  if (roleError) {
    console.error("[backoffice] invited user role update failed", {
      code: roleError.code,
    });
    return jsonError("invite_role_update_failed", 500);
  }

  return NextResponse.json(
    { ok: true, link: data.properties.action_link, type: linkType },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
