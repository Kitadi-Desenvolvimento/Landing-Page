export type DashboardSection =
  | "overview"
  | "payments"
  | "attendees"
  | "objectives"
  | "commercial"
  | "funnel"
  | "products"
  | "team";

export type DashboardProduct = {
  slug: string;
  title: string;
  category: string;
  image: string;
  price: string;
  statusLabel: string;
  format: string;
  published: boolean;
  data: import("../product-types").ProductData;
};

export type ProductSales = Record<string, { sales: number; revenueKz: number }>;
export type { ProductAnalytics, SiteAnalyticsSummary } from "../lib/site-analytics-types";

export function toDashboardProduct(
  product: import("../product-types").ProductRecord,
): DashboardProduct {
  return {
    ...product,
    title: product.data.title,
    category: product.data.category,
    image: product.data.coverImage ?? product.data.image,
    price: product.data.course?.price ?? product.data.price ?? "",
    statusLabel: product.data.statusLabel,
    format: product.data.modality,
  };
}

export const dashboardNavigation: {
  id: DashboardSection;
  label: string;
  group: "workspace" | "manage";
}[] = [
  { id: "overview", label: "Visão geral", group: "workspace" },
  { id: "payments", label: "Pagamentos", group: "workspace" },
  { id: "attendees", label: "Participantes", group: "workspace" },
  { id: "objectives", label: "Objectivos", group: "workspace" },
  { id: "commercial", label: "Comercial", group: "workspace" },
  { id: "funnel", label: "Funil do site", group: "workspace" },
  { id: "products", label: "Produtos", group: "manage" },
  { id: "team", label: "Equipa e acessos", group: "manage" },
];

export const dashboardMetrics = [
  {
    label: "Vendas brutas",
    value: "2.845.000 Kz",
    change: "+12,8%",
    note: "vs. período anterior",
    icon: "revenue",
    tone: "gold",
  },
  {
    label: "Pagamentos pendentes",
    value: "485.000 Kz",
    change: "5 pedidos",
    note: "aguardam confirmação",
    icon: "pending",
    tone: "orange",
  },
  {
    label: "Oportunidades abertas",
    value: "24",
    change: "+6",
    note: "novas esta semana",
    icon: "leads",
    tone: "plum",
  },
  {
    label: "Conversão do site",
    value: "—",
    change: "—",
    note: "analytics do site",
    icon: "conversion",
    tone: "green",
  },
] as const;
