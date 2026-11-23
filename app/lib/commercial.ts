import "server-only";

import { createSupabaseAdminClient } from "./supabase/admin";

export type CommercialSummary = {
  openCount: number;
  convertedCount: number;
  potentialAmountKz: number;
  followUpDueCount: number;
};

export class CommercialCrmNotMigratedError extends Error {
  constructor() {
    super("O funil comercial ainda não foi criado no Supabase.");
    this.name = "CommercialCrmNotMigratedError";
  }
}

// Angola não tem horário de verão (UTC+1): o fim do dia é 23:00 UTC.
function endOfTodayInLuanda(now = Date.now()) {
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  return Math.floor((now + hour) / day) * day + day - hour;
}

export async function getCommercialSummary(): Promise<CommercialSummary> {
  const admin = createSupabaseAdminClient();
  const pageSize = 1000;
  const summary: CommercialSummary = {
    openCount: 0,
    convertedCount: 0,
    potentialAmountKz: 0,
    followUpDueCount: 0,
  };
  const dueUntil = endOfTodayInLuanda();

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("crm_opportunities")
      .select("stage,amount_kz,follow_up_at")
      .range(from, from + pageSize - 1);

    if (error) {
      if (["42P01", "PGRST202", "PGRST204", "PGRST205"].includes(error.code ?? "")) {
        throw new CommercialCrmNotMigratedError();
      }
      console.error("[commercial] loading summary failed", error.code ?? "unknown");
      throw new Error("Não foi possível carregar o resumo comercial.");
    }

    const page = data ?? [];
    for (const opportunity of page) {
      if (opportunity.stage === "converted") {
        summary.convertedCount += 1;
      } else if (opportunity.stage !== "lost") {
        summary.openCount += 1;
        summary.potentialAmountKz += Number(opportunity.amount_kz ?? 0);
        if (
          opportunity.follow_up_at &&
          new Date(opportunity.follow_up_at).getTime() <= dueUntil
        ) {
          summary.followUpDueCount += 1;
        }
      }
    }

    if (page.length < pageSize) return summary;
  }
}
