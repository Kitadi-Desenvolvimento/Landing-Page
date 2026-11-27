import "server-only";

import { loadCommercialSteps, stageStepLimits, type CommercialStep } from "./commercial-steps";
import { isStaffSchemaMissing, loadDisplayNames } from "./staff-profiles";
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
      id: due ? `objective:${row.id}:due:${row.due_date}` : `objective:${row.id}:silent:${periodStart ?? "open"}`,
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
    .neq("payment_provider", "manual")
    .is("reconciled_at", null);
  if (error || !count) return [] as StaffNotification[];
  return [{
    id: `payments-unreconciled:${count}`,
    kind: "payment" as const,
    title: count === 1 ? "1 pagamento por reconciliar" : `${count} pagamentos por reconciliar`,
    detail: "Entraram pelo checkout e ainda não foram conferidos com a WiPay.",
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

function commercialNotices(step: CommercialStep, ownerName: string): StaffNotification[] {
  const person = step.contactName || step.title || "Contacto";
  const notices: StaffNotification[] = [];
  if (step.followDue && step.followUpAt) {
    const today = luandaToday();
    const followDay = luandaDay(step.followUpAt);
    const when = followDay && followDay < today
      ? `O seguimento é de ${formatDay(followDay)}.`
      : "O seguimento é para hoje.";
    notices.push({
      id: `follow:${step.id}:${step.followUpAt}`,
      kind: "commercial_step",
      title: person,
      detail: `${ownerName} · ${when}`,
      section: "commercial",
      targetId: step.id,
    });
  }
  if (step.stageDue) {
    const days = `${step.days} ${step.days === 1 ? "dia" : "dias"}`;
    notices.push({
      id: `stage:${step.id}:${step.stage}:${step.enteredAt}`,
      kind: "commercial_step",
      title: person,
      detail: `${ownerName} · Há ${days} em ${stageStepLimits[step.stage].label}.`,
      section: "commercial",
      targetId: step.id,
    });
  }
  return notices;
}

function isNoticeKey(key: string) {
  return key.length > 0 && key.length <= 500 && !/[\u0000-\u001f]/.test(key);
}

export async function dismissStaffNotifications(userId: string, keys: string[]) {
  const unique = [...new Set(keys)];
  if (unique.length === 0 || unique.length > 3000 || unique.some((key) => !isNoticeKey(key))) {
    return "invalid" as const;
  }
  const admin = createSupabaseAdminClient();
  for (let index = 0; index < unique.length; index += 100) {
    const slice = unique.slice(index, index + 100);
    const { error } = await admin
      .from("staff_notification_dismissals")
      .upsert(
        slice.map((noticeKey) => ({ user_id: userId, notice_key: noticeKey })),
        { onConflict: "user_id,notice_key" },
      );
    if (error) {
      if (isStaffSchemaMissing(error.code)) return "missing" as const;
      throw error;
    }
  }
  return "ok" as const;
}

async function hiddenNoticeKeys(userId: string, keys: string[]) {
  const hidden = new Set<string>();
  if (keys.length === 0) return hidden;
  const admin = createSupabaseAdminClient();
  for (let index = 0; index < keys.length; index += 100) {
    const slice = keys.slice(index, index + 100);
    const { data, error } = await admin
      .from("staff_notification_dismissals")
      .select("notice_key")
      .eq("user_id", userId)
      .in("notice_key", slice);
    if (error) {
      if (isStaffSchemaMissing(error.code)) return hidden;
      throw error;
    }
    for (const row of data ?? []) {
      if (typeof row.notice_key === "string") hidden.add(row.notice_key);
    }
  }
  return hidden;
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
    const ownerNames = await loadDisplayNames(steps.flatMap((step) => step.createdBy ? [step.createdBy] : []));
    for (const step of steps) {
      if (!step.followDue && !step.stageDue) continue;
      const owns = step.createdBy === input.userId;
      const unowned = !step.createdBy;
      if (input.role !== "admin" && !owns) continue;
      if (input.role === "admin" || owns || unowned) {
        const ownerName = step.createdBy ? ownerNames.get(step.createdBy) || "Comercial" : "Sem comercial";
        notifications.push(...commercialNotices(step, ownerName));
      }
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
  const hidden = await hiddenNoticeKeys(input.userId, notifications.map((item) => item.id));
  return notifications
    .filter((item) => !hidden.has(item.id))
    .sort((left, right) => order[left.kind] - order[right.kind] || left.title.localeCompare(right.title, "pt"));
}
