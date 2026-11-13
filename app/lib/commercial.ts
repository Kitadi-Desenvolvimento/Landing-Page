import "server-only";

import { createSupabaseAdminClient } from "./supabase/admin";

export type CommercialSummary = {
  openCount: number;
  convertedCount: number;
  potentialAmountKz: number;
};

export class CommercialCrmNotMigratedError extends Error {
  constructor() {
    super("O funil comercial ainda não foi criado no Supabase.");
    this.name = "CommercialCrmNotMigratedError";
  }
}

export async function getCommercialSummary(): Promise<CommercialSummary> {
  const admin = createSupabaseAdminClient();
  const pageSize = 1000;
  const summary: CommercialSummary = {
    openCount: 0,
    convertedCount: 0,
    potentialAmountKz: 0,
  };

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("crm_opportunities")
      .select("stage,amount_kz")
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
      } else {
        summary.openCount += 1;
        summary.potentialAmountKz += Number(opportunity.amount_kz ?? 0);
      }
    }

    if (page.length < pageSize) return summary;
  }
}
