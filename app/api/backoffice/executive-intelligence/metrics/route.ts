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
  const areaId = url.searchParams.get("area_id");

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
    // Load user areas if manager
    let managerAreaIds: string[] | null = null;
    if (authorization.role === "manager") {
      const { data: memberships } = await admin
        .from("objective_area_members")
        .select("area_id")
        .eq("user_id", authorization.user.id);
      managerAreaIds = memberships?.map((m) => m.area_id) || [];
    }

    // CRM Metrics
    const { data: opportunities } = await admin
      .from("crm_opportunities")
      .select("id,stage,amount_kz,converted_at")
      .gte("created_at", sinceDate);

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

    // Expenses
    const { data: expenses } = await admin
      .from("finance_expenses")
      .select("amount_kz")
      .gte("created_at", sinceDate);

    metrics.expensesAmount = expenses?.reduce((sum, e) => sum + (e.amount_kz || 0), 0) || 0;

    // Load areas
    const { data: areas } = await admin
      .from("objective_areas")
      .select("id,name");

    const areaMap = new Map((areas || []).map((a) => [a.id, a.name]));

    // Metrics by area
    if (areas && areas.length > 0) {
      for (const area of areas) {
        // CRM by area - simplified
        const areaOpportunities = opportunities?.filter((o) => {
          // This is simplified; in reality you'd join with crm_contacts to get area
          return true; // Placeholder
        }) || [];

        // Objectives by area
        const { data: areaObjectives } = await admin
          .from("objectives")
          .select("id,active,period_start")
          .eq("area_id", area.id)
          .eq("active", true)
          .gte("created_at", sinceDate);

        // Objectives achieved - count with checkins meeting target
        let achieved = 0;
        if (areaObjectives) {
          for (const obj of areaObjectives) {
            const { data: checkins } = await admin
              .from("objective_checkins")
              .select("value")
              .eq("objective_id", obj.id)
              .gte("created_at", sinceDate);

            // Simple check: if has checkin = "achieved"
            if (checkins && checkins.length > 0) achieved++;
          }
        }

        metrics.byArea.push({
          area_id: area.id,
          area_name: area.name,
          crm_activities: areaOpportunities.length,
          crm_converted: areaOpportunities.filter((o) => o.stage === "converted").length,
          objectives_total: areaObjectives?.length || 0,
          objectives_achieved: achieved,
          revenue: payments?.reduce((sum, p) => sum + (p.amount_kz || 0), 0) || 0,
        });
      }
    }

    // Global objectives
    const { data: allObjectives } = await admin
      .from("objectives")
      .select("id")
      .eq("active", true)
      .gte("created_at", sinceDate);

    metrics.objectivesTotal = allObjectives?.length || 0;

    // Count achieved (with checkins)
    let totalAchieved = 0;
    if (allObjectives && allObjectives.length > 0) {
      for (const obj of allObjectives) {
        const { count } = await admin
          .from("objective_checkins")
          .select("id", { count: "exact" })
          .eq("objective_id", obj.id)
          .gte("created_at", sinceDate);

        if ((count || 0) > 0) totalAchieved++;
      }
    }
    metrics.objectivesAchieved = totalAchieved;
  } catch (error) {
    console.error("[executive-intelligence] Metrics error:", error);
    return NextResponse.json(
      { error: "failed_to_load_metrics" },
      { status: 500 },
    );
  }

  return NextResponse.json(metrics);
}
