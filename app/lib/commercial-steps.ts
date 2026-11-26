import "server-only";

import { after } from "next/server";
import { sendCommercialStepEmail } from "./commercial-step-email";
import { isStaffSchemaMissing, loadDisplayNames } from "./staff-profiles";
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

export async function loadCommercialSteps(now = Date.now()) {
  const admin = createSupabaseAdminClient();
  const opportunitiesResult = await admin
    .from("crm_opportunities")
    .select("id,title,stage,product_slug,created_at,follow_up_at,created_by,contact:crm_contacts!crm_opportunities_contact_id_fkey(name)")
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
    const followDue = followAt !== null && !Number.isNaN(followAt) && followAt <= now;
    const next = stageDue ? rule.next : followDue ? "Fazer o seguimento marcado." : null;
    return [{
      id: opportunity.id as string,
      title: opportunity.title as string,
      stage,
      productSlug: (opportunity.product_slug as string | null) ?? null,
      createdBy: (opportunity.created_by as string | null) ?? null,
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

function noticeKey(step: CommercialStep, kind: "stage" | "follow") {
  return kind === "stage"
    ? `stage:${step.id}:${step.stage}:${step.enteredAt}`
    : `follow:${step.id}:${step.followUpAt}`;
}

export async function notifyDueCommercialSteps(steps: CommercialStep[]) {
  const due = steps.filter((step) => step.createdBy && (step.stageDue || step.followDue));
  if (due.length === 0) return { sent: 0, unavailable: false };
  const admin = createSupabaseAdminClient();
  const keys = due.flatMap((step) => [
    step.stageDue ? noticeKey(step, "stage") : null,
    step.followDue && step.followUpAt ? noticeKey(step, "follow") : null,
  ].filter((key): key is string => Boolean(key)));
  const sentKeys = new Set<string>();
  for (let offset = 0; offset < keys.length; offset += 100) {
    const existingResult = await admin.from("commercial_step_notices").select("notice_key").in("notice_key", keys.slice(offset, offset + 100));
    if (existingResult.error) {
      if (isStaffSchemaMissing(existingResult.error.code)) return { sent: 0, unavailable: true };
      throw existingResult.error;
    }
    for (const row of existingResult.data ?? []) sentKeys.add(row.notice_key as string);
  }
  const pendingSteps = due.filter((step) => {
    const stageKey = step.stageDue ? noticeKey(step, "stage") : null;
    const followKey = step.followDue && step.followUpAt ? noticeKey(step, "follow") : null;
    return (stageKey && !sentKeys.has(stageKey)) || (followKey && !sentKeys.has(followKey));
  }).slice(0, 15);
  const names = await loadDisplayNames(pendingSteps.map((step) => step.createdBy ?? ""));
  const emails = new Map<string, string>();
  await Promise.all(pendingSteps.map(async (step) => {
    if (!step.createdBy || emails.has(step.createdBy)) return;
    const user = await admin.auth.admin.getUserById(step.createdBy);
    const email = user.data?.user?.email ?? "";
    if (email) emails.set(step.createdBy, email);
  }));
  let sent = 0;

  for (const step of pendingSteps) {
    const stageKey = step.stageDue ? noticeKey(step, "stage") : null;
    const followKey = step.followDue && step.followUpAt ? noticeKey(step, "follow") : null;
    const pending = [stageKey, followKey].filter((key): key is string => typeof key === "string" && !sentKeys.has(key));
    if (pending.length === 0 || !step.createdBy || !step.next) continue;
    const email = emails.get(step.createdBy) ?? "";
    if (!email) continue;
    const claimed = await admin.from("commercial_step_notices").insert(pending.map((key) => ({
      notice_key: key,
      opportunity_id: step.id,
      recipient_id: step.createdBy,
    })));
    if (claimed.error) {
      if (claimed.error.code === "23505" || isStaffSchemaMissing(claimed.error.code)) continue;
      throw claimed.error;
    }
    const result = await sendCommercialStepEmail({
      noticeKey: pending[0],
      email,
      displayName: names.get(step.createdBy) ?? "",
      title: step.title,
      contactName: step.contactName,
      stageLabel: stageStepLimits[step.stage].label,
      days: step.days,
      stageDue: Boolean(stageKey && pending.includes(stageKey)),
      followDue: Boolean(followKey && pending.includes(followKey)),
      nextStep: step.next,
    });
    if (!result.ok) {
      await admin.from("commercial_step_notices").delete().in("notice_key", pending);
      continue;
    }
    sent += 1;
  }
  return { sent, unavailable: false };
}

let noticeScheduledAt = 0;

export function scheduleDueCommercialNotices(steps: CommercialStep[]) {
  if (steps.length === 0) return;
  const now = Date.now();
  if (now - noticeScheduledAt < 20_000) return;
  noticeScheduledAt = now;
  after(() => {
    notifyDueCommercialSteps(steps).catch((error) => {
      console.error("[backoffice] commercial step notices failed", error instanceof Error ? error.message : "unknown");
    });
  });
}
