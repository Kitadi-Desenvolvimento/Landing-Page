import "server-only";

import {
  buildActivityReportPdf,
  type ActivityReportEntry,
} from "./activity-report-pdf";
import {
  reportDateRange,
  type ReportPeriod,
} from "./objective-periods";
import {
  describeObjectiveChange,
  describeObjectiveProgress,
  objectiveEventLabel,
} from "./report-descriptions";
import type { ObjectiveAccess } from "./objective-access";
import { createSupabaseAdminClient } from "./supabase/admin";

type ReportActivity = {
  occurredAt: string;
  type: string;
  actor: string;
  scope: string;
  subject: string;
  description: string;
};

export class ObjectiveReportQueryError extends Error {
  constructor(readonly code: string, operation: string) {
    super(`${operation} failed with ${code}`);
    this.name = "ObjectiveReportQueryError";
  }
}

export function isObjectiveReportSchemaError(code?: string) {
  return Boolean(code && (
    code.startsWith("PGRST") ||
    code === "42P01" ||
    code === "42703"
  ));
}

function safeText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function valueText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function toCsv(activities: ReportActivity[]) {
  const header = [
    "Data e hora",
    "Actividade",
    "Quem realizou",
    "Âmbito",
    "Objectivo",
    "Descrição do acontecimento",
  ];
  const rows = activities.map((activity) => [
    new Date(activity.occurredAt).toLocaleString("pt-AO", { timeZone: "Africa/Luanda" }),
    activity.type,
    activity.actor,
    activity.scope,
    activity.subject,
    activity.description,
  ]);
  return `\uFEFF${[header, ...rows]
    .map((row) => row.map(csvCell).join(";"))
    .join("\r\n")}\r\n`;
}

