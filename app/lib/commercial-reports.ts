import "server-only";

import {
  buildActivityReportPdf,
  type ActivityReportEntry,
} from "./activity-report-pdf";
import { reportDateRange, type ReportPeriod } from "./objective-periods";
import {
  commercialEventLabel,
  describeCommercialEvent,
} from "./report-descriptions";
import { createSupabaseAdminClient } from "./supabase/admin";

type CommercialHistoryRow = {
  opportunity_id: string;
  event_type: string;
  from_stage: string | null;
  to_stage: string | null;
  payment_status: string | null;
  details: string;
  changed_by_email: string;
  created_at: string;
};

type CommercialReportEntry = ActivityReportEntry;

function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function toCsv(entries: CommercialReportEntry[]) {
  const rows = [
    ["Data e hora", "Acontecimento", "Responsável", "Contacto / oportunidade", "Descrição"],
    ...entries.map((entry) => [
      new Date(entry.occurredAt).toLocaleString("pt-AO", { timeZone: "Africa/Luanda" }),
      entry.type,
      entry.actor,
      entry.subject,
      entry.description,
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}

export class CommercialReportQueryError extends Error {
  constructor(readonly code: string, operation: string) {
    super(`${operation} failed with ${code}`);
    this.name = "CommercialReportQueryError";
  }
}

export function isCommercialReportSchemaError(code?: string) {
  return Boolean(code && (
    code.startsWith("PGRST") ||
    code === "42P01" ||
    code === "42703"
  ));
}

export async function buildCommercialReport(
  period: ReportPeriod,
  anchorDate: string,
) {
  const range = reportDateRange(period, anchorDate);
  if (!range) throw new Error("Invalid commercial report date range");
  const admin = createSupabaseAdminClient();
  const history: CommercialHistoryRow[] = [];

  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("crm_opportunity_history")
      .select("opportunity_id,event_type,from_stage,to_stage,payment_status,details,changed_by_email,created_at")
      .gte("created_at", range.from)
      .lt("created_at", range.to)
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) throw new CommercialReportQueryError(error.code ?? "unknown", "Commercial history report");
    history.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const opportunityIds = [...new Set(history.map((event) => event.opportunity_id))];
  const opportunities = new Map<string, { title: string; productTitle: string; contactId: string }>();
  for (let offset = 0; offset < opportunityIds.length; offset += 500) {
    const { data, error } = await admin.from("crm_opportunities")
      .select("id,title,product_title,contact_id")
      .in("id", opportunityIds.slice(offset, offset + 500));
    if (error) throw new CommercialReportQueryError(error.code ?? "unknown", "Commercial opportunity report");
    for (const opportunity of data ?? []) {
      opportunities.set(opportunity.id, {
        title: opportunity.title,
        productTitle: opportunity.product_title ?? "",
        contactId: opportunity.contact_id,
      });
    }
  }

  const contactIds = [...new Set(
    [...opportunities.values()].map((opportunity) => opportunity.contactId),
  )];
  const contactNames = new Map<string, string>();
  for (let offset = 0; offset < contactIds.length; offset += 500) {
    const { data, error } = await admin.from("crm_contacts")
      .select("id,name")
      .in("id", contactIds.slice(offset, offset + 500));
    if (error) throw new CommercialReportQueryError(error.code ?? "unknown", "Commercial contact report");
    for (const contact of data ?? []) contactNames.set(contact.id, contact.name);
  }

  const entries: CommercialReportEntry[] = history.map((event) => {
    const opportunity = opportunities.get(event.opportunity_id);
    const contactName = opportunity
      ? contactNames.get(opportunity.contactId)
      : null;
    const subject = [
      contactName || "Contacto",
      opportunity?.productTitle || opportunity?.title || "Oportunidade",
    ].join(" · ");
    return {
      occurredAt: event.created_at,
      type: commercialEventLabel(event.event_type),
      actor: event.changed_by_email || "Sistema",
      subject,
      description: describeCommercialEvent({
        eventType: event.event_type,
        fromStage: event.from_stage,
        toStage: event.to_stage,
        paymentStatus: event.payment_status,
        details: event.details,
      }, subject),
    };
  });

  const label = period === "day" ? "Dia" : period === "week" ? "Semana" : "Mês";
  const inclusiveEndDate = new Date(`${range.toDate}T00:00:00.000Z`);
  inclusiveEndDate.setUTCDate(inclusiveEndDate.getUTCDate() - 1);
  const dateLabel = period === "day"
    ? range.fromDate
    : `${range.fromDate} a ${inclusiveEndDate.toISOString().slice(0, 10)}`;

  return {
    entries,
    periodLabel: label,
    dateLabel,
    csv: toCsv(entries),
    pdf: () => buildActivityReportPdf({
      title: "Relatório comercial",
      description: "Contactos, oportunidades, mudanças de etapa e pagamentos.",
      periodLabel: label,
      dateLabel,
      entries,
      emptyMessage: "Não foram registadas actividades comerciais neste período.",
    }),
  };
}
