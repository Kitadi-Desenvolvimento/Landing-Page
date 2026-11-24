import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { requireBackofficeUser } from "../../../../lib/supabase/require-admin";

type Activity = {
  id: string;
  timestamp: string;
  type: "crm" | "objective" | "finance";
  actor_email: string;
  department: string;
  title: string;
  description: string;
  details: Record<string, unknown>;
  status?: "ok" | "pending" | "failed";
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
  const activityType = url.searchParams.get("type") || "all";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30", 10), 50);

  const sinceDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
  const activities: Activity[] = [];

  try {
    // Simplified: Just load CRM history
    if (activityType === "all" || activityType === "crm") {
      const { data: crmData } = await admin
        .from("crm_opportunity_history")
        .select("id,created_at,details,from_stage,to_stage,changed_by_email,opportunity_id")
        .gte("created_at", sinceDate)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (crmData) {
        for (const record of crmData) {
          activities.push({
            id: `crm-${record.id}`,
            timestamp: record.created_at,
            type: "crm",
            actor_email: record.changed_by_email,
            department: "Comercial",
            title: `Oportunidade #${record.opportunity_id?.substring(0, 8)}`,
            description: `${record.from_stage || "novo"} → ${record.to_stage}`,
            details: {
              stage_change: `${record.from_stage} → ${record.to_stage}`,
              reason: record.details,
            },
            status: "ok",
          });
        }
      }
    }

    // Simplified: Just load objective checkins
    if (activityType === "all" || activityType === "objective") {
      const { data: checkinsData } = await admin
        .from("objective_checkins")
        .select("id,created_at,value,note,checked_in_by_email,objective_id")
        .gte("created_at", sinceDate)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (checkinsData) {
        for (const checkin of checkinsData) {
          activities.push({
            id: `objective-${checkin.id}`,
            timestamp: checkin.created_at,
            type: "objective",
            actor_email: checkin.checked_in_by_email,
            department: "Objetivos",
            title: `Check-in #${checkin.objective_id?.substring(0, 8)}`,
            description: `Valor: ${checkin.value}`,
            details: {
              value: checkin.value,
              note: checkin.note,
            },
            status: "ok",
          });
        }
      }
    }

    // Simplified: Finance from payment orders
    if (activityType === "all" || activityType === "finance") {
      const { data: ordersData } = await admin
        .from("payment_orders")
        .select("id,created_at,amount_kz,status")
        .eq("status", "accepted")
        .gte("created_at", sinceDate)
        .order("created_at", { ascending: false })
        .limit(10);

      if (ordersData && ordersData.length > 0) {
        const totalAmount = ordersData.reduce((sum, o) => sum + (o.amount_kz || 0), 0);
        activities.push({
          id: "finance-daily",
          timestamp: new Date().toISOString(),
          type: "finance",
          actor_email: "sistema",
          department: "Financeiro",
          title: "Encerramento Diário",
          description: `AOA ${(totalAmount / 1_000_000).toFixed(1)}M em ${ordersData.length} pagamentos`,
          details: {
            amount_kz: totalAmount,
            payment_count: ordersData.length,
          },
          status: "ok",
        });
      }
    }
  } catch (error) {
    console.error("[executive-intelligence] Error:", error);
    return NextResponse.json(
      { error: "failed_to_load_activities", details: String(error) },
      { status: 500 },
    );
  }

  // Sort by timestamp descending
  activities.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return NextResponse.json({
    activities: activities.slice(0, limit),
    total: activities.length,
    hasMore: activities.length >= limit,
  });
}
