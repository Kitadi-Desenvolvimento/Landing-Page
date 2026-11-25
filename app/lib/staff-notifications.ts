import "server-only";

import { loadCommercialSteps, stageStepLimits } from "./commercial-steps";
import { objectivePeriodStart } from "./objective-periods";
import { createSupabaseAdminClient } from "./supabase/admin";
import type { BackofficeRole } from "./supabase/require-admin";
import { listOpenBlocks } from "./work-blocks";

export type StaffNotification = {
  id: string;
  kind: "block" | "commercial_step" | "objective" | "payment";
  title: string;
  detail: string;
  section: "objectives" | "commercial" | "payments";
};

function luandaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Luanda" }).format(new Date());
}

async function objectiveNotices(role: BackofficeRole, userId: string, areaIds: string[] | null) {
  if (role === "admin") return [] as StaffNotification[];
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("objectives")
    .select("id,title,due_date,assigned_to,area_id,scope_type")
    .eq("archived", false)
    .eq("active", true)
    .is("parent_objective_id", null)
    .limit(80);
  if (role === "collaborator" || !areaIds?.length) {
    query = query.eq("assigned_to", userId);
  } else {
    query = query.or(`assigned_to.eq.${userId},and(scope_type.eq.department,area_id.in.(${areaIds.join(",")}))`);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  const today = luandaToday();
  const monthStart = objectivePeriodStart("monthly", today) ?? today;
  const ids = rows.map((row) => row.id as string);
  const checked = new Set<string>();
  if (ids.length > 0) {
    const checkins = await admin
      .from("objective_checkins")
      .select("objective_id,checkin_date")
      .in("objective_id", ids)
      .gte("checkin_date", monthStart)
      .limit(500);
    if (checkins.error) throw checkins.error;
    for (const checkin of checkins.data ?? []) checked.add(checkin.objective_id as string);
  }
  return rows.flatMap((row) => {
    const due = typeof row.due_date === "string" && row.due_date <= today;
    const silent = !checked.has(row.id as string);
    if (!due && !silent) return [];
    return [{
      id: `objective-${row.id}`,
      kind: "objective" as const,
      title: row.title as string,
      detail: due ? "O prazo deste objectivo já chegou." : "Ainda não há check-in neste mês.",
      section: "objectives" as const,
    }];
  }).slice(0, 12);
}

async function paymentNotice() {
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from("payment_orders")
    .select("reference", { count: "exact", head: true })
    .eq("status", "accepted")
    .is("reconciled_at", null);
  if (error || !count) return [] as StaffNotification[];
  return [{
    id: "payments-unreconciled",
    kind: "payment" as const,
    title: count === 1 ? "1 pagamento por reconciliar" : `${count} pagamentos por reconciliar`,
    detail: "Estão aceites e ainda sem fecho.",
    section: "payments" as const,
  }];
}

export async function loadStaffNotifications(input: {
  role: BackofficeRole;
  userId: string;
  areaIds: string[] | null;
}) {
  const notifications: StaffNotification[] = [];
  try {
    const blocks = await listOpenBlocks();
    for (const block of blocks) {
      const mine = block.people.some((person) => person.id === input.userId);
      if (input.role !== "admin" && !mine) continue;
      if (input.role !== "admin" && block.subjectType === "opportunity") continue;
      notifications.push({
        id: `block-${block.id}`,
        kind: "block",
        title: block.title || "Bloqueio",
        detail: mine ? `Está indicado neste bloqueio. ${block.reason}` : block.reason,
        section: block.subjectType === "opportunity" ? "commercial" : "objectives",
      });
    }
  } catch (error) {
    console.error("[backoffice] block notifications failed", error instanceof Error ? error.message : "unknown");
  }

  if (input.role === "admin") {
    try {
      const steps = await loadCommercialSteps();
      for (const step of steps) {
        if (!step.next) continue;
        notifications.push({
          id: `step-${step.id}`,
          kind: "commercial_step",
          title: step.title,
          detail: `${step.contactName || "Contacto"} · há ${step.days} ${step.days === 1 ? "dia" : "dias"} em ${stageStepLimits[step.stage].label}. ${step.next}`,
          section: "commercial",
        });
      }
    } catch (error) {
      console.error("[backoffice] commercial notifications failed", error instanceof Error ? error.message : "unknown");
    }
    try {
      notifications.push(...await paymentNotice());
    } catch (error) {
      console.error("[backoffice] payment notifications failed", error instanceof Error ? error.message : "unknown");
    }
  }

  try {
    notifications.push(...await objectiveNotices(input.role, input.userId, input.areaIds));
  } catch (error) {
    console.error("[backoffice] objective notifications failed", error instanceof Error ? error.message : "unknown");
  }

  const order = { block: 0, commercial_step: 1, payment: 2, objective: 3 };
  return notifications.sort((left, right) => order[left.kind] - order[right.kind]).slice(0, 30);
}
