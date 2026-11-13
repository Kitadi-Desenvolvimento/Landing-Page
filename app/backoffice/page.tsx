import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../lib/supabase/server";
import BackofficeDashboard from "./dashboard";
import {
  getAdminProducts,
  getPublishedProducts,
  ProductCatalogNotMigratedError,
} from "../lib/products";
import {
  getAcceptedOrderSalesByProduct,
  getPaymentSummary,
  getRecentPaymentOrders,
  getWeeklyPaymentRevenue,
  PaymentLedgerNotMigratedError,
  type KitadiOrder,
  type PaymentSummary,
  type WeeklyPaymentRevenue,
} from "../lib/payments/orders";
import {
  getSiteAnalyticsSummary,
  SiteAnalyticsNotMigratedError,
} from "../lib/site-analytics";
import {
  CommercialCrmNotMigratedError,
  getCommercialSummary,
  type CommercialSummary,
} from "../lib/commercial";
import { toDashboardProduct, type ProductSales } from "./dashboard-data";
import type { SiteAnalyticsSummary } from "../lib/site-analytics-types";

export const metadata: Metadata = {
  title: "Back office | Kitadi",
  robots: { index: false, follow: false },
};

export default async function BackofficePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  const role = user?.app_metadata.role;
  if (!user || (role !== "admin" && role !== "manager" && role !== "collaborator")) {
    redirect("/backoffice/login");
  }

  let catalogReady = true;
  let catalog: Awaited<ReturnType<typeof getAdminProducts>> = [];
  if (role === "admin") {
    try {
      catalog = await getAdminProducts();
    } catch (error) {
      if (!(error instanceof ProductCatalogNotMigratedError)) throw error;
      catalogReady = false;
      catalog = await getPublishedProducts();
    }
  }
  const products = catalog.map(toDashboardProduct);

  let paymentsReady = true;
  let payments: KitadiOrder[] = [];
  let productSales: ProductSales | null = {};
  let weeklyPaymentRevenue: WeeklyPaymentRevenue[] | null = [];
  let analyticsReady = true;
  let siteAnalytics: SiteAnalyticsSummary | null = null;
  let commercialReady = true;
  let commercialSummary: CommercialSummary | null = null;
  let paymentSummary: PaymentSummary = {
    totalCount: 0,
    acceptedCount: 0,
    pendingCount: 0,
    failedCount: 0,
    refundedCount: 0,
    acceptedAmountKz: 0,
    pendingAmountKz: 0,
    refundedAmountKz: 0,
    successRate: 0,
    averageTicketKz: 0,
  };
  if (role === "admin") {
    try {
      commercialSummary = await getCommercialSummary();
    } catch (error) {
      if (!(error instanceof CommercialCrmNotMigratedError)) throw error;
      commercialReady = false;
    }

    try {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      siteAnalytics = await getSiteAnalyticsSummary(since);
    } catch (error) {
      if (!(error instanceof SiteAnalyticsNotMigratedError)) throw error;
      analyticsReady = false;
    }

    try {
      const [recentOrders, summary, acceptedSalesByProduct, weeklyRevenue] = await Promise.all([
        getRecentPaymentOrders(),
        getPaymentSummary(),
        getAcceptedOrderSalesByProduct(),
        getWeeklyPaymentRevenue(),
      ]);
      payments = recentOrders;
      paymentSummary = summary;
      productSales = acceptedSalesByProduct;
      weeklyPaymentRevenue = weeklyRevenue;
    } catch (error) {
      if (!(error instanceof PaymentLedgerNotMigratedError)) throw error;
      paymentsReady = false;
      productSales = null;
      weeklyPaymentRevenue = null;
    }
  }

  return (
    <BackofficeDashboard
      catalogReady={catalogReady}
      email={user.email ?? ""}
      role={role}
      paymentSummary={paymentSummary}
      payments={payments}
      paymentsReady={paymentsReady}
      products={products}
      productSales={productSales}
      weeklyPaymentRevenue={weeklyPaymentRevenue}
      siteAnalytics={siteAnalytics}
      analyticsReady={analyticsReady}
      commercialSummary={commercialSummary}
      commercialReady={commercialReady}
    />
  );
}
