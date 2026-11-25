import "server-only";

import {
  objectivePeriodEnd,
  objectivePeriodRank,
  objectivePeriodStart,
  type ObjectivePeriodType,
} from "./objective-periods";
import { loadAvailableProducts } from "./objective-products";
import { getFinanceData } from "./finance";
import { loadCommercialSteps, notifyDueCommercialSteps, stageStepLimits } from "./commercial-steps";
import { personLabel } from "./person-label";
import { isStaffSchemaMissing, listVisibleStaff } from "./staff-profiles";
import { createSupabaseAdminClient } from "./supabase/admin";
import { listOpenBlocks } from "./work-blocks";
import { formatProgressPercent, measureObjectiveProgress } from "./objective-progress";

export type CommandPeriod = "day" | "week" | "month" | "year";

type ObjectiveRow = {
  id: string;
  title: string;
  scope_type: "company" | "department" | "collaborator";
  area_id: string | null;
  assigned_to: string | null;
  period_type: ObjectivePeriodType | null;
  period_start: string | null;
  due_date: string | null;
  product_id: string | null;
  parent_objective_id: string | null;
  value_type: string;
  target_value: unknown;
  unit: string;
  active: boolean;
  archived: boolean;
};

type OrderRow = {
  reference: string;
  amount_kz: number;
  course_slug: string;
  product_title: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  created_by: string | null;
  reconciled_at: string | null;
};

type OpportunityRow = {
  id: string;
  title: string;
  stage: string;
  amount_kz: number | null;
  product_slug: string | null;
  follow_up_at: string | null;
  created_by: string | null;
  created_at: string;
  payment_status: string | null;
  contact: { name?: string } | { name?: string }[] | null;
};

const stageLabels: Record<string, string> = {
  new_contact: "Contacto novo",
  in_conversation: "Em conversa",
  proposal_sent: "Proposta enviada",
  converted: "Convertido",
  lost: "Perdido",
};

function luandaToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Luanda" }).format(now);
}

function windowFor(period: CommandPeriod, now = new Date()) {
  const type: ObjectivePeriodType = period === "day" ? "daily" : period === "week" ? "weekly" : period === "month" ? "monthly" : "annual";
  const today = luandaToday(now);
  const fromDate = objectivePeriodStart(type, today);
  const toDate = fromDate ? objectivePeriodEnd(type, fromDate) : null;
  if (!fromDate || !toDate) return null;
  return {
    type,
    fromDate,
    toDate,
    from: new Date(`${fromDate}T00:00:00+01:00`).toISOString(),
    to: new Date(`${toDate}T00:00:00+01:00`).toISOString(),
  };
}

function inRange(value: string | null, from: string, to: string) {
  if (!value) return false;
  return value >= from && value < to;
}

function rangesOverlap(start: string, end: string, fromDate: string, toDate: string) {
  return start < toDate && fromDate < end;
}

function contactName(contact: OpportunityRow["contact"]) {
  if (Array.isArray(contact)) return contact[0]?.name ?? "";
  return contact?.name ?? "";
}

function numericTarget(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

function formatMeasure(value: unknown, measure?: { value_type: string; unit: string }) {
  const numeric = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))
      ? Number(value)
      : null;
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (numeric !== null) {
    const number = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 }).format(numeric);
    if (measure?.value_type === "percentage") return `${number}%`;
    if (measure?.value_type === "currency") return `${number} Kz`;
    return measure?.unit ? `${number} ${measure.unit}` : number;
  }
  if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

function elapsedFraction(type: ObjectivePeriodType, start: string, end: string, now = new Date()) {
  const startMs = new Date(`${start}T00:00:00+01:00`).getTime();
  const endMs = new Date(`${end}T00:00:00+01:00`).getTime();
  const nowMs = now.getTime();
  if (endMs <= startMs) return 0;
  return Math.min(1, Math.max(0, (nowMs - startMs) / (endMs - startMs)));
}

function orderDay(order: OrderRow) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Luanda" }).format(new Date(order.paid_at ?? order.created_at));
}

