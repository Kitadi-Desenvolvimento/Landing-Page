export type ProductAnalytics = {
  views: number;
  contactClicks: number;
};

export type SiteAnalyticsSummary = {
  visitors: number;
  productVisitors: number;
  productViews: number;
  contactVisitors: number;
  contactClicks: number;
  checkoutVisitors: number;
  checkoutStarts: number;
  attributedPaidVisitors: number;
  attributedPaidOrders: number;
  contactsByChannel: Record<"whatsapp" | "email" | "phone", number>;
  products: Record<string, ProductAnalytics>;
};
