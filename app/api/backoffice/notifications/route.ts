import { NextResponse, type NextRequest } from "next/server";
import { loadCommercialSteps } from "../../../lib/commercial-steps";
import { dismissStaffNotifications, loadStaffNotifications } from "../../../lib/staff-notifications";
import { requireBackofficeUser } from "../../../lib/supabase/require-admin";

export async function GET() {
  const authorization = await requireBackofficeUser();
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden" },
      { status: authorization.reason === "unauthenticated" ? 401 : 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    let steps: Awaited<ReturnType<typeof loadCommercialSteps>> | undefined;
    try {
      steps = await loadCommercialSteps();
    } catch (error) {
      console.error("[backoffice] commercial notices failed", error instanceof Error ? error.message : "unknown");
    }
    const notifications = await loadStaffNotifications({
      role: authorization.role,
      userId: authorization.user.id,
      areaIds: authorization.areaIds,
      steps,
    });
    return NextResponse.json({ notifications }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[backoffice] notifications failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { error: "notifications_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authorization = await requireBackofficeUser();
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden" },
      { status: authorization.reason === "unauthenticated" ? 401 : 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const keys = typeof body === "object" && body !== null && "keys" in body && Array.isArray(body.keys)
    ? body.keys.filter((key): key is string => typeof key === "string")
    : null;
  if (!keys) {
    return NextResponse.json({ error: "invalid_notification" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const result = await dismissStaffNotifications(authorization.user.id, keys);
    if (result === "invalid") {
      return NextResponse.json({ error: "invalid_notification" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (result === "missing") {
      return NextResponse.json({ error: "notifications_dismiss_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ dismissed: keys.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[backoffice] dismissing notifications failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { error: "notifications_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