export async function buildObjectiveReport(
  access: ObjectiveAccess,
  period: ReportPeriod,
  anchorDate: string,
) {
  const range = reportDateRange(period, anchorDate);
  if (!range) throw new Error("Invalid report date range");
  const admin = createSupabaseAdminClient();
  const objectives: Record<string, unknown>[] = [];

  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("objectives")
      .select("id,area_id,scope_type,assigned_to,parent_objective_id,title")
      .range(from, from + 999);
    if (error) throw new ObjectiveReportQueryError(error.code ?? "unknown", "Objective report lookup");
    objectives.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < 1000) break;
  }

  const visibleObjectives = objectives.filter((objective) => {
    if (access.role === "admin") return true;
    if (objective.scope_type === "company") return true;
    if (access.role === "collaborator") {
      return objective.scope_type === "collaborator" &&
        objective.assigned_to === access.userId;
    }
    return typeof objective.area_id === "string" &&
      access.areaIds?.includes(objective.area_id) === true;
  });
  const objectiveById = new Map(
    visibleObjectives.map((objective) => [String(objective.id), objective]),
  );
  const objectiveIds = [...objectiveById.keys()];
  const memberIds = access.role === "admin"
    ? null
    : access.role === "collaborator"
      ? [access.userId]
      : access.memberIds ?? [access.userId];
  const activities: ReportActivity[] = [];
  const areaNames = new Map<string, string>();
  const { data: areas, error: areasError } = await admin
    .from("objective_areas")
    .select("id,name");
  if (areasError) throw new ObjectiveReportQueryError(areasError.code ?? "unknown", "Objective report areas");
  for (const area of areas ?? []) areaNames.set(area.id, area.name);

  if (objectiveIds.length > 0) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from("objective_checkins")
        .select("id,objective_id,checkin_date,value,note,checked_in_by,checked_in_by_email,created_at")
        .in("objective_id", objectiveIds)
        .gte("checkin_date", range.fromDate)
        .lt("checkin_date", range.toDate)
        .order("checkin_date", { ascending: true })
        .range(from, from + 999);
      if (error) throw new ObjectiveReportQueryError(error.code ?? "unknown", "Objective check-in report");
      for (const checkin of data ?? []) {
        if (memberIds && !memberIds.includes(checkin.checked_in_by ?? "")) continue;
        const objective = objectiveById.get(checkin.objective_id);
        if (!objective) continue;
        const scope = safeText(objective.scope_type);
        const areaId = safeText(objective.area_id);
        const title = safeText(objective.title);
        const scopeName = scope === "company"
          ? "na empresa"
          : scope === "collaborator"
            ? "num objectivo pessoal"
            : `no departamento ${areaNames.get(areaId) ?? "indicado"}`;
        const value = valueText(checkin.value);
        activities.push({
          occurredAt: checkin.created_at,
          type: "Progresso registado",
          actor: checkin.checked_in_by_email || "Utilizador",
          scope: scope === "company"
            ? "Empresa"
            : scope === "collaborator"
              ? "Objectivo pessoal"
              : areaNames.get(areaId) ?? "Departamento",
          subject: title,
          description: describeObjectiveProgress({
            title,
            scope: scopeName,
            value,
            note: safeText(checkin.note),
          }),
        });
      }
      if (!data || data.length < 1000) break;
    }

    const edits: {
      checkin_id: string;
      previous_value: unknown;
      previous_note: string;
      edited_by: string | null;
      edited_by_email: string;
      edited_at: string;
    }[] = [];
    for (let from = 0; ; from += 1000) {
      let query = admin.from("objective_checkin_edits")
        .select("checkin_id,previous_value,previous_note,edited_by,edited_by_email,edited_at")
        .gte("edited_at", range.from)
        .lt("edited_at", range.to)
        .order("edited_at", { ascending: true })
        .range(from, from + 999);
      if (memberIds) query = query.in("edited_by", memberIds);
      const { data, error } = await query;
      if (error) throw new ObjectiveReportQueryError(error.code ?? "unknown", "Objective check-in edit report");
      edits.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }

    const editedCheckinIds = [...new Set(edits.map((edit) => edit.checkin_id))];
    const editedCheckins = new Map<string, {
      objective_id: string;
      checked_in_by: string | null;
      value: unknown;
      note: string | null;
    }>();
    for (let offset = 0; offset < editedCheckinIds.length; offset += 500) {
      const { data, error } = await admin.from("objective_checkins")
        .select("id,objective_id,checked_in_by,value,note")
        .in("id", editedCheckinIds.slice(offset, offset + 500));
      if (error) throw new ObjectiveReportQueryError(error.code ?? "unknown", "Objective check-in lookup");
      for (const checkin of data ?? []) {
        editedCheckins.set(checkin.id, {
          objective_id: checkin.objective_id,
          checked_in_by: checkin.checked_in_by,
          value: checkin.value,
          note: checkin.note,
        });
      }
    }
    for (const edit of edits) {
      const checkin = editedCheckins.get(edit.checkin_id);
      if (!checkin || (memberIds && !memberIds.includes(checkin.checked_in_by ?? ""))) continue;
      const objective = objectiveById.get(checkin.objective_id);
      if (!objective) continue;
      const title = safeText(objective.title);
      const previousValue = valueText(edit.previous_value);
      activities.push({
        occurredAt: edit.edited_at,
        type: "Progresso corrigido",
        actor: edit.edited_by_email || "Utilizador",
        scope: safeText(objective.scope_type) === "company"
          ? "Empresa"
          : safeText(objective.scope_type) === "collaborator"
            ? "Objectivo pessoal"
            : areaNames.get(safeText(objective.area_id)) ?? "Departamento",
        subject: title,
        description: describeObjectiveProgress({
          title,
          scope: "",
          value: previousValue,
          note: edit.previous_note,
          previous: true,
          currentValue: valueText(checkin.value),
          currentNote: safeText(checkin.note),
        }),
      });
    }
  }

  const actorIds = memberIds
    ? [...new Set(memberIds.length > 0 ? memberIds : [access.userId])]
    : null;
  const objectiveHistory: {
    objective_title: string;
    event_type: string;
    scope_type: string;
    area_id: string | null;
    assigned_to: string | null;
    actor_id: string | null;
    actor_email: string;
    created_at: string;
  }[] = [];
  for (let from = 0; ; from += 1000) {
    let query = admin.from("objective_activity_history")
      .select("objective_title,event_type,scope_type,area_id,assigned_to,actor_id,actor_email,created_at")
      .gte("created_at", range.from)
      .lt("created_at", range.to)
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (actorIds) query = query.in("actor_id", actorIds);
    const { data, error } = await query;
    if (error) throw new ObjectiveReportQueryError(error.code ?? "unknown", "Objective activity report");
    objectiveHistory.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  for (const event of objectiveHistory ?? []) {
    if (
      access.role === "collaborator" &&
      (event.scope_type !== "collaborator" || event.assigned_to !== access.userId)
    ) continue;
    if (
      access.role === "manager" &&
      event.scope_type !== "company" &&
      !access.areaIds?.includes(event.area_id ?? "")
    ) continue;
    const scope = event.scope_type === "company"
      ? "na empresa"
      : event.scope_type === "collaborator"
        ? "para um colaborador"
        : `no departamento ${areaNames.get(event.area_id ?? "") ?? "indicado"}`;
    const title = event.objective_title;
    activities.push({
      occurredAt: event.created_at,
      type: objectiveEventLabel(event.event_type),
      actor: event.actor_email || "Utilizador",
      scope: event.scope_type === "company"
        ? "Empresa"
        : event.scope_type === "collaborator"
          ? "Colaborador"
          : areaNames.get(event.area_id ?? "") ?? "Departamento",
      subject: title,
      description: describeObjectiveChange(event.event_type, title, scope),
    });
  }

  activities.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const label = period === "day" ? "Dia" : period === "week" ? "Semana" : "Mês";
  const inclusiveEndDate = new Date(`${range.toDate}T00:00:00.000Z`);
  inclusiveEndDate.setUTCDate(inclusiveEndDate.getUTCDate() - 1);
  const dateLabel = period === "day"
    ? range.fromDate
    : `${range.fromDate} a ${inclusiveEndDate.toISOString().slice(0, 10)}`;
  const pdfEntries: ActivityReportEntry[] = activities.map((activity) => ({
    occurredAt: activity.occurredAt,
    type: activity.type,
    actor: activity.actor,
    subject: `${activity.subject} · ${activity.scope}`,
    description: activity.description,
  }));
  return {
    activities,
    periodLabel: label,
    dateLabel,
    csv: toCsv(activities),
    pdf: () => buildActivityReportPdf({
      title: "Relatório de objectivos",
      description: "Objectivos, actualizações e progresso registado pela equipa.",
      periodLabel: label,
      dateLabel,
      entries: pdfEntries,
      emptyMessage: "Não foram registados objectivos ou progressos neste período.",
    }),
  };
}
