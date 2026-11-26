import { NextResponse, type NextRequest } from "next/server";
import { scheduleDueCommercialNotices } from "../../../lib/commercial-steps";
import { buildCommandDashboard, type CommandPeriod } from "../../../lib/command-dashboard";
import { requireAdmin } from "../../../lib/supabase/require-admin";

const periods = new Set<CommandPeriod>(["day", "week", "month", "year"]);

function failure(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const authorization = await requireAdmin();
  if (!authorization.authorized) {
    return failure(authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden", authorization.reason === "unauthenticated" ? 401 : 403);
  }
  const period = request.nextUrl.searchParams.get("period") ?? "day";
  if (!periods.has(period as CommandPeriod)) return failure("invalid_period", 400);
  const person = request.nextUrl.searchParams.get("person") ?? "all";
  const personId = person === "mine" ? authorization.user.id : person;
  try {
    const { dashboard, noticeSteps } = await buildCommandDashboard({
      userId: authorization.user.id,
      period: period as CommandPeriod,
      personId,
      product: request.nextUrl.searchParams.get("product") ?? "all",
      stage: request.nextUrl.searchParams.get("stage") ?? "all",
      paymentStatus: request.nextUrl.searchParams.get("paymentStatus") ?? "all",
      objectiveSituation: request.nextUrl.searchParams.get("objectiveSituation") ?? "all",
    });
    scheduleDueCommercialNotices(noticeSteps);
    return NextResponse.json(dashboard, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[backoffice] command dashboard failed", error instanceof Error ? error.message : "unknown");
    return failure("command_unavailable", 503);
  }
}
