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
  getPaymentSummary,
  getRecentPaymentOrders,
  PaymentLedgerNotMigratedError,
  type KitadiOrder,
  type PaymentSummary,
} from "../lib/payments/orders";
import { toDashboardProduct } from "./dashboard-data";

export const metadata: Metadata = {
  title: "Back office | Kitadi",
  robots: { index: false, follow: false },
};

export default async function BackofficePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user || user.app_metadata.role !== "admin") {
    redirect("/backoffice/login");
  }

  let catalogReady = true;
  let catalog = [];
  try {
    catalog = await getAdminProducts();
  } catch (error) {
    if (!(error instanceof ProductCatalogNotMigratedError)) throw error;
    catalogReady = false;
    catalog = await getPublishedProducts();
  }
  const products = catalog.map(toDashboardProduct);

  let paymentsReady = true;
  let payments: KitadiOrder[] = [];
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
  try {
    [payments, paymentSummary] = await Promise.all([
      getRecentPaymentOrders(),
      getPaymentSummary(),
    ]);
  } catch (error) {
    if (!(error instanceof PaymentLedgerNotMigratedError)) throw error;
    paymentsReady = false;
  }

  return (
    <BackofficeDashboard
      catalogReady={catalogReady}
      email={user.email ?? ""}
      paymentSummary={paymentSummary}
      payments={payments}
      paymentsReady={paymentsReady}
      products={products}
    />
  );
}
