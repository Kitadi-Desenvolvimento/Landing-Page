import "server-only";

import { createSupabaseAdminClient } from "./supabase/admin";
import type {
  ProductAnalytics,
  SiteAnalyticsSummary,
} from "./site-analytics-types";

export class SiteAnalyticsNotMigratedError extends Error {
  constructor() {
    super("A recolha de analytics do site ainda não foi criada no Supabase.");
    this.name = "SiteAnalyticsNotMigratedError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCount(value: unknown) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("O resumo de analytics contém uma contagem inválida.");
  }
  return count;
}

export async function getSiteAnalyticsSummary(
  since: string,
): Promise<SiteAnalyticsSummary> {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "backoffice_site_analytics",
    { p_since: since },
  );

  if (error) {
    if (["42P01", "PGRST202", "PGRST204", "PGRST205"].includes(error.code ?? "")) {
      throw new SiteAnalyticsNotMigratedError();
    }
    console.error("[site-analytics] summary lookup failed", error.code ?? "unknown");
    throw new Error("Não foi possível carregar as métricas do site.");
  }

  if (!isRecord(data) || !isRecord(data.products) || !isRecord(data.contactsByChannel)) {
    throw new Error("O resumo de analytics devolveu um formato inválido.");
  }

  const products: Record<string, ProductAnalytics> = {};
  for (const [slug, value] of Object.entries(data.products)) {
    if (!isRecord(value)) {
      throw new Error("O resumo de analytics contém dados de produto inválidos.");
    }
    products[slug] = {
      views: readCount(value.views),
      contactClicks: readCount(value.contactClicks),
    };
  }

  return {
    visitors: readCount(data.visitors),
    productVisitors: readCount(data.productVisitors),
    productViews: readCount(data.productViews),
    contactVisitors: readCount(data.contactVisitors),
    contactClicks: readCount(data.contactClicks),
    checkoutVisitors: readCount(data.checkoutVisitors),
    checkoutStarts: readCount(data.checkoutStarts),
    attributedPaidVisitors: readCount(data.attributedPaidVisitors),
    attributedPaidOrders: readCount(data.attributedPaidOrders),
    contactsByChannel: {
      whatsapp: readCount(data.contactsByChannel.whatsapp ?? 0),
      email: readCount(data.contactsByChannel.email ?? 0),
      phone: readCount(data.contactsByChannel.phone ?? 0),
    },
    products,
  };
}
