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
  const areaId = url.searchParams.get("area_id");
  const activityType = url.searchParams.get("type") || "all";
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 100);

  const sinceDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
  const activities: Activity[] = [];

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

    // CRM Opportunities History
    if (activityType === "all" || activityType === "crm") {
      const { data: crmData, error: crmError } = await admin
        .from("crm_opportunity_history")
        .select(
          `id,
          created_at,
          details,
          from_stage,
          to_stage,
          changed_by_email,
          opportunity_id,
          opportunities!inner(
            id,
            contact_id,
            title,
            amount_kz,
            crm_contacts!inner(id, name, company_id)
          )`,
        )
        .gte("created_at", sinceDate)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (crmError) console.error("[executive-intelligence] CRM query failed:", crmError);

      if (crmData) {
        for (const record of crmData) {
          const opp = record.opportunities as any;
          activities.push({
            id: `crm-${record.id}`,
            timestamp: record.created_at,
            type: "crm",
            actor_email: record.changed_by_email,
            department: "Comercial",
            title: opp?.title || "Oportunidade",
            description: `${record.from_stage || "novo"} → ${record.to_stage}`,
            details: {
              contact_name: opp?.crm_contacts?.name,
              amount_kz: opp?.amount_kz,
              stage_change: `${record.from_stage} → ${record.to_stage}`,
              reason: record.details,
            },
            status: "ok",
          });
        }
      }
    }

    // Objective Check-ins
    if (activityType === "all" || activityType === "objective") {
      const { data: checkinsData, error: checkinsError } = await admin
        .from("objective_checkins")
        .select(
          `id,
          created_at,
          value,
          note,
          checked_in_by_email,
          objective_id,
          objectives!inner(id, title, area_id, target_value, unit)`,
        )
        .gte("created_at", sinceDate)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (checkinsError) console.error("[executive-intelligence] Checkin query failed:", checkinsError);

      if (checkinsData) {
        for (const checkin of checkinsData) {
          const obj = checkin.objectives as any;
          activities.push({
            id: `objective-${checkin.id}`,
            timestamp: checkin.created_at,
            type: "objective",
            actor_email: checkin.checked_in_by_email,
            department: obj?.area_id ? `Depto. ${obj.area_id.substring(0, 8)}` : "Geral",
            title: obj?.title || "Objetivo",
            description: `Check-in: ${checkin.value}${obj?.unit ? ` ${obj.unit}` : ""}`,
            details: {
              value: checkin.value,
              target: obj?.target_value,
              unit: obj?.unit,
              note: checkin.note,
              progress_percentage:
                obj?.target_value && typeof obj.target_value === "number" && typeof checkin.value === "number"
                  ? Math.round((checkin.value / obj.target_value) * 100)
                  : null,
            },
            status: "ok",
          });
        }
      }
    }

    // Finance (Daily closings)
    if (activityType === "all" || activityType === "finance") {
      const { data: ordersData, error: ordersError } = await admin
        .from("payment_orders")
        .select("id,created_at,amount_kz,status,product_title")
        .eq("status", "accepted")
        .gte("created_at", sinceDate)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (ordersError) console.error("[executive-intelligence] Finance query failed:", ordersError);

      if (ordersData) {
        const financeByDay = new Map<string, { count: number; total: number }>();
        for (const order of ordersData) {
          const day = new Date(order.created_at).toISOString().split("T")[0];
          const current = financeByDay.get(day) || { count: 0, total: 0 };
          financeByDay.set(day, {
            count: current.count + 1,
            total: current.total + (order.amount_kz || 0),
          });
        }

        for (const [day, stats] of financeByDay.entries()) {
          activities.push({
            id: `finance-${day}`,
            timestamp: new Date(`${day}T23:59:59Z`).toISOString(),
            type: "finance",
            actor_email: "sistema",
            department: "Financeiro",
            title: "Encerramento Diário",
            description: `AOA ${(stats.total / 1000).toFixed(0)}K em ${stats.count} pagamentos`,
            details: {
              amount_kz: stats.total,
              payment_count: stats.count,
              day,
            },
            status: "ok",
          });
        }
      }
    }
  } catch (error) {
    console.error("[executive-intelligence] Error:", error);
    return NextResponse.json(
      { error: "failed_to_load_activities" },
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
