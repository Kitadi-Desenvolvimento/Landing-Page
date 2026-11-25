import { NextResponse } from "next/server";
import { loadStaffNotifications } from "../../../lib/staff-notifications";
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
    const notifications = await loadStaffNotifications({
      role: authorization.role,
      userId: authorization.user.id,
      areaIds: authorization.areaIds,
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