function dayLabel(date: string) {
  return new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

function monthLabel(date: string) {
  const label = new Intl.DateTimeFormat("pt-PT", { month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  return label.replace(".", "");
}

function sumBetween(orders: OrderRow[], start: string, end: string) {
  return orders.reduce((sum, order) => {
    const day = orderDay(order);
    return day >= start && day < end ? sum + Number(order.amount_kz ?? 0) : sum;
  }, 0);
}

function buildRevenueSeries(period: CommandPeriod, fromDate: string, toDate: string, orders: OrderRow[]) {
  const points: { label: string; amount: number }[] = [];
  if (period === "day") {
    return [{ label: "Hoje", amount: sumBetween(orders, fromDate, toDate) }];
  }
  if (period === "year") {
    let cursor = fromDate;
    while (cursor < toDate) {
      const end = objectivePeriodEnd("monthly", cursor) ?? toDate;
      points.push({ label: monthLabel(cursor), amount: sumBetween(orders, cursor, end) });
      if (end <= cursor) break;
      cursor = end;
    }
    return points;
  }
  if (period === "month") {
    let cursor = fromDate;
    while (cursor < toDate) {
      const weekEnd = objectivePeriodEnd("weekly", objectivePeriodStart("weekly", cursor) ?? cursor) ?? toDate;
      const end = weekEnd < toDate ? weekEnd : toDate;
      points.push({ label: dayLabel(cursor), amount: sumBetween(orders, cursor, end) });
      if (end <= cursor) break;
      cursor = end;
    }
    return points;
  }
  let cursor = fromDate;
  while (cursor < toDate) {
    const end = objectivePeriodEnd("daily", cursor) ?? toDate;
    points.push({ label: dayLabel(cursor), amount: sumBetween(orders, cursor, end) });
    if (end <= cursor) break;
    cursor = end;
  }
  return points;
}

function formatKz(value: number) {
  return `${new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(value)} Kz`;
}

type ActivityDomain = "objectives" | "commercial" | "payments";

type ActivityEvent = {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  domain: ActivityDomain;
  verb: string;
  subject: string;
};

type ActivityWindow = { from: string; to: string };

function actorMatches(person: string, actorId: string | null) {
  return Boolean(actorId) && (person === "all" || actorId === person);
}

function productMatches(product: string, slug: string | null | undefined) {
  return product === "all" || slug === product;
}

async function rowsOrEmpty<T>(
  query: PromiseLike<{ data: T[] | null; error: { code?: string } | null }>,
) {
  const { data, error } = await query;
  if (error) {
    if (isStaffSchemaMissing(error.code)) return [] as T[];
    throw error;
  }
  return data ?? [];
}

async function loadCommandActivity(input: {
  bounds: ActivityWindow;
  person: string;
  product: string;
  people: { id: string; email: string; displayName: string }[];
  objectives: ObjectiveRow[];
  opportunities: OpportunityRow[];
}) {
  const admin = createSupabaseAdminClient();
  const objectiveTitle = new Map(input.objectives.map((objective) => [objective.id, objective.title]));
  const objectiveProduct = new Map(input.objectives.map((objective) => [objective.id, objective.product_id]));
  const objectiveMeasure = new Map(input.objectives.map((objective) => [objective.id, { value_type: objective.value_type, unit: objective.unit }]));
  const opportunityTitle = new Map(input.opportunities.map((opportunity) => [opportunity.id, opportunity.title]));
  const opportunityProduct = new Map(input.opportunities.map((opportunity) => [opportunity.id, opportunity.product_slug]));
  const opportunityContact = new Map(input.opportunities.map((opportunity) => [opportunity.id, contactName(opportunity.contact)]));
  const names = new Map(input.people.map((person) => [person.id, personLabel(person.displayName, person.email)]));
  const nameFor = (id: string, email: string) => names.get(id) ?? personLabel("", email);

  const [history, checkins, edits, commercial, registered, reconciled, blocksOpened, blocksLifted] = await Promise.all([
    rowsOrEmpty(admin.from("objective_activity_history").select("id,objective_id,objective_title,event_type,actor_id,actor_email,created_at").gte("created_at", input.bounds.from).lt("created_at", input.bounds.to).order("created_at", { ascending: false }).limit(400)),
    rowsOrEmpty(admin.from("objective_checkins").select("id,objective_id,value,checked_in_by,checked_in_by_email,created_at").gte("created_at", input.bounds.from).lt("created_at", input.bounds.to).order("created_at", { ascending: false }).limit(400)),
    rowsOrEmpty(admin.from("objective_checkin_edits").select("id,checkin_id,previous_value,edited_by,edited_by_email,edited_at").gte("edited_at", input.bounds.from).lt("edited_at", input.bounds.to).order("edited_at", { ascending: false }).limit(200)),
    rowsOrEmpty(admin.from("crm_opportunity_history").select("id,opportunity_id,event_type,to_stage,details,changed_by,changed_by_email,created_at").gte("created_at", input.bounds.from).lt("created_at", input.bounds.to).order("created_at", { ascending: false }).limit(400)),
    rowsOrEmpty(admin.from("payment_orders").select("reference,amount_kz,product_title,course_slug,created_by,created_at").gte("created_at", input.bounds.from).lt("created_at", input.bounds.to).not("created_by", "is", null).order("created_at", { ascending: false }).limit(200)),
    rowsOrEmpty(admin.from("payment_orders").select("reference,amount_kz,product_title,course_slug,reconciled_by,reconciled_at").gte("reconciled_at", input.bounds.from).lt("reconciled_at", input.bounds.to).not("reconciled_by", "is", null).order("reconciled_at", { ascending: false }).limit(200)),
    rowsOrEmpty(admin.from("work_blocks").select("id,subject_type,subject_id,created_by,created_at").gte("created_at", input.bounds.from).lt("created_at", input.bounds.to).order("created_at", { ascending: false }).limit(100)),
    rowsOrEmpty(admin.from("work_blocks").select("id,subject_type,subject_id,lifted_by,lifted_at").gte("lifted_at", input.bounds.from).lt("lifted_at", input.bounds.to).order("lifted_at", { ascending: false }).limit(100)),
  ]);

  const commercialRows = commercial as { id: string; opportunity_id: string; event_type: string; to_stage: string | null; details: string; changed_by: string | null; changed_by_email: string; created_at: string }[];
  const missingOpportunities = [...new Set([
    ...commercialRows.map((row) => row.opportunity_id),
    ...(blocksOpened as { subject_type: string; subject_id: string }[]).filter((block) => block.subject_type === "opportunity").map((block) => block.subject_id),
    ...(blocksLifted as { subject_type: string; subject_id: string }[]).filter((block) => block.subject_type === "opportunity").map((block) => block.subject_id),
  ])].filter((id) => id && !opportunityTitle.has(id));
  if (missingOpportunities.length > 0) {
    const extra = await rowsOrEmpty<{ id: string; title: string; product_slug: string | null; contact: OpportunityRow["contact"] }>(
      admin.from("crm_opportunities").select("id,title,product_slug,contact:crm_contacts!crm_opportunities_contact_id_fkey(name)").in("id", missingOpportunities.slice(0, 200)),
    );
    for (const opportunity of extra) {
      opportunityTitle.set(opportunity.id, opportunity.title);
      opportunityProduct.set(opportunity.id, opportunity.product_slug);
      opportunityContact.set(opportunity.id, contactName(opportunity.contact));
    }
  }

  const editRows = edits as { id: string; checkin_id: string; previous_value: unknown; edited_by: string | null; edited_by_email: string; edited_at: string }[];
  const checkinValue = new Map<string, unknown>();
  const checkinObjective = new Map<string, string>();
  for (const checkin of checkins as { id: string; objective_id: string; value: unknown }[]) {
    checkinValue.set(checkin.id, checkin.value);
    checkinObjective.set(checkin.id, checkin.objective_id);
  }
  const missingCheckins = [...new Set(editRows.map((edit) => edit.checkin_id))].filter((id) => !checkinObjective.has(id));
  if (missingCheckins.length > 0) {
    const linked = await rowsOrEmpty<{ id: string; objective_id: string; value: unknown }>(
      admin.from("objective_checkins").select("id,objective_id,value").in("id", missingCheckins.slice(0, 200)),
    );
    for (const checkin of linked) {
      checkinObjective.set(checkin.id, checkin.objective_id);
      checkinValue.set(checkin.id, checkin.value);
    }
  }

  const knownObjectives = new Set([...objectiveTitle.keys()]);
  const missingObjectives = [...new Set([
    ...(checkins as { objective_id: string }[]).map((checkin) => checkin.objective_id),
    ...checkinObjective.values(),
    ...(blocksOpened as { subject_type: string; subject_id: string }[]).filter((block) => block.subject_type === "objective").map((block) => block.subject_id),
    ...(blocksLifted as { subject_type: string; subject_id: string }[]).filter((block) => block.subject_type === "objective").map((block) => block.subject_id),
  ])].filter((id) => id && !knownObjectives.has(id));
  if (missingObjectives.length > 0) {
    const extra = await rowsOrEmpty<{ id: string; title: string; product_id: string | null }>(
      admin.from("objectives").select("id,title,product_id").in("id", missingObjectives.slice(0, 200)),
    );
    for (const objective of extra) {
      objectiveTitle.set(objective.id, objective.title);
      objectiveProduct.set(objective.id, objective.product_id);
    }
  }

  const events: ActivityEvent[] = [];
  const push = (event: ActivityEvent | null) => {
    if (event) events.push(event);
  };

  for (const row of history as { id: string; objective_id: string | null; objective_title: string; event_type: string; actor_id: string | null; actor_email: string; created_at: string }[]) {
    if (!actorMatches(input.person, row.actor_id) || !row.actor_id) continue;
    if (!productMatches(input.product, row.objective_id ? objectiveProduct.get(row.objective_id) : null)) continue;
    const verb = row.event_type === "created" ? "Criou a meta" : row.event_type === "archived" ? "Arquivou a meta" : row.event_type === "restored" ? "Reactivou a meta" : "Actualizou os dados da meta";
    push({ id: `objective-${row.id}`, at: row.created_at, actorId: row.actor_id, actorName: nameFor(row.actor_id, row.actor_email), domain: "objectives", verb, subject: row.objective_title });
  }

  for (const row of checkins as { id: string; objective_id: string; value: unknown; checked_in_by: string | null; checked_in_by_email: string; created_at: string }[]) {
    if (!actorMatches(input.person, row.checked_in_by) || !row.checked_in_by) continue;
    if (!productMatches(input.product, objectiveProduct.get(row.objective_id))) continue;
    const measured = formatMeasure(row.value, objectiveMeasure.get(row.objective_id));
    push({ id: `checkin-${row.id}`, at: row.created_at, actorId: row.checked_in_by, actorName: nameFor(row.checked_in_by, row.checked_in_by_email), domain: "objectives", verb: measured ? `Registou ${measured}` : "Registou progresso sem valor", subject: objectiveTitle.get(row.objective_id) ?? "Meta" });
  }

  for (const row of editRows) {
    const objectiveId = checkinObjective.get(row.checkin_id);
    if (!actorMatches(input.person, row.edited_by) || !row.edited_by || !objectiveId) continue;
    if (!productMatches(input.product, objectiveProduct.get(objectiveId))) continue;
    const measure = objectiveMeasure.get(objectiveId);
    const before = formatMeasure(row.previous_value, measure);
    const after = formatMeasure(checkinValue.get(row.checkin_id), measure);
    const verb = before && after ? `Corrigiu o progresso de ${before} para ${after}` : before ? `Corrigiu o progresso, que estava em ${before}` : "Corrigiu o progresso";
    push({ id: `edit-${row.id}`, at: row.edited_at, actorId: row.edited_by, actorName: nameFor(row.edited_by, row.edited_by_email), domain: "objectives", verb, subject: objectiveTitle.get(objectiveId) ?? "Meta" });
  }

  for (const row of commercialRows) {
    const details = row.details ?? "";
    if (!row.changed_by || details.includes("checkout") || details.includes("automaticamente")) continue;
    if (!actorMatches(input.person, row.changed_by)) continue;
    if (!productMatches(input.product, opportunityProduct.get(row.opportunity_id))) continue;
    const stage = stageLabels[row.to_stage ?? ""] ?? "nova etapa";
    const contact = opportunityContact.get(row.opportunity_id) || "o contacto";
    const verb = row.event_type === "created"
      ? `Criou a oportunidade de ${contact}`
      : row.event_type === "stage_changed"
        ? `Passou ${contact} para ${stage}`
        : row.event_type === "payment_updated"
          ? `Actualizou o pagamento de ${contact}`
          : `Actualizou o próximo contacto de ${contact}`;
    push({ id: `commercial-${row.id}`, at: row.created_at, actorId: row.changed_by, actorName: nameFor(row.changed_by, row.changed_by_email), domain: "commercial", verb, subject: opportunityTitle.get(row.opportunity_id) ?? "Oportunidade" });
  }

  for (const row of registered as { reference: string; amount_kz: number; product_title: string; course_slug: string; created_by: string | null; created_at: string }[]) {
    if (!actorMatches(input.person, row.created_by) || !row.created_by) continue;
    if (!productMatches(input.product, row.course_slug)) continue;
    push({ id: `payment-${row.reference}`, at: row.created_at, actorId: row.created_by, actorName: nameFor(row.created_by, ""), domain: "payments", verb: `Registou o pagamento de ${formatKz(Number(row.amount_kz ?? 0))}`, subject: row.product_title });
  }

  for (const row of reconciled as { reference: string; amount_kz: number; product_title: string; course_slug: string; reconciled_by: string | null; reconciled_at: string | null }[]) {
    if (!row.reconciled_at || !actorMatches(input.person, row.reconciled_by) || !row.reconciled_by) continue;
    if (!productMatches(input.product, row.course_slug)) continue;
    push({ id: `reconcile-${row.reference}`, at: row.reconciled_at, actorId: row.reconciled_by, actorName: nameFor(row.reconciled_by, ""), domain: "payments", verb: `Conferiu o pagamento de ${formatKz(Number(row.amount_kz ?? 0))}`, subject: row.product_title });
  }

  const blockIds = [
    ...(blocksOpened as { id: string }[]).map((block) => block.id),
    ...(blocksLifted as { id: string }[]).map((block) => block.id),
  ];
  const blockPeople = new Map<string, string[]>();
  if (blockIds.length > 0) {
    const peopleRows = await rowsOrEmpty<{ block_id: string; user_id: string }>(
      admin.from("work_block_people").select("block_id,user_id").in("block_id", blockIds.slice(0, 200)),
    );
    for (const personRow of peopleRows) {
      const personName = names.get(personRow.user_id);
      if (!personName) continue;
      blockPeople.set(personRow.block_id, [...(blockPeople.get(personRow.block_id) ?? []), personName]);
    }
  }
  const blockSubject = (subjectType: string, subjectId: string) => {
    if (subjectType === "opportunity") return { domain: "commercial" as const, title: opportunityTitle.get(subjectId) ?? "Oportunidade", product: opportunityProduct.get(subjectId) };
    return { domain: "objectives" as const, title: objectiveTitle.get(subjectId) ?? "Objectivo", product: objectiveProduct.get(subjectId) };
  };
  for (const row of blocksOpened as { id: string; subject_type: string; subject_id: string; created_by: string | null; created_at: string }[]) {
    if (!actorMatches(input.person, row.created_by) || !row.created_by) continue;
    const subject = blockSubject(row.subject_type, row.subject_id);
    if (!productMatches(input.product, subject.product)) continue;
    const named = blockPeople.get(row.id) ?? [];
    const verb = named.length > 0 ? `Marcou um bloqueio e indicou ${named.join(" e ")}` : "Marcou um bloqueio";
    push({ id: `block-${row.id}`, at: row.created_at, actorId: row.created_by, actorName: nameFor(row.created_by, ""), domain: subject.domain, verb, subject: subject.title });
  }
  for (const row of blocksLifted as { id: string; subject_type: string; subject_id: string; lifted_by: string | null; lifted_at: string | null }[]) {
    if (!row.lifted_at || !actorMatches(input.person, row.lifted_by) || !row.lifted_by) continue;
    const subject = blockSubject(row.subject_type, row.subject_id);
    if (!productMatches(input.product, subject.product)) continue;
    const named = blockPeople.get(row.id) ?? [];
    const verb = named.length > 0 ? `Retirou o bloqueio de ${named.join(" e ")}` : "Retirou o bloqueio";
    push({ id: `unblock-${row.id}`, at: row.lifted_at, actorId: row.lifted_by, actorName: nameFor(row.lifted_by, ""), domain: subject.domain, verb, subject: subject.title });
  }

  const sorted = events.sort((a, b) => b.at.localeCompare(a.at));
  const performance = new Map<string, { id: string; name: string; objectives: number; commercial: number; payments: number }>();
  for (const event of sorted) {
    const current = performance.get(event.actorId) ?? { id: event.actorId, name: event.actorName, objectives: 0, commercial: 0, payments: 0 };
    current[event.domain] += 1;
    performance.set(event.actorId, current);
  }
  return {
    events: sorted.slice(0, 80),
    performance: [...performance.values()]
      .map((row) => ({ ...row, total: row.objectives + row.commercial + row.payments }))
      .sort((left, right) => right.total - left.total || left.name.localeCompare(right.name, "pt"))
      .slice(0, 12),
  };
}

export async function buildCommandDashboard(input: {
  userId: string;
  period: CommandPeriod;
  personId: string;
  product: string;
  stage: string;
  paymentStatus: string;
  objectiveSituation: string;
}) {
  const bounds = windowFor(input.period);
  if (!bounds) throw new Error("invalid_period");
  const admin = createSupabaseAdminClient();
  const [objectivesResult, ordersResult, opportunitiesResult, membershipsResult, products, people, blocks] = await Promise.all([
    admin.from("objectives").select("id,title,scope_type,area_id,assigned_to,period_type,period_start,due_date,product_id,parent_objective_id,value_type,target_value,unit,active,archived").eq("archived", false).limit(2000),
    admin.from("payment_orders").select("reference,amount_kz,course_slug,product_title,status,created_at,paid_at,created_by,reconciled_at").order("created_at", { ascending: false }).limit(2000),
    admin.from("crm_opportunities").select("id,title,stage,amount_kz,product_slug,follow_up_at,created_by,created_at,payment_status,contact:crm_contacts!crm_opportunities_contact_id_fkey(name)").order("created_at", { ascending: false }).limit(2000),
    admin.from("objective_area_members").select("area_id,user_id"),
    loadAvailableProducts(),
    listVisibleStaff("admin", input.userId, null),
    listOpenBlocks(),
  ]);
  if (objectivesResult.error) throw objectivesResult.error;
  if (ordersResult.error) throw ordersResult.error;
  if (opportunitiesResult.error) throw opportunitiesResult.error;
  if (membershipsResult.error) throw membershipsResult.error;

  const objectives = (objectivesResult.data ?? []) as ObjectiveRow[];
  const orders = (ordersResult.data ?? []) as OrderRow[];
  const opportunities = (opportunitiesResult.data ?? []) as OpportunityRow[];
  const areasByUser = new Map<string, string[]>();
  for (const membership of membershipsResult.data ?? []) {
    areasByUser.set(membership.user_id, [...(areasByUser.get(membership.user_id) ?? []), membership.area_id]);
  }
  const person = input.personId;
  const belongsToPerson = (objective: ObjectiveRow) => {
    if (person === "all") return true;
    if (objective.assigned_to === person) return true;
    return objective.scope_type === "department" &&
      objective.area_id !== null &&
      (areasByUser.get(person) ?? []).includes(objective.area_id);
  };
  const productOk = (slug: string | null) => input.product === "all" || slug === input.product;
  const objectiveIds = objectives.map((objective) => objective.id);
  const latestCheckin = new Map<string, { date: string; value: unknown }>();
  for (let index = 0; index < objectiveIds.length; index += 150) {
    const slice = objectiveIds.slice(index, index + 150);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from("objective_checkins")
        .select("objective_id,checkin_date,value,created_at")
        .in("objective_id", slice)
        .order("checkin_date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, from + 999);
      if (error) throw error;
      for (const checkin of data ?? []) {
        if (!latestCheckin.has(checkin.objective_id)) {
          latestCheckin.set(checkin.objective_id, { date: String(checkin.checkin_date).slice(0, 10), value: checkin.value });
        }
      }
      if (!data || data.length < 1000) break;
    }
  }

  const parents = objectives.filter((objective) =>
    objective.parent_objective_id === null &&
    objective.active &&
    belongsToPerson(objective) &&
    productOk(objective.product_id) &&
    (!objective.period_type || !objective.period_start || rangesOverlap(
      objective.period_start,
      objectivePeriodEnd(objective.period_type, objective.period_start) ?? objective.period_start,
      bounds.fromDate,
      bounds.toDate,
    )),
  );

  const salesFor = (product: string, start: string, end: string) => {
    const matching = orders.filter((order) =>
      order.status === "accepted" &&
      order.course_slug === product &&
      inRange(order.paid_at ?? order.created_at, new Date(`${start}T00:00:00+01:00`).toISOString(), new Date(`${end}T00:00:00+01:00`).toISOString()),
    );
    return {
      count: matching.length,
      amount: matching.reduce((sum, order) => sum + Number(order.amount_kz ?? 0), 0),
    };
  };

  type Pace = { id: string; title: string; detail: string };
  const behind: Pace[] = [];
  const attention: Pace[] = [];
  const presentation = new Map<string, { pace: string; progress: number | null; silent: boolean; dueSoon: boolean }>();
  for (const objective of parents) {
    const keyResults = objectives.filter((item) => item.parent_objective_id === objective.id && item.active);
    const metric = keyResults.find((item) =>
      (item.value_type === "currency" || item.value_type === "number") && numericTarget(item.target_value) !== null,
    );
    const target = metric ? numericTarget(metric.target_value) : null;
    let paceDetail = "";
    let progress: number | null = null;
    let isBehind = false;
    let comparedWithSales = false;
    if (metric && target !== null && objective.product_id && objective.period_type && objective.period_start) {
      const end = objectivePeriodEnd(objective.period_type, objective.period_start);
      if (end) {
        const sales = salesFor(objective.product_id, objective.period_start, end);
        const actual = metric.value_type === "currency" ? sales.amount : sales.count;
        const expected = target * elapsedFraction(objective.period_type, objective.period_start, end);
        const shown = metric.value_type === "currency" ? formatKz(actual) : String(actual);
        const goal = metric.value_type === "currency" ? formatKz(target) : String(target);
        const expectedShown = metric.value_type === "currency" ? formatKz(Math.round(expected)) : String(Math.round(expected));
        paceDetail = metric.value_type === "currency"
          ? `Já entrou ${shown} de ${goal}. Nesta altura já deviam ser cerca de ${expectedShown}.`
          : `Feitos ${shown} de ${goal}. Nesta altura já deviam ser cerca de ${expectedShown}.`;
        progress = target > 0 ? Math.round((actual / target) * 100) : null;
        isBehind = actual < expected;
        comparedWithSales = true;
      }
    }
    const readings: { id: string; line: string }[] = [];
    for (const row of [objective, ...keyResults]) {
      const latest = latestCheckin.get(row.id);
      if (!latest) continue;
      const actual = numericTarget(latest.value);
      const goal = numericTarget(row.target_value);
      const shown = formatMeasure(latest.value, row) || "um valor";
      const goalText = goal !== null ? formatMeasure(goal, row) : "";
      const outside = latest.date < bounds.fromDate || latest.date >= bounds.toDate;
      const when = outside ? ` O registo é de ${formatDay(latest.date)}.` : "";
      const label = row.id === objective.id ? "O progresso registado é" : `${row.title} está em`;
      readings.push({ id: row.id, line: `${label} ${goalText ? `${shown} de ${goalText}` : shown}.${when}` });
    }
    const measure = measureObjectiveProgress(objective, keyResults, (id) => latestCheckin.get(id)?.value);
    if (measure.inherited && measure.percent !== null) {
      progress = Math.round(measure.percent);
      if (!comparedWithSales && objective.period_type && objective.period_start) {
        const end = objectivePeriodEnd(objective.period_type, objective.period_start);
        if (end) isBehind = measure.percent < elapsedFraction(objective.period_type, objective.period_start, end) * 100;
      }
    } else if (progress === null && measure.percent !== null) {
      progress = Math.round(measure.percent);
    }
    let coveredId = "";
    if (!comparedWithSales && !measure.inherited && readings.length > 0) {
      const source = metric && latestCheckin.has(metric.id) ? metric : latestCheckin.has(objective.id) ? objective : keyResults.find((item) => latestCheckin.has(item.id)) ?? null;
      const latest = source ? latestCheckin.get(source.id) : null;
      const actual = latest ? numericTarget(latest.value) : null;
      const goal = source ? numericTarget(source.target_value) : null;
      if (source?.period_type && source.period_start && actual !== null && goal !== null && latest) {
        const end = objectivePeriodEnd(source.period_type, source.period_start);
        if (end) {
          const expected = goal * elapsedFraction(source.period_type, source.period_start, end);
          const shown = formatMeasure(actual, source);
          const goalText = formatMeasure(goal, source);
          const expectedShown = source.value_type === "currency" ? formatKz(Math.round(expected)) : formatMeasure(Math.round(expected), source);
          const outside = latest.date < bounds.fromDate || latest.date >= bounds.toDate;
          const when = outside ? ` O registo é de ${formatDay(latest.date)}.` : "";
          paceDetail = `Feitos ${shown} de ${goalText}. Nesta altura já deviam ser cerca de ${expectedShown}.${when}`;
          isBehind = actual < expected;
          coveredId = source.id;
        }
      }
    }
    if (measure.inherited && measure.percent !== null) {
      const count = measure.keyResultCount === 1 ? "1 KR" : `${measure.keyResultCount} KRs`;
      const average = `O progresso desta meta é a média dos ${count}: ${formatProgressPercent(measure.percent)}%.`;
      paceDetail = paceDetail ? `${average} ${paceDetail}` : average;
    }
    const extraReadings = readings.filter((item) => item.id !== coveredId && !(measure.inherited && item.id === objective.id));
    if (extraReadings.length > 0) {
      const recorded = extraReadings.slice(0, 4).map((item) => item.line).join(" ");
      const more = extraReadings.length > 4 ? ` E mais ${extraReadings.length - 4} ${extraReadings.length - 4 === 1 ? "resultado" : "resultados"}.` : "";
      paceDetail = paceDetail ? `${paceDetail} ${recorded}${more}` : `${recorded}${more}`;
    }
    const dueSoon = objective.due_date !== null && objective.due_date >= bounds.fromDate && objective.due_date < bounds.toDate;
    const silent = measure.inherited ? measure.keyResultsWithValue === 0 : readings.length === 0 && progress === null;
    if (isBehind) {
      const extra = silent ? " Ainda ninguém registou progresso nesta meta." : dueSoon ? " O prazo chega neste período." : "";
      behind.push({ id: objective.id, title: objective.title, detail: `Está atrasada. ${paceDetail}${extra}` });
    } else if (silent || dueSoon) {
      attention.push({
        id: objective.id,
        title: objective.title,
        detail: silent ? "Ainda ninguém registou progresso nesta meta." : "O prazo chega neste período.",
      });
    }
    presentation.set(objective.id, { pace: paceDetail, progress, silent, dueSoon });
  }

  const acceptedInWindow = orders.filter((order) =>
    order.status === "accepted" &&
    inRange(order.paid_at ?? order.created_at, bounds.from, bounds.to) &&
    (person === "all" || order.created_by === person) &&
    productOk(order.course_slug),
  );
  const revenueSeries = buildRevenueSeries(input.period, bounds.fromDate, bounds.toDate, acceptedInWindow);
  const revenueKz = acceptedInWindow.reduce((sum, order) => sum + Number(order.amount_kz ?? 0), 0);

  const filteredOrders = orders.filter((order) => {
    const moment = order.status === "accepted" ? order.paid_at ?? order.created_at : order.created_at;
    if (!inRange(moment, bounds.from, bounds.to)) return false;
    if (person !== "all" && order.created_by !== person) return false;
    if (!productOk(order.course_slug)) return false;
    if (input.paymentStatus === "accepted" && order.status !== "accepted") return false;
    if (input.paymentStatus === "pending" && order.status !== "pending") return false;
    if (input.paymentStatus === "unreconciled" && !(order.status === "accepted" && !order.reconciled_at)) return false;
    return true;
  });
  const accepted = filteredOrders.filter((order) => order.status === "accepted");
  const pending = filteredOrders.filter((order) => order.status === "pending");
  const unreconciled = accepted.filter((order) => !order.reconciled_at);
  const acceptedKz = accepted.reduce((sum, order) => sum + Number(order.amount_kz ?? 0), 0);
  const pendingKz = pending.reduce((sum, order) => sum + Number(order.amount_kz ?? 0), 0);

  const nowIso = new Date().toISOString();
  const filteredOpportunities = opportunities.filter((opportunity) => {
    if (person !== "all" && opportunity.created_by !== person) return false;
    if (!productOk(opportunity.product_slug)) return false;
    if (input.stage !== "all" && opportunity.stage !== input.stage) return false;
    const open = opportunity.stage !== "converted" && opportunity.stage !== "lost";
    const overdue = Boolean(open && opportunity.follow_up_at && opportunity.follow_up_at <= nowIso);
    const touched = inRange(opportunity.created_at, bounds.from, bounds.to) || inRange(opportunity.follow_up_at, bounds.from, bounds.to);
    return touched || overdue;
  });
  const openOpportunities = filteredOpportunities.filter((opportunity) => opportunity.stage !== "converted" && opportunity.stage !== "lost");
  const pipelineKz = openOpportunities.reduce((sum, opportunity) => sum + Number(opportunity.amount_kz ?? 0), 0);
  const overdueFollowUps = openOpportunities.filter((opportunity) => opportunity.follow_up_at && opportunity.follow_up_at <= nowIso);

  const visibleParents = input.objectiveSituation === "attention"
    ? parents.filter((objective) => behind.some((item) => item.id === objective.id) || attention.some((item) => item.id === objective.id))
    : parents;

  const funnel = ["new_contact", "in_conversation", "proposal_sent", "converted", "lost"].map((stage) => {
    const rows = filteredOpportunities.filter((opportunity) => opportunity.stage === stage);
    const amountValue = rows.reduce((sum, opportunity) => sum + Number(opportunity.amount_kz ?? 0), 0);
    return {
      stage,
      label: stageLabels[stage],
      count: rows.length,
      amountValue,
      amount: formatKz(amountValue),
    };
  });
  const proposalsWaiting = openOpportunities.filter((opportunity) => opportunity.stage === "proposal_sent" && opportunity.payment_status !== "accepted");

  let resultKz: number | null = null;
  if (input.period === "month") {
    try {
      const finance = await getFinanceData(2);
      resultKz = finance.periods.find((period) => period.month === bounds.fromDate.slice(0, 7))?.resultKz ?? null;
    } catch {
      resultKz = null;
    }
  }

  const personIsBlocker = (block: { people: { id: string }[]; subjectType: string; subjectId: string }) => {
    if (person === "all") return true;
    if (block.people.some((item) => item.id === person)) return true;
    if (block.subjectType === "objective") {
      const objective = objectives.find((item) => item.id === block.subjectId);
      return Boolean(objective && belongsToPerson(objective));
    }
    const opportunity = opportunities.find((item) => item.id === block.subjectId);
    return opportunity?.created_by === person;
  };
  const visibleBlocks = blocks.filter((block) => personIsBlocker(block) && (
    block.subjectType === "objective"
      ? parents.some((objective) => objective.id === block.subjectId) || person !== "all"
      : filteredOpportunities.some((opportunity) => opportunity.id === block.subjectId) || person !== "all"
  ));

  let commercialSteps: Awaited<ReturnType<typeof loadCommercialSteps>> = [];
  let noticesReady = true;
  try {
    commercialSteps = await loadCommercialSteps();
    const delivery = await notifyDueCommercialSteps(commercialSteps);
    noticesReady = !delivery.unavailable;
  } catch (error) {
    console.error("[backoffice] commercial step notices failed", error instanceof Error ? error.message : "unknown");
  }
  const staffNames = new Map(people.map((item) => [item.id, personLabel(item.displayName, item.email)]));
  const dueSteps = commercialSteps.filter((step) =>
    step.next &&
    productOk(step.productSlug) &&
    (person === "all" || step.createdBy === person),
  );
  const notices = dueSteps.slice(0, 20).map((step) => {
    const personName = step.createdBy ? staffNames.get(step.createdBy) ?? "Equipa" : "";
    const contact = step.contactName || "este contacto";
    const stageLabel = stageStepLimits[step.stage].label;
    const dayLabel = `há ${step.days} ${step.days === 1 ? "dia" : "dias"}`;
    const next = step.next ?? "";
    const action = next.startsWith("Contactar e passar")
      ? "ligar e passar para Em conversa"
      : next.startsWith("Enviar a proposta")
        ? "enviar a proposta ou marcar o próximo contacto"
        : next.startsWith("Confirmar")
          ? "confirmar a decisão ou o pagamento"
          : "fazer o contacto que ficou marcado";
    const line = personName
      ? `Contactar ${contact} sobre ${step.title}. Está ${dayLabel} em ${stageLabel}. ${personName} deve ${action}.`
      : `Contactar ${contact} sobre ${step.title}. Está ${dayLabel} em ${stageLabel} e ainda ninguém da equipa assumiu este contacto. O passo é ${action}.`;
    return {
      id: step.id,
      personName: personName || "Sem responsável",
      title: step.title,
      contactName: step.contactName,
      stageLabel,
      days: step.days,
      next: step.next ?? "",
      line,
    };
  });

  const blockedObjectiveIds = new Set(visibleBlocks.filter((block) => block.subjectType === "objective").map((block) => block.subjectId));
  const behindIds = new Set(behind.map((item) => item.id));
  const attentionById = new Map(attention.map((item) => [item.id, item.detail]));
  const rankObjective = (id: string) => blockedObjectiveIds.has(id) ? 0 : behindIds.has(id) ? 1 : attentionById.has(id) ? 2 : 3;
  const rankedObjectives = [...visibleParents].sort((left, right) =>
    objectivePeriodRank(left.period_type) - objectivePeriodRank(right.period_type)
    || rankObjective(left.id) - rankObjective(right.id)
    || left.title.localeCompare(right.title, "pt"),
  );
  const mixLabel = (id: string) => {
    if (blockedObjectiveIds.has(id)) return "Bloqueadas";
    if (behindIds.has(id)) return "Atrasadas";
    const note = attentionById.get(id);
    if (note?.startsWith("Ainda ninguém registou")) return "Sem progresso";
    if (note) return "Prazo neste período";
    return "Vão a tempo";
  };
  const objectiveMix = ["Vão a tempo", "Atrasadas", "Sem progresso", "Prazo neste período", "Bloqueadas"].map((label) => ({
    label,
    count: rankedObjectives.filter((objective) => mixLabel(objective.id) === label).length,
  }));
  const progressBands = [
    { label: "Metas ainda sem número para comparar com o alvo", test: (value: number | null) => value === null },
    { label: "Metas abaixo de metade do alvo", test: (value: number | null) => value !== null && value < 50 },
    { label: "Metas entre metade e o alvo", test: (value: number | null) => value !== null && value >= 50 && value < 100 },
    { label: "Metas que já chegaram ao alvo", test: (value: number | null) => value !== null && value >= 100 },
  ].map((band) => ({
    label: band.label,
    count: rankedObjectives.filter((objective) => band.test(presentation.get(objective.id)?.progress ?? null)).length,
  }));
  const paymentLabels: Record<string, string> = {
    accepted: "Já entrou",
    pending: "Ainda não pagou",
    rejected: "Recusado",
    expired: "Expirou",
    canceled: "Cancelado",
    refunded: "Devolvido",
  };
  const paymentBreakdown = Object.entries(paymentLabels).map(([status, label]) => {
    const rows = filteredOrders.filter((order) => order.status === status);
    const amountValue = rows.reduce((sum, order) => sum + Number(order.amount_kz ?? 0), 0);
    return {
      status,
      label,
      count: rows.length,
      amountValue,
      amount: formatKz(amountValue),
    };
  });
  const unreconciledKz = unreconciled.reduce((sum, order) => sum + Number(order.amount_kz ?? 0), 0);
  const objectiveActions = [
    ...visibleBlocks.filter((block) => block.subjectType === "objective").map((block) => ({
      id: `block-${block.id}`,
      section: "objectives" as const,
      title: block.title || "Bloqueio",
      detail: `${block.people.map((item) => item.displayName || item.email).join(" e ") || "Sem pessoa indicada"} está a impedir o avanço. ${block.reason}`,
      tone: "block" as const,
    })),
    ...behind.map((item) => ({ id: `pace-${item.id}`, section: "objectives" as const, title: item.title, detail: item.detail, tone: "risk" as const })),
    ...attention.map((item) => ({ id: `check-${item.id}`, section: "objectives" as const, title: item.title, detail: item.detail, tone: "risk" as const })),
  ];
  const commercialActions = [
    ...visibleBlocks.filter((block) => block.subjectType === "opportunity").map((block) => ({
      id: `block-${block.id}`,
      section: "commercial" as const,
      title: block.title || "Bloqueio",
      detail: `${block.people.map((item) => item.displayName || item.email).join(" e ") || "Sem pessoa indicada"} está a impedir o avanço. ${block.reason}`,
      tone: "block" as const,
    })),
    ...proposalsWaiting.map((opportunity) => ({
      id: `proposal-${opportunity.id}`,
      section: "commercial" as const,
      title: opportunity.title,
      detail: `${contactName(opportunity.contact) || "O contacto"} ainda não pagou esta proposta${opportunity.amount_kz ? ` de ${formatKz(Number(opportunity.amount_kz))}` : ""}.`,
      tone: "risk" as const,
    })),
  ];
  const paymentActions = unreconciled.map((order) => ({
    id: `reconcile-${order.reference}`,
    section: "payments" as const,
    title: order.product_title,
    detail: `${formatKz(Number(order.amount_kz ?? 0))} já entraram e ainda não foram conferidos. Referência ${order.reference}.`,
    tone: "risk" as const,
  }));
  const actions = [
    ...objectiveActions.slice(0, 20),
    ...commercialActions.slice(0, 20),
    ...paymentActions.slice(0, 20),
  ];

  const activityReport = await loadCommandActivity({
    bounds,
    person,
    product: input.product,
    people,
    objectives,
    opportunities,
  });

  const attentionCount = new Set([...behind.map((item) => item.id), ...attention.map((item) => item.id)]).size;
  const paceSentence = behind.length > 0
    ? `${behind.length} ${behind.length === 1 ? "meta está atrasada face ao que já devia ter feito até hoje" : "metas estão atrasadas face ao que já deviam ter feito até hoje"}`
    : "As metas com número vão a tempo";

  return {
    period: input.period,
    fromDate: bounds.fromDate,
    toDate: bounds.toDate,
    metrics: {
      revenue: formatKz(revenueKz),
      revenueNote: `${acceptedInWindow.length} ${acceptedInWindow.length === 1 ? "pagamento já entrou" : "pagamentos já entraram"}`,
      pipeline: formatKz(pipelineKz),
      pipelineNote: overdueFollowUps.length === 0
        ? "Este valor ainda não entrou"
        : `${overdueFollowUps.length} ${overdueFollowUps.length === 1 ? "contacto com a hora já passada" : "contactos com a hora já passada"}. Este valor ainda não entrou`,
      attention: String(attentionCount),
      attentionNote: attentionCount === 1 ? "meta que pede uma decisão" : "metas que pedem uma decisão",
    },
    revenueSeries,
    sentences: [
      `Já entraram ${formatKz(revenueKz)}, em ${acceptedInWindow.length} ${acceptedInWindow.length === 1 ? "pagamento" : "pagamentos"}.`,
      `Ainda estão por fechar ${formatKz(pipelineKz)}. ${overdueFollowUps.length} ${overdueFollowUps.length === 1 ? "contacto já devia ter sido feito" : "contactos já deviam ter sido feitos"}.`,
      `${attentionCount} ${attentionCount === 1 ? "meta pede uma decisão" : "metas pedem uma decisão"}. ${paceSentence}.`,
    ],
    actions,
    actionCounts: {
      objectives: objectiveActions.length,
      commercial: commercialActions.length,
      payments: paymentActions.length,
    },
    notices,
    noticeCount: dueSteps.length,
    noticesReady,
    performance: activityReport.performance,
    activity: activityReport.events,
    objectiveMix,
    progressBands,
    objectiveStats: {
      total: rankedObjectives.length,
      behind: rankedObjectives.filter((objective) => behindIds.has(objective.id)).length,
      silent: rankedObjectives.filter((objective) => attentionById.get(objective.id)?.startsWith("Ainda ninguém registou") || (behindIds.has(objective.id) && presentation.get(objective.id)?.silent)).length,
      blocked: rankedObjectives.filter((objective) => blockedObjectiveIds.has(objective.id)).length,
    },
    commercialStats: {
      open: openOpportunities.length,
      converted: funnel.find((step) => step.stage === "converted")?.count ?? 0,
      lost: funnel.find((step) => step.stage === "lost")?.count ?? 0,
      overdue: overdueFollowUps.length,
      proposals: proposalsWaiting.length,
    },
    objectives: rankedObjectives.slice(0, 20).map((objective) => {
      const card = presentation.get(objective.id);
      const parts: string[] = [];
      if (blockedObjectiveIds.has(objective.id)) parts.push("Está bloqueada.");
      if (behindIds.has(objective.id)) parts.push("Está atrasada face ao que já devia ter feito até hoje.");
      else if (!card?.silent && !card?.dueSoon) parts.push("Vai a tempo.");
      if (card?.pace) parts.push(card.pace);
      if (card?.silent) parts.push("Ainda ninguém registou progresso nesta meta.");
      else if (card?.dueSoon) parts.push("O prazo chega neste período.");
      return {
        id: objective.id,
        title: objective.title,
        detail: parts.join(" ") || "Esta meta não tem um número comparável neste período.",
        progress: card?.progress ?? null,
        status: mixLabel(objective.id),
        period: objective.period_type,
      };
    }),
    objectiveTotal: rankedObjectives.length,
    funnel,
    payments: {
      acceptedKz: formatKz(acceptedKz),
      pendingKz: formatKz(pendingKz),
      acceptedAmount: acceptedKz,
      pendingAmount: pendingKz,
      acceptedCount: accepted.length,
      pendingCount: pending.length,
      unreconciledCount: unreconciled.length,
      unreconciledKz: formatKz(unreconciledKz),
      breakdown: paymentBreakdown,
      resultKz: resultKz === null ? null : formatKz(resultKz),
    },
    people: people.map((personItem) => ({ id: personItem.id, email: personItem.email, displayName: personItem.displayName })),
    products: products.map((product) => ({ slug: product.slug, title: product.title })),
  };
}
