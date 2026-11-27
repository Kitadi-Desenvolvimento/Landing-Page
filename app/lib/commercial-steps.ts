import "server-only";

import { isStaffSchemaMissing } from "./staff-profiles";
import { createSupabaseAdminClient } from "./supabase/admin";

export const stageStepLimits = {
  new_contact: { days: 1, label: "Contacto novo", next: "Contactar e passar para Em conversa." },
  in_conversation: { days: 3, label: "Em conversa", next: "Enviar a proposta ou marcar o próximo contacto." },
  proposal_sent: { days: 5, label: "Proposta enviada", next: "Confirmar a decisão ou o pagamento." },
} as const;

type OpenStage = keyof typeof stageStepLimits;

export type CommercialStep = {
  id: string;
  title: string;
  stage: OpenStage;
  productSlug: string | null;
  createdBy: string | null;
  contactName: string;
  enteredAt: string;
  followUpAt: string | null;
  days: number;
  stageDue: boolean;
  followDue: boolean;
  next: string | null;
};

type HistoryRow = {
  opportunity_id: string;
  event_type: string;
  to_stage: string | null;
  created_at: string;
};

function isOpenStage(stage: string): stage is OpenStage {
  return stage in stageStepLimits;
}

function daysSince(iso: string, now: number) {
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now - start) / 86_400_000));
}

function contactName(contact: { name?: string } | { name?: string }[] | null) {
  if (Array.isArray(contact)) return contact[0]?.name ?? "";
  return contact?.name ?? "";
}

function entryAt(stage: string, createdAt: string, history: HistoryRow[]) {
  const match = history.find((event) =>
    (event.event_type === "created" || event.event_type === "stage_changed") && event.to_stage === stage,
  );
  return match?.created_at ?? createdAt;
}

function contactOwner(contact: unknown) {
  const row = Array.isArray(contact) ? contact[0] : contact;
  if (!row || typeof row !== "object" || !("owner_id" in row)) return null;
  return typeof row.owner_id === "string" ? row.owner_id : null;
}

export async function loadContactOwners(contactIds: string[]) {
  const ids = [...new Set(contactIds.filter(Boolean))];
  const owners = new Map<string, string | null>();
  if (ids.length === 0) return owners;
  const admin = createSupabaseAdminClient();
  for (let index = 0; index < ids.length; index += 150) {
    const { data, error } = await admin.from("crm_contacts").select("id,owner_id").in("id", ids.slice(index, index + 150));
    if (error) {
      if (isStaffSchemaMissing(error.code)) return null;
      throw error;
    }
    for (const row of data ?? []) owners.set(row.id as string, typeof row.owner_id === "string" ? row.owner_id : null);
  }
  return owners;
}

export async function loadCommercialSteps(now = Date.now()) {
  const admin = createSupabaseAdminClient();
  const columns = "id,title,stage,product_slug,created_at,follow_up_at,created_by";
  const withOwner = await admin
    .from("crm_opportunities")
    .select(`${columns},contact:crm_contacts!crm_opportunities_contact_id_fkey(name,owner_id)`)
    .in("stage", ["new_contact", "in_conversation", "proposal_sent"])
    .limit(1000);
  const ownerColumn = !(withOwner.error && isStaffSchemaMissing(withOwner.error.code));
  const opportunitiesResult = ownerColumn
    ? withOwner
    : await admin
      .from("crm_opportunities")
      .select(`${columns},contact:crm_contacts!crm_opportunities_contact_id_fkey(name)`)
      .in("stage", ["new_contact", "in_conversation", "proposal_sent"])
      .limit(1000);
  if (opportunitiesResult.error) {
    if (isStaffSchemaMissing(opportunitiesResult.error.code)) return [] as CommercialStep[];
    throw opportunitiesResult.error;
  }
  const opportunities = opportunitiesResult.data ?? [];
  const ids = opportunities.map((opportunity) => opportunity.id as string);
  const historyByOpportunity = new Map<string, HistoryRow[]>();
  if (ids.length > 0) {
    const historyResult = await admin
      .from("crm_opportunity_history")
      .select("opportunity_id,event_type,to_stage,created_at")
      .in("opportunity_id", ids)
      .in("event_type", ["created", "stage_changed"])
      .order("created_at", { ascending: false })
      .limit(5000);
    if (historyResult.error) throw historyResult.error;
    for (const row of (historyResult.data ?? []) as HistoryRow[]) {
      historyByOpportunity.set(row.opportunity_id, [...(historyByOpportunity.get(row.opportunity_id) ?? []), row]);
    }
  }

  return opportunities.flatMap((opportunity) => {
    const stage = opportunity.stage as string;
    if (!isOpenStage(stage)) return [];
    const enteredAt = entryAt(stage, opportunity.created_at as string, historyByOpportunity.get(opportunity.id) ?? []);
    const days = daysSince(enteredAt, now);
    const rule = stageStepLimits[stage];
    const stageDue = days >= rule.days;
    const followAt = opportunity.follow_up_at ? new Date(opportunity.follow_up_at as string).getTime() : null;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Luanda" }).format(now);
    const followDay = followAt !== null && !Number.isNaN(followAt)
      ? new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Luanda" }).format(followAt)
      : null;
    const followDue = followDay !== null && followDay <= today;
    const next = stageDue ? rule.next : followDue ? "Fazer o seguimento marcado." : null;
    return [{
      id: opportunity.id as string,
      title: opportunity.title as string,
      stage,
      productSlug: (opportunity.product_slug as string | null) ?? null,
      createdBy: ownerColumn ? contactOwner(opportunity.contact) : ((opportunity.created_by as string | null) ?? null),
      contactName: contactName(opportunity.contact as { name?: string } | { name?: string }[] | null),
      enteredAt,
      followUpAt: (opportunity.follow_up_at as string | null) ?? null,
      days,
      stageDue,
      followDue,
      next,
    } satisfies CommercialStep];
  });
}
