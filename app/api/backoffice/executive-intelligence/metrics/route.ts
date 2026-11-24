import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { requireBackofficeUser } from "../../../../lib/supabase/require-admin";

type Metrics = {
  crmConverted: number;
  crmConvertedPercent: number;
  objectivesAchieved: number;
  objectivesTotal: number;
  revenueAmount: number;
  expensesAmount: number;
  byArea: Array<{
    area_id: string;
    area_name: string;
    crm_activities: number;
    crm_converted: number;
    objectives_total: number;
    objectives_achieved: number;
    revenue: number;
  }>;
};

export async function GET(request: NextRequest) {
  const authorization = await requireBackofficeUser();
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: authorization.reason === "unauthenticated" ? 401 : 403 },
    );
  }

  if (authorization.role === "collaborator") {
    return NextResponse.json(
      { error: "forbidden" },
      { status: 403 },
    );
  }

  const admin = createSupabaseAdminClient();
  const url = new URL(request.url);
  const periodDays = parseInt(url.searchParams.get("period") || "7", 10);

  const sinceDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

  const metrics: Metrics = {
    crmConverted: 0,
    crmConvertedPercent: 0,
    objectivesAchieved: 0,
    objectivesTotal: 0,
    revenueAmount: 0,
    expensesAmount: 0,
    byArea: [],
  };

  try {
    // CRM: Total opportunities and converted
    const { data: opportunities } = await admin
      .from("crm_opportunities")
      .select("id,stage,amount_kz");

    const totalOpp = opportunities?.length || 0;
    const convertedOpp = opportunities?.filter((o) => o.stage === "converted").length || 0;

    metrics.crmConverted = convertedOpp;
    metrics.crmConvertedPercent = totalOpp > 0 ? Math.round((convertedOpp / totalOpp) * 100) : 0;

    // Revenue from payment orders
    const { data: payments } = await admin
      .from("payment_orders")
      .select("amount_kz")
      .eq("status", "accepted")
      .gte("created_at", sinceDate);

    metrics.revenueAmount = payments?.reduce((sum, p) => sum + (p.amount_kz || 0), 0) || 0;

    // Load all objectives
    const { data: allObjectives } = await admin
      .from("objectives")
      .select("id,area_id")
      .eq("active", true);

    metrics.objectivesTotal = allObjectives?.length || 0;

    // Count objectives with checkins (indicating activity/achievement)
    if (allObjectives && allObjectives.length > 0) {
      const { data: checkinsCount } = await admin
        .from("objective_checkins")
        .select("objective_id", { count: "exact" })
        .gte("created_at", sinceDate);

      const objectivesWithCheckins = new Set(checkinsCount?.map((c) => c.objective_id) || []);
      metrics.objectivesAchieved = objectivesWithCheckins.size;
    }

    // Metrics by area
    const { data: areas } = await admin
      .from("objective_areas")
      .select("id,name");

    if (areas && areas.length > 0) {
      for (const area of areas) {
        const areaObjectives = allObjectives?.filter((o) => o.area_id === area.id) || [];

        metrics.byArea.push({
          area_id: area.id,
          area_name: area.name,
          crm_activities: opportunities?.length || 0,
          crm_converted: convertedOpp,
          objectives_total: areaObjectives.length,
          objectives_achieved: Math.round(areaObjectives.length * (metrics.objectivesAchieved / Math.max(metrics.objectivesTotal, 1))),
          revenue: metrics.revenueAmount,
        });
      }
    }
  } catch (error) {
    console.error("[executive-intelligence] Metrics error:", error);
    return NextResponse.json(
      { error: "failed_to_load_metrics" },
      { status: 500 },
    );
  }

  return NextResponse.json(metrics);
}
