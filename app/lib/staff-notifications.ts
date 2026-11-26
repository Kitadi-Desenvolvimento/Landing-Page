import "server-only";

import { loadCommercialSteps, stageStepLimits, type CommercialStep } from "./commercial-steps";
import { objectivePeriodEnd, objectivePeriodStart, type ObjectivePeriodType } from "./objective-periods";
import { createSupabaseAdminClient } from "./supabase/admin";
import type { BackofficeRole } from "./supabase/require-admin";
import { listOpenBlocks } from "./work-blocks";

export type StaffNotification = {
  id: string;
  kind: "block" | "commercial_step" | "objective" | "payment";
  title: string;
  detail: string;
  section: "objectives" | "commercial" | "payments";
  targetId: string | null;
};

function luandaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Luanda" }).format(new Date());
}

function isPeriod(value: string): value is ObjectivePeriodType {
  return value === "annual" || value === "monthly" || value === "weekly" || value === "daily";
}

async function pageRows<T>(
  load: (from: number) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await load(from);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function objectiveNotices(role: BackofficeRole, userId: string, areaIds: string[] | null) {
  const admin = createSupabaseAdminClient();
  const parents = await pageRows<{
    id: string;
    title: string;
    due_date: string | null;
    period_type: string | null;
    period_start: string | null;
    assigned_to: string | null;
    area_id: string | null;
    scope_type: string | null;
  }>((from) => {
    let query = admin
      .from("objectives")
      .select("id,title,due_date,period_type,period_start,assigned_to,area_id,scope_type")
      .eq("archived", false)
      .eq("active", true)
      .is("parent_objective_id", null)
      .range(from, from + 999);
    if (role === "collaborator" || (role === "manager" && !areaIds?.length)) {
      query = query.eq("assigned_to", userId);
    } else if (role === "manager" && areaIds?.length) {
      query = query.or(`assigned_to.eq.${userId},and(scope_type.eq.department,area_id.in.(${areaIds.join(",")}))`);
    }
    return query;
  });
  if (parents.length === 0) return [] as StaffNotification[];
  const parentIds = parents.map((row) => row.id);
  const children: { id: string; parent_objective_id: string }[] = [];
  for (let index = 0; index < parentIds.length; index += 100) {
    const slice = parentIds.slice(index, index + 100);
    children.push(...await pageRows<{ id: string; parent_objective_id: string }>((from) =>
      admin.from("objectives").select("id,parent_objective_id").in("parent_objective_id", slice).eq("active", true).eq("archived", false).range(from, from + 999),
    ));
  }
  const parentOf = new Map(children.map((row) => [row.id, row.parent_objective_id]));
  const watched = [...parentIds, ...children.map((row) => row.id)];
  const checkins: { objective_id: string; checkin_date: string }[] = [];
  for (let index = 0; index < watched.length; index += 100) {
    const slice = watched.slice(index, index + 100);
    checkins.push(...await pageRows<{ objective_id: string; checkin_date: string }>((from) =>
      admin.from("objective_checkins").select("objective_id,checkin_date").in("objective_id", slice).range(from, from + 999),
    ));
  }
  const today = luandaToday();
  return parents.flatMap((row) => {
    const due = typeof row.due_date === "string" && row.due_date <= today;
    const periodStart = row.period_type && isPeriod(row.period_type) && row.period_start
      ? objectivePeriodStart(row.period_type, row.period_start)
      : null;
    const periodEnd = periodStart && row.period_type && isPeriod(row.period_type)
      ? objectivePeriodEnd(row.period_type, periodStart)
      : null;
    const hasCheckin = periodStart !== null && periodEnd !== null && checkins.some((checkin) => {
      const owner = checkin.objective_id === row.id ? row.id : parentOf.get(checkin.objective_id);
      const day = String(checkin.checkin_date).slice(0, 10);
      return owner === row.id && day >= periodStart && day < periodEnd;
    });
    const silent = periodStart !== null && !hasCheckin;
    if (!due && !silent) return [];
    return [{
      id: `objective-${row.id}`,
      kind: "objective" as const,
      title: row.title,
      detail: due ? "O prazo deste objectivo já chegou." : "Ainda não há check-in neste período.",
      section: "objectives" as const,
      targetId: row.id,
    }];
  });
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
    detail: "Já entraram e ainda não foram conferidos.",
    section: "payments" as const,
    targetId: null,
  }];
}

function luandaDay(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Luanda" }).format(time);
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

function commercialNotice(step: CommercialStep): StaffNotification {
  const today = luandaToday();
  const followDay = step.followUpAt ? luandaDay(step.followUpAt) : null;
  const reason = step.stageDue
    ? `Há ${step.days} ${step.days === 1 ? "dia" : "dias"} em ${stageStepLimits[step.stage].label}.`
    : followDay && followDay < today
      ? `O seguimento é de ${formatDay(followDay)}.`
      : "O seguimento é para hoje.";
  return {
    id: `step-${step.id}`,
    kind: "commercial_step",
    title: step.title,
    detail: `${step.contactName || "Contacto"} · ${reason} ${step.next ?? ""}`.trim(),
    section: "commercial",
    targetId: step.id,
  };
}

export async function loadStaffNotifications(input: {
  role: BackofficeRole;
  userId: string;
  areaIds: string[] | null;
  steps?: CommercialStep[];
}) {
  const notifications: StaffNotification[] = [];
  try {
    const blocks = await listOpenBlocks();
    for (const block of blocks) {
      const mine = block.people.some((person) => person.id === input.userId);
      if (input.role !== "admin" && !mine) continue;
      notifications.push({
        id: `block-${block.id}`,
        kind: "block",
        title: block.title || "Bloqueio",
        detail: mine ? `Está indicado neste bloqueio. ${block.reason}` : block.reason,
        section: block.subjectType === "opportunity" ? "commercial" : "objectives",
        targetId: block.subjectId,
      });
    }
  } catch (error) {
    console.error("[backoffice] block notifications failed", error instanceof Error ? error.message : "unknown");
  }

  try {
    const steps = input.steps ?? await loadCommercialSteps();
    for (const step of steps) {
      if (!step.next) continue;
      const owns = step.createdBy === input.userId;
      const unowned = !step.createdBy;
      if (input.role !== "admin" && !owns) continue;
      if (input.role === "admin" || owns || unowned) notifications.push(commercialNotice(step));
    }
  } catch (error) {
    console.error("[backoffice] commercial notifications failed", error instanceof Error ? error.message : "unknown");
  }

  if (input.role === "admin") {
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
  return notifications.sort((left, right) => order[left.kind] - order[right.kind] || left.title.localeCompare(right.title, "pt"));
}
