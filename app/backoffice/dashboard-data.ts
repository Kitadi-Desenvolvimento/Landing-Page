export type DashboardSection =
  | "overview"
  | "payments"
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
    value: "4,8%",
    change: "+0,6 pp",
    note: "vs. período anterior",
    icon: "conversion",
    tone: "green",
  },
] as const;

export const weeklyRevenue = [
  { day: "Seg", current: 48, previous: 34 },
  { day: "Ter", current: 72, previous: 43 },
  { day: "Qua", current: 56, previous: 38 },
  { day: "Qui", current: 88, previous: 58 },
  { day: "Sex", current: 64, previous: 46 },
  { day: "Sáb", current: 96, previous: 52 },
  { day: "Dom", current: 76, previous: 40 },
];

export const salesPipeline = [
  {
    stage: "Novo contacto",
    count: 8,
    total: "1.240.000 Kz",
    tone: "plum",
    deals: [
      { name: "Diana Francisco", product: "Bússola · Casal", value: "485.000 Kz", source: "Formulário do site", initials: "DF" },
      { name: "Manuel Domingos", product: "Tea & Money Talks", value: "88.000 Kz", source: "Instagram", initials: "MD" },
    ],
  },
  {
    stage: "Em conversa",
    count: 6,
    total: "968.000 Kz",
    tone: "gold",
    deals: [
      { name: "Carla Sebastião", product: "Bússola · Individual", value: "385.000 Kz", source: "WhatsApp", initials: "CS" },
      { name: "Pedro Afonso", product: "Finance Date", value: "Por definir", source: "Formulário do site", initials: "PA" },
    ],
  },
  {
    stage: "Proposta enviada",
    count: 4,
    total: "770.000 Kz",
    tone: "orange",
    deals: [
      { name: "Isabel Mateus", product: "Bússola · Casal", value: "485.000 Kz", source: "Referência", initials: "IM" },
      { name: "Luís António", product: "Tea & Money Talks", value: "88.000 Kz", source: "Instagram", initials: "LA" },
    ],
  },
  {
    stage: "Convertido",
    count: 6,
    total: "1.175.000 Kz",
    tone: "green",
    deals: [
      { name: "Marta João", product: "Bússola · Individual", value: "385.000 Kz", source: "Site", initials: "MJ" },
      { name: "Ana Cristina", product: "Desafio Aprendiz", value: "16.989 Kz", source: "WhatsApp", initials: "AC" },
    ],
  },
];

export const websiteFunnel = [
  { label: "Visitas ao site", value: "3.240", percent: 100, note: "visitantes únicos", color: "bg-[#510f1d]" },
  { label: "Visualizações de produtos", value: "1.186", percent: 72, note: "36,6% das visitas", color: "bg-[#762838]" },
  { label: "Cliques para contacto", value: "286", percent: 48, note: "24,1% das visualizações", color: "bg-[#ae7d32]" },
  { label: "Conversas iniciadas", value: "126", percent: 34, note: "44,1% dos contactos", color: "bg-[#cda45c]" },
  { label: "Compras / reservas", value: "38", percent: 20, note: "30,2% das conversas", color: "bg-[#52765e]" },
];

export const productPerformance: Record<
  string,
  { views: string; leads: number; sales: number; revenue: string; status: string }
> = {
  "bussola-do-kitadi": { views: "486", leads: 18, sales: 7, revenue: "2.695.000 Kz", status: "Activo" },
  "tea-and-money-talks": { views: "352", leads: 32, sales: 14, revenue: "1.232.000 Kz", status: "Activo" },
  "desafio-aprendiz": { views: "628", leads: 48, sales: 26, revenue: "441.714 Kz", status: "Activo" },
  "finance-date": { views: "297", leads: 21, sales: 9, revenue: "Por confirmar", status: "Inscrições abertas" },
  "o-negocio-e-meu": { views: "174", leads: 12, sales: 4, revenue: "Por confirmar", status: "Inscrições abertas" },
};
