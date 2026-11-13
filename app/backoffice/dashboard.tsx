"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import InviteAdminForm from "./invite-admin-form";
import SignOutButton from "./sign-out-button";
import Attendees from "./attendees";
import Objectives, { OverviewObjectives } from "./objectives";
import {
  dashboardMetrics,
  dashboardNavigation,
  type DashboardProduct,
  type DashboardSection,
  type ProductAnalytics,
  type ProductSales,
  type SiteAnalyticsSummary,
  toDashboardProduct,
} from "./dashboard-data";
import type { ProductRecord } from "../product-types";
import type { KitadiOrder, PaymentSummary, WeeklyPaymentRevenue } from "../lib/payments/orders";
import type { CommercialSummary } from "../lib/commercial";
import type { DragEvent, FormEvent } from "react";

const sectionTitles: Record<DashboardSection, { title: string; subtitle: string }> = {
  overview: { title: "Visão geral", subtitle: "Uma leitura rápida da actividade da Kitadi." },
  payments: { title: "Pagamentos", subtitle: "Acompanhe os recebimentos e pedidos recentes." },
  attendees: { title: "Participantes", subtitle: "Consulte inscrições pagas, exporte listas e registe presenças." },
  objectives: { title: "Objectivos", subtitle: "Defina metas, registe o progresso diário e consulte o histórico." },
  commercial: { title: "Área comercial", subtitle: "Oportunidades e acompanhamento de potenciais clientes." },
  funnel: { title: "Funil do site", subtitle: "Visitas, contactos, checkout e pagamentos atribuídos." },
  products: { title: "Produtos", subtitle: "Desempenho dos programas e experiências da Kitadi." },
  team: { title: "Equipa e acessos", subtitle: "Gerir funções, convites e atribuições às áreas." },
};

const workspaceNavigation = dashboardNavigation.filter((item) => item.group === "workspace");
const manageNavigation = dashboardNavigation.filter((item) => item.group === "manage");
type BackofficeRole = "admin" | "manager" | "collaborator";

export default function BackofficeDashboard({
  email,
  role,
  products,
  catalogReady,
  productSales,
  siteAnalytics,
  analyticsReady,
  commercialSummary,
  commercialReady,
  payments,
  paymentSummary,
  paymentsReady,
  weeklyPaymentRevenue,
}: {
  email: string;
  role: BackofficeRole;
  products: DashboardProduct[];
  catalogReady: boolean;
  productSales: ProductSales | null;
  siteAnalytics: SiteAnalyticsSummary | null;
  analyticsReady: boolean;
  commercialSummary: CommercialSummary | null;
  commercialReady: boolean;
  payments: KitadiOrder[];
  paymentSummary: PaymentSummary;
  paymentsReady: boolean;
  weeklyPaymentRevenue: WeeklyPaymentRevenue[] | null;
}) {
  const [catalogProducts, setCatalogProducts] = useState(products);
  const [activeSection, setActiveSection] = useState<DashboardSection>(
    role === "admin" ? "overview" : "objectives",
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const page = sectionTitles[activeSection];
  const visibleWorkspaceNavigation = role === "admin"
    ? workspaceNavigation
    : workspaceNavigation.filter((item) => item.id === "objectives");
  const visibleManageNavigation = role === "admin"
    ? manageNavigation
    : role === "manager"
      ? dashboardNavigation.filter((item) => item.id === "team")
      : [];

  function navigate(section: DashboardSection) {
    setActiveSection(section);
    setSidebarOpen(false);
  }

  return (
    <div className="min-h-svh bg-[#f7f5f3] text-[#252021] lg:flex">
      {sidebarOpen ? (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-[#211d1e]/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col border-r border-[#ece7e4] bg-white px-5 py-6 transition-transform lg:sticky lg:top-0 lg:h-svh lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <a aria-label="Kitadi — abrir site" className="flex items-center gap-3 px-2" href="/" rel="noreferrer" target="_blank">
          <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-2xl bg-[#510f1d] text-[18px] font-bold text-[#e2bd72]">
            K
          </span>
          <span>
            <span className="block text-[15px] font-bold tracking-[0.12em] text-[#351018]">
              KITADI
            </span>
            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a99d99]">
              Gestão e crescimento
            </span>
          </span>
        </a>

        <div className="mt-10">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#afa5a1]">
            Workspace
          </p>
          <nav aria-label="Navegação do back office" className="mt-3 space-y-1">
            {visibleWorkspaceNavigation.map((item) => (
              <NavButton
                active={activeSection === item.id}
                icon={item.id}
                key={item.id}
                label={item.label}
                onClick={() => navigate(item.id)}
              />
            ))}
          </nav>
        </div>

        <div className="mt-8">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#afa5a1]">
            Gestão
          </p>
          <nav aria-label="Gestão" className="mt-3 space-y-1">
            {visibleManageNavigation.map((item) => (
              <NavButton
                active={activeSection === item.id}
                icon={item.id}
                key={item.id}
                label={item.label}
                onClick={() => navigate(item.id)}
              />
            ))}
          </nav>
        </div>

      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-[#ece7e4] bg-white/90 px-5 backdrop-blur-md sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="Abrir menu"
              className="flex size-10 items-center justify-center rounded-xl border border-[#eee8e5] text-[#510f1d] lg:hidden"
              onClick={() => setSidebarOpen(true)}
              type="button"
            >
              <Icon name="menu" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-[#a29793]">
                Back office <span className="mx-1.5">/</span> {page.title}
              </p>
              <h1 className="mt-0.5 truncate text-[17px] font-bold text-[#302829]">
                {page.title}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <span className="hidden items-center gap-2 rounded-full border border-[#eee8e5] px-3 py-2 text-[11px] font-semibold text-[#756d69] sm:inline-flex">
              <span className="size-1.5 rounded-full bg-[#66836c]" />
              Pagamentos, produtos e analytics reais
            </span>
            <span className="flex size-9 items-center justify-center rounded-full bg-[#f1e8e4] text-[12px] font-bold text-[#652636]">
              {initials(email)}
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-[1480px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
          {role === "admin" && activeSection === "overview" ? (
            <Overview
              onNavigate={navigate}
              paymentSummary={paymentSummary}
              payments={payments}
              paymentsReady={paymentsReady}
              weeklyPaymentRevenue={weeklyPaymentRevenue}
              siteAnalytics={siteAnalytics}
              commercialSummary={commercialSummary}
              commercialReady={commercialReady}
            />
          ) : null}
          {role === "admin" && activeSection === "payments" ? (
            <Payments
              paymentSummary={paymentSummary}
              payments={payments}
              paymentsReady={paymentsReady}
            />
          ) : null}
          {role === "admin" && activeSection === "attendees" ? <Attendees products={catalogProducts} /> : null}
          {activeSection === "objectives" ? <Objectives /> : null}
          {role === "admin" && activeSection === "commercial" ? (
            <Commercial products={catalogProducts} />
          ) : null}
          {role === "admin" && activeSection === "funnel" ? (
            <Funnel analytics={siteAnalytics} analyticsReady={analyticsReady} />
          ) : null}
          {role === "admin" && activeSection === "products" ?           <Products
            catalogReady={catalogReady}
            onProductsChange={setCatalogProducts}
            products={catalogProducts}
            productSales={productSales}
            productAnalytics={siteAnalytics?.products ?? null}
            analyticsReady={analyticsReady}
          /> : null}
          {activeSection === "team" && role !== "collaborator" ? <Team email={email} role={role} /> : null}
        </main>
      </div>
    </div>
  );
}

function Overview({
  onNavigate,
  payments,
  paymentSummary,
  paymentsReady,
  siteAnalytics,
  commercialSummary,
  commercialReady,
  weeklyPaymentRevenue,
}: {
  onNavigate: (section: DashboardSection) => void;
  payments: KitadiOrder[];
  paymentSummary: PaymentSummary;
  paymentsReady: boolean;
  siteAnalytics: SiteAnalyticsSummary | null;
  commercialSummary: CommercialSummary | null;
  commercialReady: boolean;
  weeklyPaymentRevenue: WeeklyPaymentRevenue[] | null;
}) {
  return (
    <>
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#a8792f]">
            Hoje · Kitadi
          </p>
          <h2 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.03em] text-[#302829] sm:text-[34px]">
            Bom dia, equipa <span aria-hidden="true">✦</span>
          </h2>
          <p className="mt-2 text-[14px] text-[#837a76]">
            Aqui está o resumo do que está a acontecer no negócio.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#e9e3df] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#615956]">
          <Icon name="calendar" />
          Últimos 30 dias
          <Icon name="chevron" />
        </span>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardMetrics.map((metric, index) => (
          <MetricCard
            key={metric.label}
            metric={
              index === 0
                ? {
                    ...metric,
                    label: "Pagamentos concluídos",
                    value: formatKz(paymentSummary.acceptedAmountKz),
                    change: String(paymentSummary.acceptedCount),
                    note: "transacções confirmadas",
                  }
                : index === 1
                  ? {
                      ...metric,
                      value: formatKz(paymentSummary.pendingAmountKz),
                      change: `${paymentSummary.pendingCount} pedidos`,
                      note: "aguardam confirmação",
                    }
                  : index === 3
                    ? {
                        ...metric,
                        value: siteAnalytics && siteAnalytics.visitors > 0
                          ? `${((siteAnalytics.attributedPaidVisitors / siteAnalytics.visitors) * 100).toFixed(1).replace(".", ",")}%`
                          : "—",
                        change: siteAnalytics
                          ? String(siteAnalytics.attributedPaidVisitors)
                          : "—",
                        note: "pagamentos atribuídos · 30 dias",
                      }
                  : index === 2
                    ? {
                        ...metric,
                        value: commercialSummary ? String(commercialSummary.openCount) : "—",
                        change: commercialSummary ? String(commercialSummary.convertedCount) : "—",
                        note: commercialReady ? "convertidas" : "CRM não configurado",
                      }
                    : metric
            }
          />
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.9fr)]">
        <section className="rounded-[22px] border border-[#eee9e6] bg-white p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <p className="text-[14px] font-bold text-[#302829]">Receita ao longo do tempo</p>
              <p className="mt-1 text-[11px] text-[#a19894]">Receita de pagamentos confirmados · semana actual e anterior</p>
            </div>
            <div className="flex gap-4 text-[10px] font-semibold text-[#847b77]">
              <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#510f1d]" />Esta semana</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#e8dcd7]" />Semana anterior</span>
            </div>
          </div>
          <RevenueChart revenue={weeklyPaymentRevenue} />
        </section>

        <section className="rounded-[22px] border border-[#eee9e6] bg-white p-5 sm:p-6">
          <SectionHeading title="Actividade de pagamentos" action="Ver todos" onAction={() => onNavigate("payments")} />
          <div className="mt-3 divide-y divide-[#f1edeb]">
            {payments.slice(0, 3).map((payment) => (
              <div className="flex gap-3 py-4" key={payment.reference}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f7f3f0] text-[#8b5b39]">
                  <Icon name="payment" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-[#393132]">
                    {paymentStatusLabel(payment.status)} · {payment.name}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-[#958b87]">
                    {payment.productTitle} · {payment.reference}
                  </p>
                </div>
                <span className="shrink-0 pt-0.5 text-[10px] text-[#aaa19d]">
                  {formatPaymentDate(payment.updatedAt)}
                </span>
              </div>
            ))}
            {payments.length === 0 ? (
              <p className="py-6 text-[11px] text-[#968c88]">
                {paymentsReady ? "Ainda não há actividade de pagamentos." : "Aplique a migração de pagamentos para consultar a actividade."}
              </p>
            ) : null}
          </div>
          <button
            className="mt-1 w-full rounded-xl border border-[#eee8e5] py-2.5 text-[11px] font-semibold text-[#746b67] transition hover:bg-[#faf8f7]"
            onClick={() => onNavigate("payments")}
            type="button"
          >
            Abrir pagamentos
          </button>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="rounded-[22px] border border-[#eee9e6] bg-white p-5 sm:p-6">
          <SectionHeading title="Pagamentos recentes" action="Ver todos" onAction={() => onNavigate("payments")} />
          <PaymentTable compact orders={payments} paymentsReady={paymentsReady} />
        </section>
        <section className="rounded-[22px] border border-[#eee9e6] bg-white p-5 sm:p-6">
          <SectionHeading title="Funil do site" action="Ver análise" onAction={() => onNavigate("funnel")} />
          <div className="mt-5 space-y-4">
            {getSiteFunnelSteps(siteAnalytics).slice(0, 4).map((step) => (
              <div key={step.label}>
                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                  <span className="font-medium text-[#6e6561]">{step.label}</span>
                  <span className="font-bold text-[#393132]">{step.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#f0ece9]">
                  <div className={`h-full rounded-full ${step.color}`} style={{ width: `${step.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[10px] text-[#9b918d]">
            {siteAnalytics ? "Eventos recolhidos nos últimos 30 dias." : "Aguardando configuração do analytics."}
          </p>
        </section>
      </div>

      <div className="mt-5">
        <OverviewObjectives onNavigate={() => onNavigate("objectives")} />
      </div>
    </>
  );
}

function Payments({
  payments,
  paymentSummary,
  paymentsReady,
}: {
  payments: KitadiOrder[];
  paymentSummary: PaymentSummary;
  paymentsReady: boolean;
}) {
  return (
    <>
      <PageIntro eyebrow="Financeiro" title="Pagamentos" description="Acompanhe o estado real de cada cobrança, o produto, o método de pagamento e os dados de reconciliação." />
      {!paymentsReady ? (
        <div className="mt-5 rounded-2xl border border-[#e9d8b5] bg-[#fffaf0] px-4 py-3 text-[11px] leading-5 text-[#6b542d]" role="status">
          O registo de pagamentos ainda não está configurado. Aplique a migração
          <code className="mx-1 rounded bg-white px-1.5 py-0.5">20261113000000_create_payment_orders.sql</code>
          e a migração de participantes
          <code className="mx-1 rounded bg-white px-1.5 py-0.5">20261113010000_add_attendee_edition_checkin.sql</code>
          no Supabase para começar a guardar transacções e presenças.
        </div>
      ) : null}
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SimpleStat label="Total recebido" value={formatKz(paymentSummary.acceptedAmountKz)} note={`${paymentSummary.acceptedCount} pagamentos confirmados`} />
        <SimpleStat label="Por confirmar" value={formatKz(paymentSummary.pendingAmountKz)} note={`${paymentSummary.pendingCount} pagamentos pendentes`} />
        <SimpleStat label="Pagamentos falhados" value={String(paymentSummary.failedCount)} note="rejeitados, expirados ou cancelados" />
        <SimpleStat label="Reembolsos" value={formatKz(paymentSummary.refundedAmountKz)} note={`${paymentSummary.refundedCount} pagamentos reembolsados`} />
        <SimpleStat label="Taxa de sucesso" value={`${paymentSummary.successRate.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`} note={`ticket médio ${formatKz(paymentSummary.averageTicketKz)}`} />
      </div>
      <section className="mt-5 rounded-[22px] border border-[#eee9e6] bg-white p-5 sm:p-6">
        <SectionHeading
          title="Transacções recentes"
          subtitle={`Resumo de ${paymentSummary.totalCount} pagamentos · lista das ${payments.length} transacções mais recentes`}
        />
        <PaymentTable orders={payments} paymentsReady={paymentsReady} />
      </section>
    </>
  );
}

type CommercialContact = {
  id: string;
  contact_type: "person" | "company";
  name: string;
  email: string | null;
  phone: string | null;
  company_id: string | null;
};

type CommercialPayment = {
  reference: string;
  status: KitadiOrder["status"];
  provider_status: string | null;
  reason: string | null;
  created_at: string;
  paid_at: string | null;
  amount_kz?: number;
  product_title?: string;
  variant_label?: string;
};

type CommercialOpportunity = {
  id: string;
  contact_id: string;
  title: string;
  product_slug: string | null;
  product_title: string | null;
  amount_kz: number | null;
  stage: "new_contact" | "in_conversation" | "proposal_sent" | "converted";
  source: string;
  payment_reference: string | null;
  payment_status: KitadiOrder["status"] | null;
  payment_reason: string | null;
  notes: string;
  follow_up_at: string | null;
  created_at: string;
  converted_at: string | null;
  contact: CommercialContact;
  payment: CommercialPayment | null;
};

type CommercialHistory = {
  id: string;
  opportunity_id: string;
  event_type: string;
  from_stage: string | null;
  to_stage: string | null;
  payment_status: string | null;
  details: string;
  changed_by_email: string;
  created_at: string;
};

const commercialStages = [
  { id: "new_contact", label: "Novos contactos", tone: "plum" },
  { id: "in_conversation", label: "Em conversa", tone: "gold" },
  { id: "proposal_sent", label: "Proposta enviada", tone: "orange" },
  { id: "converted", label: "Convertido", tone: "green" },
] as const;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCommercialContact(value: unknown): value is CommercialContact {
  return isObjectRecord(value) &&
    typeof value.id === "string" &&
    (value.contact_type === "person" || value.contact_type === "company") &&
    typeof value.name === "string" &&
    (typeof value.email === "string" || value.email === null) &&
    (typeof value.phone === "string" || value.phone === null) &&
    (typeof value.company_id === "string" || value.company_id === null);
}

function isCommercialOpportunity(value: unknown): value is CommercialOpportunity {
  const paymentStatuses = ["pending", "accepted", "rejected", "expired", "canceled", "refunded"];
  return isObjectRecord(value) &&
    typeof value.id === "string" &&
    typeof value.contact_id === "string" &&
    typeof value.title === "string" &&
    typeof value.stage === "string" &&
    commercialStages.some((stage) => stage.id === value.stage) &&
    typeof value.source === "string" &&
    (typeof value.amount_kz === "number" || value.amount_kz === null) &&
    (typeof value.payment_reference === "string" || value.payment_reference === null) &&
    (typeof value.payment_status === "string" && paymentStatuses.includes(value.payment_status) || value.payment_status === null) &&
    typeof value.notes === "string" &&
    typeof value.created_at === "string" &&
    isCommercialContact(value.contact) &&
    (isObjectRecord(value.payment) || value.payment === null);
}

function Commercial({ products }: { products: DashboardProduct[] }) {
  const [opportunities, setOpportunities] = useState<CommercialOpportunity[]>([]);
  const [contacts, setContacts] = useState<CommercialContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reloadCounter, setReloadCounter] = useState(0);
  const [draggedCard, setDraggedCard] = useState<{
    contactId: string;
    stage: CommercialOpportunity["stage"];
  } | null>(null);
  const [dragOverStage, setDragOverStage] = useState<CommercialOpportunity["stage"] | null>(null);
  const lastCardDragAt = useRef(0);

  useEffect(() => {
    let active = true;
    async function loadCommercial() {
      try {
        const response = await fetch("/api/backoffice/commercial", { cache: "no-store" });
        const result: unknown = await response.json();
        if (!response.ok) {
          const code = isObjectRecord(result) && typeof result.error === "string"
            ? result.error
            : "";
          throw new Error(
            code === "commercial_not_configured"
              ? "Aplique a migração 20261113060000_create_commercial_crm.sql no Supabase."
              : "Não foi possível carregar o funil comercial.",
          );
        }
        if (
          !isObjectRecord(result) ||
          !Array.isArray(result.opportunities) ||
          !result.opportunities.every(isCommercialOpportunity) ||
          !Array.isArray(result.contacts) ||
          !result.contacts.every(isCommercialContact)
        ) {
          throw new Error("O serviço comercial devolveu dados inválidos.");
        }
        if (!active) return;
        setOpportunities(result.opportunities);
        setContacts(result.contacts);
        setError("");
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o funil comercial.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCommercial();
    const intervalId = window.setInterval(() => void loadCommercial(), 30_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [reloadCounter]);

  const openCount = opportunities.filter((item) => item.stage !== "converted").length;
  const convertedCount = opportunities.filter((item) => item.stage === "converted").length;
  const potentialAmount = opportunities
    .filter((item) => item.stage !== "converted")
    .reduce((sum, item) => sum + (item.amount_kz ?? 0), 0);
  const selectedOpportunity = opportunities.find((item) => item.id === selectedId) ?? null;
  const selectedContactOpportunities = selectedOpportunity
    ? opportunities.filter((item) => item.contact_id === selectedOpportunity.contact_id)
    : [];

  function updateOpportunity(updated: CommercialOpportunity) {
    setOpportunities((current) =>
      current.map((item) => item.id === updated.id ? updated : item),
    );
    setReloadCounter((current) => current + 1);
  }

  async function moveCardToStage(
    contactId: string,
    fromStage: CommercialOpportunity["stage"],
    toStage: CommercialOpportunity["stage"],
  ) {
    if (fromStage === toStage) return;
    const opportunity = opportunities.find(
      (item) => item.contact_id === contactId && item.stage === fromStage,
    );
    if (!opportunity) {
      setError("Não foi possível encontrar as oportunidades deste cartão. Actualize o funil.");
      return;
    }

    setError("");
    try {
      const response = await fetch(`/api/backoffice/commercial/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          fromStage,
          toStage,
          editOpportunityId: opportunity.id,
          notes: opportunity.notes,
          followUpAt: opportunity.follow_up_at,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const code = isObjectRecord(result) && typeof result.error === "string" ? result.error : "";
        throw new Error(
          code === "commercial_not_configured"
            ? "Aplique a migração 20261113070000_group_commercial_contacts.sql no Supabase."
            : code === "commercial_stage_locked"
              ? "Os pagamentos confirmados permanecem na etapa Convertido."
              : "Não foi possível mover o cartão.",
        );
      }
      setReloadCounter((current) => current + 1);
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Não foi possível mover o cartão.");
    }
  }

  function handleCardDrop(event: DragEvent<HTMLElement>, toStage: CommercialOpportunity["stage"]) {
    event.preventDefault();
    setDragOverStage(null);
    const drag = draggedCard;
    setDraggedCard(null);
    if (drag) void moveCardToStage(drag.contactId, drag.stage, toStage);
  }

  return (
    <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <PageIntro eyebrow="Relacionamento" title="Funil comercial" description="Acompanhe contactos manuais e oportunidades criadas a partir de inscrições no checkout." />
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#510f1d] px-5 text-[12px] font-semibold text-white transition-colors hover:bg-[#762838]"
          onClick={() => setCreateOpen(true)}
          type="button"
        >
          + Novo contacto
        </button>
      </div>
      <div className="mb-5 mt-5 flex flex-wrap gap-2">
        {[
          [String(openCount), "oportunidades abertas"],
          [String(convertedCount), "convertidas"],
          [formatKz(potentialAmount), "valor potencial em aberto"],
        ].map(([value, label]) => (
          <span className="rounded-xl border border-[#ece6e2] bg-white px-4 py-2.5 text-[11px] text-[#776e6a]" key={label}>
            <strong className="mr-1.5 text-[#352d2e]">{value}</strong>{label}
          </span>
        ))}
      </div>
      <p className="mb-4 text-[10px] text-[#938783]">Arraste um cartão para outra etapa para mover as oportunidades da pessoa nessa etapa.</p>
      {error ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e9d8b5] bg-[#fffaf0] px-4 py-3 text-[11px] leading-5 text-[#6b542d]" role="alert">
          <span>{error}</span>
          <button className="font-bold underline" onClick={() => setReloadCounter((current) => current + 1)} type="button">Tentar novamente</button>
        </div>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-4">
        {commercialStages.map((stage) => {
          const cards = groupCommercialCards(opportunities, stage.id);
          const amount = cards.reduce(
            (sum, card) => sum + card.opportunities.reduce((total, item) => total + (item.amount_kz ?? 0), 0),
            0,
          );
          return (
            <section
              className={`min-w-0 rounded-[20px] border p-3 transition-colors ${
                dragOverStage === stage.id
                  ? "border-[#bd9250] bg-[#f7efe0]"
                  : "border-[#eee9e6] bg-[#f1eeec]"
              }`}
              key={stage.id}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDragOverStage(null);
                }
              }}
              onDragOver={(event) => {
                if (!draggedCard || draggedCard.stage === stage.id) return;
                event.preventDefault();
                setDragOverStage(stage.id);
              }}
              onDrop={(event) => handleCardDrop(event, stage.id)}
            >
              <div className="flex items-center gap-2 px-1 pb-3 pt-1">
                <span className={`size-2 rounded-full ${toneDot(stage.tone)}`} />
                <h3 className="text-[12px] font-bold text-[#393132]">{stage.label}</h3>
                <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#857b77]">{cards.length}</span>
              </div>
              <p className="mb-3 px-1 text-[10px] text-[#968c88]">
                {stage.id === "converted" ? "Valor convertido" : "Valor potencial"} · {formatKz(amount)}
              </p>
              <div className="space-y-3">
                {cards.map((card) => {
                  const item = card.opportunities[0];
                  const cardAmount = card.opportunities.reduce((sum, current) => sum + (current.amount_kz ?? 0), 0);
                  return (
                  <button
                    aria-label={`${card.contact.name}, arrastar para outra etapa ou abrir detalhes`}
                    className={`block w-full rounded-[15px] border border-[#ebe5e2] bg-white p-3.5 text-left shadow-[0_3px_10px_rgba(47,32,28,0.025)] transition hover:border-[#cda45c] hover:shadow-sm ${
                      draggedCard?.contactId === card.contact.id ? "opacity-50" : ""
                    }`}
                    draggable
                    key={`${card.contact.id}:${stage.id}`}
                    onDragEnd={() => {
                      lastCardDragAt.current = Date.now();
                      setDraggedCard(null);
                      setDragOverStage(null);
                    }}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", card.contact.id);
                      setDraggedCard({ contactId: card.contact.id, stage: stage.id });
                    }}
                    onClick={(event) => {
                      if (Date.now() - lastCardDragAt.current < 500) {
                        event.preventDefault();
                        return;
                      }
                      setSelectedId(item.id);
                    }}
                    type="button"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${toneAvatar(stage.tone)}`}>
                        {initials(card.contact.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-bold text-[#3d3435]">{card.contact.name}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-[#998f8b]">
                          {card.contact.contact_type === "company" ? "Empresa" : item.product_title || item.title}
                        </span>
                      </span>
                    </span>
                    {card.contact.company_id ? (
                      <span className="mt-2 block truncate text-[9px] text-[#928783]">
                        {contacts.find((contact) => contact.id === card.contact.company_id)?.name ?? "Associado a uma empresa"}
                      </span>
                    ) : null}
                    {card.opportunities.length > 1 ? (
                      <span className="mt-2 block text-[9px] font-semibold text-[#84756e]">
                        {card.opportunities.length} oportunidades nesta etapa
                      </span>
                    ) : null}
                    <span className="mt-3 flex items-center justify-between gap-2 border-t border-[#f2eeec] pt-2.5">
                      <span className="truncate text-[9px] text-[#a39995]">
                        {card.opportunities.some((entry) => entry.payment_status === "pending")
                          ? "Tem pagamento pendente"
                          : item.payment_status
                            ? paymentStatusForCommercial(item.payment_status, item.created_at)
                            : item.source === "checkout" ? "Checkout iniciado" : "Registo manual"}
                      </span>
                      <span className="shrink-0 text-[10px] font-bold text-[#62514c]">
                        {cardAmount === 0 && card.opportunities.every((entry) => entry.amount_kz === null)
                          ? "Valor por definir"
                          : formatKz(cardAmount)}
                      </span>
                    </span>
                  </button>
                  );
                })}
                {cards.length === 0 && !loading ? (
                  <p className="rounded-xl border border-dashed border-[#d6cbc6] px-3 py-4 text-center text-[10px] text-[#938783]">Sem oportunidades nesta etapa.</p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
      {loading ? <p className="mt-4 text-[11px] text-[#938783]">A carregar oportunidades…</p> : null}
      {createOpen ? (
        <CommercialCreateModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            setReloadCounter((current) => current + 1);
          }}
          products={products}
        />
      ) : null}
      {selectedOpportunity ? (
        <CommercialDetailsModal
          contacts={contacts}
          onClose={() => setSelectedId(null)}
          onSaved={updateOpportunity}
          opportunity={selectedOpportunity}
          contactOpportunities={selectedContactOpportunities}
        />
      ) : null}
    </>
  );
}

function groupCommercialCards(
  opportunities: CommercialOpportunity[],
  stage: CommercialOpportunity["stage"],
) {
  const groups = new Map<string, CommercialOpportunity[]>();
  for (const opportunity of opportunities) {
    if (opportunity.stage !== stage) continue;
    const group = groups.get(opportunity.contact_id) ?? [];
    group.push(opportunity);
    groups.set(opportunity.contact_id, group);
  }
  return [...groups.values()].map((items) => ({
    contact: items[0].contact,
    opportunities: items,
  }));
}

function paymentStatusForCommercial(status: KitadiOrder["status"], createdAt: string) {
  if (status === "pending") {
    const pendingFor24Hours = Date.now() - new Date(createdAt).getTime() >= 24 * 60 * 60 * 1000;
    return pendingFor24Hours ? "Não concluído · +24 h" : "Aguarda pagamento";
  }
  const labels: Record<KitadiOrder["status"], string> = {
    pending: "Aguarda pagamento",
    accepted: "Pagamento confirmado",
    rejected: "Pagamento rejeitado",
    expired: "Pagamento expirado",
    canceled: "Pagamento cancelado",
    refunded: "Pagamento reembolsado",
  };
  return labels[status];
}

function CommercialCreateModal({
  products,
  onClose,
  onCreated,
}: {
  products: DashboardProduct[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [contactType, setContactType] = useState<"person" | "company">("person");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const selectedProduct = products.find((product) => product.slug === form.get("productSlug"));
    const amountValue = String(form.get("amountKz") ?? "").trim();
    const amountKz = amountValue ? Number(amountValue) : null;
    const followUpValue = String(form.get("followUpAt") ?? "");

    try {
      const response = await fetch("/api/backoffice/commercial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: {
            contactType: form.get("contactType"),
            name: form.get("name"),
            email: form.get("email"),
            phone: form.get("phone"),
            companyName: form.get("companyName"),
          },
          opportunity: {
            title: form.get("title"),
            productSlug: selectedProduct?.slug ?? null,
            productTitle: selectedProduct?.title ?? null,
            amountKz,
            notes: form.get("notes"),
            followUpAt: followUpValue ? new Date(followUpValue).toISOString() : null,
          },
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const code = isObjectRecord(result) && typeof result.error === "string" ? result.error : "";
        throw new Error(
          code === "commercial_not_configured"
            ? "Aplique a migração CRM do Supabase antes de registar contactos."
            : "Não foi possível registar o contacto. Verifique os dados e tente novamente.",
        );
      }
      onCreated();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível registar o contacto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#211d1e]/45 p-4">
      <section aria-labelledby="commercial-create-title" aria-modal="true" className="my-auto w-full max-w-[700px] rounded-[24px] bg-white p-5 shadow-2xl sm:p-7" role="dialog">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a8792f]">Funil comercial</p>
            <h2 className="mt-1 text-[20px] font-bold text-[#302829]" id="commercial-create-title">Novo contacto</h2>
            <p className="mt-1 text-[12px] text-[#827976]">Regista uma pessoa ou empresa e cria uma oportunidade em Novos contactos.</p>
          </div>
          <button aria-label="Fechar" className="rounded-full px-3 py-1 text-[20px] text-[#857b77] hover:bg-[#f5f2f1]" onClick={onClose} type="button">×</button>
        </div>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-[11px] font-semibold text-[#514849]">
              Tipo de contacto
              <select className="mt-1.5 h-11 w-full rounded-xl border border-[#e7e1df] bg-white px-3 text-[12px]" name="contactType" onChange={(event) => setContactType(event.target.value as "person" | "company")} value={contactType}>
                <option value="person">Pessoa</option>
                <option value="company">Empresa</option>
              </select>
            </label>
            <label className="text-[11px] font-semibold text-[#514849]">
              Nome / empresa
              <input className="mt-1.5 h-11 w-full rounded-xl border border-[#e7e1df] px-3 text-[12px]" maxLength={160} name="name" required />
            </label>
            <label className="text-[11px] font-semibold text-[#514849]">
              Email (opcional)
              <input className="mt-1.5 h-11 w-full rounded-xl border border-[#e7e1df] px-3 text-[12px]" maxLength={254} name="email" type="email" />
            </label>
            <label className="text-[11px] font-semibold text-[#514849]">
              Telefone (opcional)
              <input className="mt-1.5 h-11 w-full rounded-xl border border-[#e7e1df] px-3 text-[12px]" maxLength={24} name="phone" type="tel" />
            </label>
            {contactType === "person" ? (
              <label className="text-[11px] font-semibold text-[#514849]">
                Empresa associada (opcional)
                <input className="mt-1.5 h-11 w-full rounded-xl border border-[#e7e1df] px-3 text-[12px]" maxLength={160} name="companyName" placeholder="O nome existente será reutilizado" />
              </label>
            ) : <div />}
            <label className="text-[11px] font-semibold text-[#514849]">
              Produto / serviço
              <select className="mt-1.5 h-11 w-full rounded-xl border border-[#e7e1df] bg-white px-3 text-[12px]" defaultValue="" name="productSlug">
                <option value="">Sem produto definido</option>
                {products.map((product) => <option key={product.slug} value={product.slug}>{product.title}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-[#514849] sm:col-span-2">
              Descrição da oportunidade
              <input className="mt-1.5 h-11 w-full rounded-xl border border-[#e7e1df] px-3 text-[12px]" maxLength={180} name="title" placeholder="Ex.: Interesse em formação para a equipa" required />
            </label>
            <label className="text-[11px] font-semibold text-[#514849]">
              Valor potencial (Kz)
              <input className="mt-1.5 h-11 w-full rounded-xl border border-[#e7e1df] px-3 text-[12px]" min="0" name="amountKz" step="1" type="number" />
            </label>
            <label className="text-[11px] font-semibold text-[#514849]">
              Próximo contacto
              <input className="mt-1.5 h-11 w-full rounded-xl border border-[#e7e1df] px-3 text-[12px]" name="followUpAt" type="datetime-local" />
            </label>
            <label className="text-[11px] font-semibold text-[#514849] sm:col-span-2">
              Notas
              <textarea className="mt-1.5 min-h-20 w-full rounded-xl border border-[#e7e1df] px-3 py-2 text-[12px]" maxLength={2000} name="notes" />
            </label>
          </div>
          {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-[11px] text-red-800" role="alert">{error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-[#f0ecea] pt-4">
            <button className="rounded-full border border-[#e7e1df] px-4 py-2.5 text-[11px] font-semibold text-[#716a69]" onClick={onClose} type="button">Cancelar</button>
            <button className="rounded-full bg-[#510f1d] px-5 py-2.5 text-[11px] font-semibold text-white disabled:opacity-60" disabled={saving} type="submit">{saving ? "A guardar…" : "Criar contacto"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CommercialDetailsModal({
  opportunity,
  contactOpportunities,
  contacts,
  onClose,
  onSaved,
}: {
  opportunity: CommercialOpportunity;
  contactOpportunities: CommercialOpportunity[];
  contacts: CommercialContact[];
  onClose: () => void;
  onSaved: (opportunity: CommercialOpportunity) => void;
}) {
  const [stage, setStage] = useState(opportunity.stage);
  const [notes, setNotes] = useState(opportunity.notes);
  const [followUpAt, setFollowUpAt] = useState(
    opportunity.follow_up_at ? toLocalDateTime(opportunity.follow_up_at) : "",
  );
  const [history, setHistory] = useState<CommercialHistory[]>([]);
  const [detailOpportunities, setDetailOpportunities] = useState(contactOpportunities);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const company = opportunity.contact.company_id
    ? contacts.find((contact) => contact.id === opportunity.contact.company_id)
    : null;

  useEffect(() => {
    if (opportunity.payment_status === "accepted") setStage("converted");
  }, [opportunity.payment_status]);

  useEffect(() => {
    let active = true;
    async function loadDetails() {
      try {
        const response = await fetch(`/api/backoffice/commercial/${opportunity.id}`, { cache: "no-store" });
        const result: unknown = await response.json();
        if (
          !response.ok ||
          !isObjectRecord(result) ||
          !Array.isArray(result.history) ||
          !Array.isArray(result.opportunities) ||
          !result.opportunities.every(isCommercialOpportunity)
        ) {
          throw new Error("Não foi possível carregar o histórico desta oportunidade.");
        }
        if (!active) return;
        setDetailOpportunities(result.opportunities);
        const validHistory = result.history.filter((item): item is CommercialHistory =>
          isObjectRecord(item) &&
          typeof item.id === "string" &&
          typeof item.opportunity_id === "string" &&
          typeof item.event_type === "string" &&
          typeof item.details === "string" &&
          typeof item.created_at === "string" &&
          typeof item.changed_by_email === "string",
        );
        setHistory(validHistory);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Erro ao carregar histórico.");
      } finally {
        if (active) setLoadingHistory(false);
      }
    }
    void loadDetails();
    return () => { active = false; };
  }, [opportunity.id]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/backoffice/commercial/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: opportunity.contact_id,
          fromStage: opportunity.stage,
          toStage: stage,
          editOpportunityId: opportunity.id,
          notes,
          followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const code = isObjectRecord(result) && typeof result.error === "string" ? result.error : "";
        throw new Error(
          code === "commercial_not_configured"
            ? "Aplique a migração 20261113070000_group_commercial_contacts.sql no Supabase."
            : code === "commercial_stage_locked"
              ? "Os pagamentos confirmados permanecem na etapa Convertido."
              : "Não foi possível guardar as alterações desta oportunidade.",
        );
      }
      onSaved({
        ...opportunity,
        stage,
        notes,
        follow_up_at: followUpAt ? new Date(followUpAt).toISOString() : null,
        converted_at: stage === "converted"
          ? opportunity.converted_at ?? new Date().toISOString()
          : opportunity.converted_at,
      });
      if (isObjectRecord(result) && result.updated === true) {
        const detailResponse = await fetch(`/api/backoffice/commercial/${opportunity.id}`, { cache: "no-store" });
        const details: unknown = await detailResponse.json();
        if (
          !detailResponse.ok ||
          !isObjectRecord(details) ||
          !Array.isArray(details.history) ||
          !Array.isArray(details.opportunities) ||
          !details.opportunities.every(isCommercialOpportunity)
        ) {
          setError("As alterações foram guardadas, mas não foi possível actualizar o histórico.");
          return;
        }
        setDetailOpportunities(details.opportunities);
        setHistory(details.history.filter((item): item is CommercialHistory =>
          isObjectRecord(item) &&
          typeof item.id === "string" &&
          typeof item.opportunity_id === "string" &&
          typeof item.event_type === "string" &&
          typeof item.details === "string" &&
          typeof item.created_at === "string" &&
          typeof item.changed_by_email === "string",
        ));
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível guardar as alterações.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#211d1e]/45 p-4">
      <section aria-labelledby="commercial-detail-title" aria-modal="true" className="my-auto max-h-[92vh] w-full max-w-[760px] overflow-y-auto rounded-[24px] bg-white p-5 shadow-2xl sm:p-7" role="dialog">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a8792f]">{opportunity.source === "checkout" ? "Inscrição do site" : "Registo manual"}</p>
            <h2 className="mt-1 truncate text-[20px] font-bold text-[#302829]" id="commercial-detail-title">{opportunity.contact.name}</h2>
            <p className="mt-1 text-[12px] text-[#827976]">{opportunity.title}</p>
          </div>
          <button aria-label="Fechar" className="rounded-full px-3 py-1 text-[20px] text-[#857b77] hover:bg-[#f5f2f1]" onClick={onClose} type="button">×</button>
        </div>
        <div className="mt-5 grid gap-3 rounded-2xl bg-[#faf8f7] p-4 sm:grid-cols-2">
          <DetailItem label="Tipo" value={opportunity.contact.contact_type === "company" ? "Empresa" : "Pessoa"} />
          {company ? <DetailItem label="Empresa associada" value={company.name} /> : null}
          <DetailItem label="Email" value={opportunity.contact.email || "Não indicado"} />
          <DetailItem label="Telefone" value={opportunity.contact.phone || "Não indicado"} />
          <DetailItem label="Produto / serviço" value={opportunity.product_title || "Por definir"} />
          <DetailItem label="Valor potencial" value={opportunity.amount_kz === null ? "Por definir" : formatKz(opportunity.amount_kz)} />
          <DetailItem label="Origem" value={opportunity.source === "checkout" ? "Checkout do site" : "Manual"} />
          <DetailItem label="Criado em" value={formatPaymentDate(opportunity.created_at)} />
          {opportunity.payment_reference ? <DetailItem label="Referência de pagamento" value={opportunity.payment_reference} /> : null}
          {opportunity.payment_status ? <DetailItem label="Estado do pagamento" value={paymentStatusForCommercial(opportunity.payment_status, opportunity.created_at)} /> : null}
          {opportunity.payment?.provider_status ? <DetailItem label="Estado devolvido pelo fornecedor" value={opportunity.payment.provider_status} /> : null}
          {opportunity.payment?.reason || opportunity.payment_reason ? (
            <div className="sm:col-span-2">
              <DetailItem label="O que aconteceu" value={opportunity.payment?.reason || opportunity.payment_reason || ""} />
            </div>
          ) : null}
          {opportunity.payment?.variant_label ? <DetailItem label="Opção escolhida" value={opportunity.payment.variant_label} /> : null}
          {opportunity.payment?.paid_at ? <DetailItem label="Pagamento confirmado em" value={formatPaymentDate(opportunity.payment.paid_at)} /> : null}
        </div>
        <section className="mt-5 rounded-2xl border border-[#eee9e6] p-4">
          <h3 className="text-[12px] font-bold text-[#393132]">Oportunidades e movimentos desta pessoa</h3>
          <ul className="mt-3 space-y-2">
            {detailOpportunities.map((item) => (
              <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#faf8f7] px-3 py-2" key={item.id}>
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-semibold text-[#514849]">{item.product_title || item.title}</span>
                  <span className="mt-0.5 block text-[9px] text-[#938783]">
                    {commercialStages.find((itemStage) => itemStage.id === item.stage)?.label} · {formatPaymentDate(item.created_at)}
                    {item.payment_reference ? ` · Ref. ${item.payment_reference}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] font-semibold text-[#62514c]">
                  {item.payment_status
                    ? paymentStatusForCommercial(item.payment_status, item.created_at)
                    : item.amount_kz === null ? "Sem valor" : formatKz(item.amount_kz)}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <form className="mt-5 space-y-4" onSubmit={save}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-[11px] font-semibold text-[#514849]">
              Mover cartão e oportunidades desta etapa
              <select className="mt-1.5 h-11 w-full rounded-xl border border-[#e7e1df] bg-white px-3 text-[12px]" onChange={(event) => setStage(event.target.value as CommercialOpportunity["stage"])} value={stage}>
                {commercialStages.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-[#514849]">
              Próximo contacto
              <input className="mt-1.5 h-11 w-full rounded-xl border border-[#e7e1df] px-3 text-[12px]" onChange={(event) => setFollowUpAt(event.target.value)} type="datetime-local" value={followUpAt} />
            </label>
            <label className="text-[11px] font-semibold text-[#514849] sm:col-span-2">
              Notas e acompanhamento da oportunidade seleccionada
              <textarea className="mt-1.5 min-h-24 w-full rounded-xl border border-[#e7e1df] px-3 py-2 text-[12px]" maxLength={2000} onChange={(event) => setNotes(event.target.value)} value={notes} />
            </label>
          </div>
          {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-[11px] text-red-800" role="alert">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button className="rounded-full border border-[#e7e1df] px-4 py-2.5 text-[11px] font-semibold text-[#716a69]" onClick={onClose} type="button">Fechar</button>
            <button className="rounded-full bg-[#510f1d] px-5 py-2.5 text-[11px] font-semibold text-white disabled:opacity-60" disabled={saving} type="submit">{saving ? "A guardar…" : "Guardar alterações"}</button>
          </div>
        </form>
        <section className="mt-6 border-t border-[#f0ecea] pt-4">
          <h3 className="text-[12px] font-bold text-[#393132]">Histórico</h3>
          {loadingHistory ? <p className="mt-2 text-[10px] text-[#938783]">A carregar histórico…</p> : null}
          {!loadingHistory && history.length === 0 ? <p className="mt-2 text-[10px] text-[#938783]">Ainda não há alterações registadas.</p> : null}
          <ol className="mt-3 space-y-3">
            {history.map((item) => (
              <li className="border-l-2 border-[#eadfd9] pl-3" key={item.id}>
                <p className="text-[10px] font-semibold text-[#514849]">
                  {detailOpportunities.find((entry) => entry.id === item.opportunity_id)?.product_title || "Oportunidade"}: {item.details}
                </p>
                <p className="mt-1 text-[9px] text-[#938783]">
                  {item.changed_by_email ? `${item.changed_by_email} · ` : "Sistema · "}
                  {formatPaymentDate(item.created_at)}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </section>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#a39995]">{label}</p>
      <p className="mt-1 break-words text-[11px] font-semibold text-[#514849]">{value}</p>
    </div>
  );
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function getSiteFunnelSteps(analytics: SiteAnalyticsSummary | null) {
  const visitors = analytics?.visitors ?? 0;
  const percentOfVisitors = (count: number) =>
    visitors ? Math.min(100, (count / visitors) * 100) : 0;

  return [
    {
      label: "Sessões únicas",
      count: visitors,
      percent: visitors ? 100 : 0,
      note: "sessões anónimas observadas nos últimos 30 dias",
      color: "bg-[#510f1d]",
    },
    {
      label: "Sessões que visitaram produtos",
      count: analytics?.productVisitors ?? 0,
      percent: percentOfVisitors(analytics?.productVisitors ?? 0),
      note: `${analytics?.productViews ?? 0} visualizações de páginas de produto`,
      color: "bg-[#762838]",
    },
    {
      label: "Sessões que clicaram para contactar",
      count: analytics?.contactVisitors ?? 0,
      percent: percentOfVisitors(analytics?.contactVisitors ?? 0),
      note: `${analytics?.contactClicks ?? 0} cliques em WhatsApp, email ou telefone`,
      color: "bg-[#ae7d32]",
    },
    {
      label: "Sessões que iniciaram checkout",
      count: analytics?.checkoutVisitors ?? 0,
      percent: percentOfVisitors(analytics?.checkoutVisitors ?? 0),
      note: `${analytics?.checkoutStarts ?? 0} visitas ao checkout`,
      color: "bg-[#cda45c]",
    },
    {
      label: "Sessões com pagamento atribuído",
      count: analytics?.attributedPaidVisitors ?? 0,
      percent: percentOfVisitors(analytics?.attributedPaidVisitors ?? 0),
      note: `${analytics?.attributedPaidOrders ?? 0} pagamentos confirmados associados a uma sessão do site`,
      color: "bg-[#52765e]",
    },
  ];
}

function Funnel({
  analytics,
  analyticsReady,
}: {
  analytics: SiteAnalyticsSummary | null;
  analyticsReady: boolean;
}) {
  const funnelSteps = getSiteFunnelSteps(analytics);
  const totalChannelClicks = analytics
    ? Object.values(analytics.contactsByChannel).reduce((total, count) => total + count, 0)
    : 0;
  const conversionRate = analytics?.visitors
    ? `${((analytics.attributedPaidVisitors / analytics.visitors) * 100).toFixed(1).replace(".", ",")}%`
    : "—";
  const contactSources = [
    { key: "whatsapp", label: "WhatsApp", color: "bg-[#66836c]" },
    { key: "email", label: "Email", color: "bg-[#510f1d]" },
    { key: "phone", label: "Telefone", color: "bg-[#ae7d32]" },
  ] as const;
  return (
    <>
      <PageIntro eyebrow="Aquisição e conversão" title="Funil do site" description="Métricas reais do site, sem recolher nome, email ou telefone para analytics." />
      {!analyticsReady ? (
        <div className="mt-5 rounded-2xl border border-[#e9d8b5] bg-[#fffaf0] px-4 py-3 text-[11px] leading-5 text-[#6b542d]" role="status">
          O analytics ainda não está configurado. Aplica a migração <code className="mx-1 rounded bg-white px-1.5 py-0.5">20261113050000_create_site_analytics.sql</code> no Supabase.
        </div>
      ) : null}
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SimpleStat label="Sessões únicas" value={String(analytics?.visitors ?? 0)} note="últimos 30 dias" />
        <SimpleStat label="Visualizações de produtos" value={String(analytics?.productViews ?? 0)} note="últimos 30 dias" />
        <SimpleStat label="Cliques para contacto" value={String(analytics?.contactClicks ?? 0)} note="WhatsApp, email e telefone" />
        <SimpleStat label="Conversão atribuída" value={analytics ? conversionRate : "—"} note={`${analytics?.attributedPaidOrders ?? 0} pagamentos associados`} />
      </div>
      <p className="mt-3 text-[10px] text-[#9b918d]">
        A recolha começa após a publicação da instrumentação e aplicação da migração; não há dados retroactivos.
      </p>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <section className="rounded-[22px] border border-[#eee9e6] bg-white p-5 sm:p-7">
          <SectionHeading title="Percurso de conversão" subtitle="Sessões que avançaram por cada etapa · últimos 30 dias" />
          <div className="mt-7 space-y-5">
            {funnelSteps.map((step, index) => (
              <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3" key={step.label}>
                <div className="flex flex-col items-center">
                  <span className={`flex size-7 items-center justify-center rounded-full text-[10px] font-bold ${index === 4 ? "bg-[#e9f0e9] text-[#52765e]" : "bg-[#f4eeeb] text-[#75404a]"}`}>{index + 1}</span>
                  {index < funnelSteps.length - 1 ? <span className="mt-1 min-h-8 w-px flex-1 bg-[#e9e2de]" /> : null}
                </div>
                <div className="pb-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[12px] font-bold text-[#393132]">{step.label}</span>
                    <span className="text-[15px] font-bold text-[#393132]">{step.count}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f1edeb]">
                    <div className={`h-full rounded-full ${step.color}`} style={{ width: `${step.percent}%` }} />
                  </div>
                  <p className="mt-1.5 text-[10px] text-[#a09793]">{step.note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-[22px] border border-[#eee9e6] bg-white p-5 sm:p-6">
          <SectionHeading title="Origem dos contactos" subtitle="Cliques registados nos últimos 30 dias" />
          <div className="mt-6 space-y-5">
            {contactSources.map((source) => {
              const count = analytics?.contactsByChannel[source.key] ?? 0;
              const percent = totalChannelClicks
                ? (count / totalChannelClicks) * 100
                : 0;
              return (
                <div key={source.label}>
                  <div className="mb-2 flex justify-between text-[11px]">
                    <span className="font-medium text-[#635a57]">{source.label}</span>
                    <span className="text-[#918783]">{count} <b className="ml-1 text-[#403738]">{percent.toFixed(0)}%</b></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#f0ece9]">
                    <div className={`h-full rounded-full ${source.color}`} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-7 rounded-2xl bg-[#f8f4ec] p-4">
            <p className="text-[11px] font-bold text-[#6a4b20]">Privacidade e atribuição</p>
            <p className="mt-1.5 text-[11px] leading-5 text-[#80746b]">
              São guardados eventos e um identificador aleatório da sessão. Esse identificador associa um checkout ao pagamento; dados de contacto não são enviados para o analytics.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

function Products({
  products,
  onProductsChange,
  catalogReady,
  productSales,
  productAnalytics,
  analyticsReady,
}: {
  products: DashboardProduct[];
  onProductsChange: (products: DashboardProduct[]) => void;
  catalogReady: boolean;
  productSales: ProductSales | null;
  productAnalytics: Record<string, ProductAnalytics> | null;
  analyticsReady: boolean;
}) {
  const [editorProduct, setEditorProduct] = useState<DashboardProduct | null>(
    null,
  );
  const [creatingProduct, setCreatingProduct] = useState(false);

  function saveProduct(product: DashboardProduct) {
    onProductsChange(
      products.some((item) => item.slug === product.slug)
        ? products.map((item) =>
            item.slug === product.slug ? product : item,
          )
        : [...products, product],
    );
    setEditorProduct(null);
    setCreatingProduct(false);
  }

  const totalSales = productSales
    ? Object.values(productSales).reduce((total, item) => total + item.sales, 0)
    : null;
  const totalRevenue = productSales
    ? Object.values(productSales).reduce((total, item) => total + item.revenueKz, 0)
    : null;
  const totalViews = productAnalytics
    ? Object.values(productAnalytics).reduce((total, item) => total + item.views, 0)
    : null;
  const totalContactClicks = productAnalytics
    ? Object.values(productAnalytics).reduce((total, item) => total + item.contactClicks, 0)
    : null;

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageIntro eyebrow="Catálogo Kitadi" title="Produtos" description="Catálogo real da landing page e vendas confirmadas por produto." />
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#510f1d] px-5 text-[12px] font-semibold text-white transition-colors hover:bg-[#762838]"
          onClick={() => setCreatingProduct(true)}
          type="button"
        >
          Criar produto
        </button>
      </div>
      {!catalogReady ? (
        <div
          className="mt-5 rounded-2xl border border-[#e9d8b5] bg-[#fffaf0] px-4 py-3 text-[11px] leading-5 text-[#6b542d]"
          role="status"
        >
          O catálogo está em modo de compatibilidade: a tabela de produtos ainda
          não existe no Supabase. O conteúdo actual continua visível, mas
          alterações só serão guardadas depois de aplicares a migração e
          executares o seed.
        </div>
      ) : null}
      {!analyticsReady ? (
        <div className="mt-5 rounded-2xl border border-[#e9d8b5] bg-[#fffaf0] px-4 py-3 text-[11px] leading-5 text-[#6b542d]" role="status">
          As métricas de visitas e contactos precisam da migração <code className="mx-1 rounded bg-white px-1.5 py-0.5">20261113050000_create_site_analytics.sql</code>.
        </div>
      ) : null}
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SimpleStat label="Produtos no catálogo" value={String(products.length).padStart(2, "0")} note="programas e experiências" />
        <SimpleStat label="Visualizações" value={totalViews === null ? "—" : String(totalViews)} note="páginas de produto · 30 dias" />
        <SimpleStat label="Cliques de contacto" value={totalContactClicks === null ? "—" : String(totalContactClicks)} note="associados a produtos · 30 dias" />
        <SimpleStat
          label="Vendas confirmadas"
          value={totalSales === null ? "—" : String(totalSales)}
          note={productSales === null ? "pagamentos indisponíveis" : "total de pagamentos aceites"}
        />
        <SimpleStat
          label="Receita confirmada"
          value={totalRevenue === null ? "—" : formatKz(totalRevenue)}
          note={productSales === null ? "pagamentos indisponíveis" : "total de pagamentos aceites"}
        />
      </div>
      <section className="mt-5 overflow-hidden rounded-[22px] border border-[#eee9e6] bg-white">
        <div className="flex flex-col justify-between gap-2 border-b border-[#f0ecea] px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h3 className="text-[14px] font-bold text-[#342c2d]">Catálogo e desempenho</h3>
            <p className="mt-1 text-[11px] text-[#9b918d]">Visitas e contactos dos últimos 30 dias; vendas e receitas acumuladas a partir dos pagamentos aceites.</p>
          </div>
          <span className="w-fit rounded-full bg-[#f6f1e6] px-3 py-1.5 text-[10px] font-bold text-[#8d692c]">Sincronizado com a landing</span>
        </div>
        <div className="hidden grid-cols-[minmax(210px,1.3fr)_repeat(5,minmax(95px,0.55fr))] border-b border-[#f0ecea] bg-[#fcfbfa] px-6 py-3 xl:grid">
          {["Produto", "Preço", "Visualizações · 30 d", "Contactos · 30 d", "Vendas", "Receita"].map((label) => (
            <p className="text-[9px] font-bold uppercase tracking-[0.09em] text-[#a39995]" key={label}>{label}</p>
          ))}
        </div>
        <div className="divide-y divide-[#f1edeb]">
          {products.map((product) => {
            const sales = productSales?.[product.slug];
            const analytics = productAnalytics?.[product.slug];
            return (
              <article className="grid gap-4 px-5 py-4 xl:grid-cols-[minmax(210px,1.3fr)_repeat(5,minmax(95px,0.55fr))] xl:items-center sm:px-6" key={product.slug}>
                <div className="flex min-w-0 items-center gap-3">
                  <Image alt="" className="size-[52px] shrink-0 rounded-xl bg-[#f5f0ed] object-cover" height={52} src={product.image} width={52} />
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-bold text-[#3a3233]">{product.title}</p>
                    <p className="mt-1 truncate text-[10px] text-[#9a908c]">{product.category} · {product.format}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full bg-[#f3f0ed] px-2 py-0.5 text-[9px] font-semibold text-[#766b66]">{product.statusLabel}</span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold ${product.published ? "bg-[#edf4ee] text-[#52765e]" : "bg-[#f4eeee] text-[#8a5555]"}`}>
                        {product.published ? "Publicado" : "Rascunho"}
                      </span>
                    </div>
                    <button
                      className="mt-2 text-[10px] font-semibold text-[#762838] hover:underline"
                      onClick={() => setEditorProduct(product)}
                      type="button"
                    >
                      Editar produto
                    </button>
                  </div>
                </div>
                <ProductMetric label="Preço" value={product.price || "Por definir"} />
                <ProductMetric label="Visualizações · 30 d" value={productAnalytics === null ? "—" : String(analytics?.views ?? 0)} />
                <ProductMetric label="Contactos · 30 d" value={productAnalytics === null ? "—" : String(analytics?.contactClicks ?? 0)} />
                <ProductMetric label="Vendas confirmadas" value={productSales === null ? "—" : String(sales?.sales ?? 0)} />
                <ProductMetric label="Receita confirmada" value={productSales === null ? "—" : formatKz(sales?.revenueKz ?? 0)} />
              </article>
            );
          })}
        </div>
      </section>
      {creatingProduct || editorProduct ? (
        <ProductEditor
          key={editorProduct?.slug ?? "new-product"}
          onClose={() => {
            setCreatingProduct(false);
            setEditorProduct(null);
          }}
          onSaved={saveProduct}
          product={editorProduct}
        />
      ) : null}
    </>
  );
}

function ProductEditor({
  product,
  onClose,
  onSaved,
}: {
  product: DashboardProduct | null;
  onClose: () => void;
  onSaved: (product: DashboardProduct) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const payload = {
      title: form.get("title"),
      category: form.get("category"),
      shortName: form.get("shortName"),
      tagline: form.get("tagline"),
      image: form.get("image"),
      statusLabel: form.get("statusLabel"),
      modality: form.get("modality"),
      edition: form.get("edition"),
      published: form.get("published") === "on",
      priceAmount:
        String(form.get("priceAmount") ?? "").trim() === ""
          ? null
          : Number(form.get("priceAmount")),
      variants:
        product?.data.course?.variants.map((variant) => ({
          id: variant.id,
          priceAmount: Number(form.get(`variantPrice_${variant.id}`)),
        })) ?? [],
    };

    try {
      const response = await fetch(
        product
          ? `/api/backoffice/products/${encodeURIComponent(product.slug)}`
          : "/api/backoffice/products",
        {
          method: product ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result: unknown = await response.json();
      if (!response.ok) {
        const code =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "";
        throw new Error(
          code === "product_already_exists"
            ? "Já existe um produto com este nome."
            : code === "invalid_product"
              ? "Verifique os campos, preços e use o caminho de uma imagem existente."
              : "Não foi possível guardar o produto. Tente novamente.",
        );
      }

      const record = parseProductRecord(result);
      if (!record) throw new Error("A resposta do servidor é inválida.");
      onSaved(toDashboardProduct(record));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível guardar o produto.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#211d1e]/45 p-4">
      <section
        aria-labelledby="product-editor-title"
        aria-modal="true"
        className="my-auto w-full max-w-[620px] rounded-[24px] bg-white p-5 shadow-2xl sm:p-7"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#ae7d32]">
              Catálogo Kitadi
            </p>
            <h2 className="mt-2 text-[21px] font-bold text-[#342c2d]" id="product-editor-title">
              {product ? "Editar produto" : "Criar produto"}
            </h2>
          </div>
          <button
            aria-label="Fechar"
            className="flex size-9 items-center justify-center rounded-full bg-[#f6f2f0] text-[#625858]"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <ProductField defaultValue={product?.data.title} label="Nome" name="title" required />
            <ProductField defaultValue={product?.data.shortName} label="Nome curto" name="shortName" required />
            <ProductField defaultValue={product?.data.category} label="Categoria" name="category" required />
            <ProductField defaultValue={product?.data.modality} label="Modalidade" name="modality" required />
            <ProductField defaultValue={product?.data.statusLabel} label="Etiqueta" name="statusLabel" required />
            <ProductField defaultValue={product?.data.edition} label="Edição (opcional)" name="edition" />
            <ProductField defaultValue={product?.data.image} label="Imagem (caminho em /public)" name="image" required />
          </div>
          <ProductPriceField
            defaultValue={
              product?.data.course?.priceAmount ??
              product?.data.priceAmount ??
              ""
            }
            label={
              product?.data.course
                ? "Preço base (Kz)"
                : "Preço (Kz, opcional)"
            }
            name="priceAmount"
            required={Boolean(product?.data.course)}
          />
          {product?.data.course?.variants.length ? (
            <fieldset className="rounded-2xl border border-[#eee8e5] p-4">
              <legend className="px-1 text-[11px] font-semibold text-[#5e5552]">
                Preços por variante (Kz)
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {product.data.course.variants.map((variant) => (
                  <ProductPriceField
                    defaultValue={variant.priceAmount}
                    key={variant.id}
                    label={variant.label}
                    name={`variantPrice_${variant.id}`}
                    required
                  />
                ))}
              </div>
              <p className="mt-3 text-[10px] leading-5 text-[#918783]">
                O checkout cobra o preço da variante escolhida. O preço base é
                usado como valor de referência na página do produto.
              </p>
            </fieldset>
          ) : null}
          <label className="block text-[11px] font-semibold text-[#5e5552]">
            Frase de destaque
            <textarea
              className="mt-1.5 min-h-20 w-full rounded-xl border border-[#e9e3e0] px-3 py-2.5 text-[12px] font-normal outline-none focus:border-[#ae7d32]"
              defaultValue={product?.data.tagline}
              maxLength={300}
              name="tagline"
              required
            />
          </label>
          <label className="flex items-center gap-2 text-[11px] text-[#5e5552]">
            <input
              defaultChecked={product?.published ?? true}
              className="size-4 accent-[#510f1d]"
              name="published"
              type="checkbox"
            />
            Publicar este produto na landing page
          </label>
          <p className="text-[10px] leading-5 text-[#918783]">
            Produtos novos ficam disponíveis para contacto via WhatsApp. Para a imagem, use um caminho como /produtos/imagem.png e coloque o ficheiro na pasta public. Preços em Kz, sem separadores.
          </p>
          {error ? (
            <p className="rounded-xl bg-[#fff1f0] px-3 py-2 text-[11px] text-[#a43832]" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <button
              className="min-h-10 rounded-full border border-[#e9e3e0] px-4 text-[11px] font-semibold text-[#615856]"
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="min-h-10 rounded-full bg-[#510f1d] px-5 text-[11px] font-semibold text-white disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              {saving ? "A guardar…" : "Guardar produto"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ProductField({
  label,
  name,
  defaultValue,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-[11px] font-semibold text-[#5e5552]">
      {label}
      <input
        className="mt-1.5 min-h-10 w-full rounded-xl border border-[#e9e3e0] px-3 text-[12px] font-normal outline-none focus:border-[#ae7d32]"
        defaultValue={defaultValue ?? ""}
        maxLength={160}
        name={name}
        required={required}
      />
    </label>
  );
}

function ProductPriceField({
  label,
  name,
  defaultValue,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue: number | string;
  required?: boolean;
}) {
  return (
    <label className="block text-[11px] font-semibold text-[#5e5552]">
      {label}
      <input
        className="mt-1.5 min-h-10 w-full rounded-xl border border-[#e9e3e0] px-3 text-[12px] font-normal outline-none focus:border-[#ae7d32]"
        defaultValue={defaultValue}
        max={2_000_000_000}
        min={0}
        name={name}
        required={required}
        step={1}
        type="number"
      />
    </label>
  );
}

function parseProductRecord(value: unknown): ProductRecord | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("slug" in value) ||
    typeof value.slug !== "string" ||
    !("data" in value) ||
    typeof value.data !== "object" ||
    value.data === null ||
    !("published" in value) ||
    typeof value.published !== "boolean" ||
    !("sort_order" in value) ||
    typeof value.sort_order !== "number"
  ) {
    return null;
  }
  return value as ProductRecord;
}

function Team({ email, role }: { email: string; role: BackofficeRole }) {
  const [data, setData] = useState<TeamData | null>(null);
  const [error, setError] = useState("");

  const loadTeam = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/backoffice/team", { cache: "no-store" });
      const result: unknown = await response.json();
      if (!response.ok || !isTeamData(result)) throw new Error("Não foi possível carregar a equipa.");
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar a equipa.");
    }
  }, []);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  return (
    <>
      <PageIntro eyebrow="Administração" title="Equipa e acessos" description="Convide pessoas, atribua funções e limite a gestão às áreas correspondentes." />
      {error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p> : null}
      {!data && !error ? <p className="mt-5 text-sm text-[#817773]">A carregar equipa…</p> : null}
      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <section className="rounded-[22px] border border-[#eee9e6] bg-white p-5 sm:p-7">
          <SectionHeading title="Acesso ao back office" subtitle="Os convites geram um link de uso único, sem envio de e-mail." />
          {data ? <InviteAdminForm areas={data.areas.filter((area) => area.active)} onInvited={loadTeam} role={role === "admin" ? "admin" : "manager"} /> : null}
        </section>
        <section className="rounded-[22px] border border-[#eee9e6] bg-white p-5 sm:p-7">
          <SectionHeading title="Áreas e colaboradores" subtitle="Crie áreas e atribua-as às pessoas para organizar o acesso aos objectivos." />
          {role === "admin" ? <TeamAreaManager areas={data?.areas ?? []} onSaved={loadTeam} /> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {data?.areas.map((area) => (
              <span className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${area.active ? "bg-[#edf4ee] text-[#52765e]" : "bg-[#f3efed] text-[#847a76]"}`} key={area.id}>
                {area.name}{area.active ? "" : " · inactiva"}
              </span>
            ))}
            {data?.areas.length === 0 ? <p className="text-xs text-[#8d837f]">Ainda não há áreas.</p> : null}
          </div>
        </section>
        <section className="rounded-[22px] border border-[#eee9e6] bg-white p-5 sm:p-7 xl:col-span-2">
          <SectionHeading title="Pessoas e permissões" subtitle="Administradores controlam funções e áreas; gestores só atribuem pessoas às próprias áreas." />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {data?.users.map((user) => (
              <TeamMemberEditor
                areas={data.areas}
                currentEmail={email}
                key={user.id}
                memberships={data.memberships.filter((membership) => membership.user_id === user.id)}
                onSaved={loadTeam}
                role={data.role}
                user={user}
              />
            ))}
            {data?.users.length === 0 ? <p className="text-xs text-[#8d837f]">Ainda não há pessoas atribuídas às áreas visíveis.</p> : null}
          </div>
        </section>
        <section className="rounded-[22px] border border-[#eee9e6] bg-white p-5 sm:p-7">
          <SectionHeading title="Sessão actual" />
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[#faf8f7] p-4">
            <span className="flex size-10 items-center justify-center rounded-full bg-[#f0e5e2] text-[12px] font-bold text-[#652636]">{initials(email)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-bold text-[#3a3233]">{email}</p>
              <p className="mt-1 text-[10px] text-[#928884]">Sessão activa</p>
            </div>
            <span className="size-2 rounded-full bg-[#66836c]" />
          </div>
          <div className="mt-5 border-t border-[#f0ecea] pt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#a69c98]">Sessão</p>
            <div className="mt-3">
              <SignOutButton />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function TeamAreaManager({
  areas,
  onSaved,
}: {
  areas: TeamData["areas"];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/backoffice/objective-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const code = typeof result === "object" && result !== null && "error" in result
          ? result.error
          : null;
        throw new Error(code === "area_already_exists"
          ? "Já existe uma área com esse nome."
          : "Não foi possível criar a área.");
      }
      setName("");
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a área.");
    } finally {
      setSaving(false);
    }
  }

  async function saveArea(area: TeamData["areas"][number], form: HTMLFormElement) {
    setSaving(true);
    setError("");
    const formData = new FormData(form);
    try {
      const response = await fetch(`/api/backoffice/objective-areas/${encodeURIComponent(area.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          active: formData.get("active") === "on",
        }),
      });
      if (!response.ok) throw new Error("Não foi possível actualizar a área.");
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível actualizar a área.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4">
      <form onSubmit={submit}>
        <label className="block text-[10px] font-semibold text-[#817773]">
          Criar nova área
          <span className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              className="min-h-10 flex-1 rounded-xl border border-[#ded7d4] px-3 text-xs font-normal text-[#302829]"
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Comercial, Finanças"
              required
              value={name}
            />
            <button
              className="min-h-10 rounded-full bg-[#510f1d] px-4 text-[10px] font-semibold text-white disabled:opacity-50"
              disabled={saving}
              type="submit"
            >
              {saving ? "A guardar…" : "Criar área"}
            </button>
          </span>
        </label>
      </form>
      {areas.length > 0 ? (
        <div className="mt-3 divide-y divide-[#f1edeb]">
          {areas.map((area) => (
            <form
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center"
              key={area.id}
              onSubmit={(event) => {
                event.preventDefault();
                void saveArea(area, event.currentTarget);
              }}
            >
              <input
                className="min-h-9 flex-1 rounded-lg border border-[#e9e3e0] px-3 text-[11px]"
                defaultValue={area.name}
                maxLength={120}
                name="name"
                required
              />
              <label className="flex items-center gap-2 text-[10px] text-[#766d69]">
                <input defaultChecked={area.active} name="active" type="checkbox" />
                Activa
              </label>
              <button
                className="min-h-9 rounded-full border border-[#e9e3e0] px-4 text-[10px] font-semibold text-[#6d605b] disabled:opacity-50"
                disabled={saving}
                type="submit"
              >
                Guardar
              </button>
            </form>
          ))}
        </div>
      ) : <p className="mt-3 text-[10px] text-[#8d837f]">Ainda não há áreas.</p>}
      {error ? <p className="mt-2 text-[10px] text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}

type TeamData = {
  users: { id: string; email: string; role: string }[];
  areas: { id: string; name: string; active: boolean }[];
  memberships: { area_id: string; user_id: string }[];
  role: BackofficeRole;
};

function isTeamData(value: unknown): value is TeamData {
  return typeof value === "object" && value !== null &&
    "users" in value && Array.isArray(value.users) &&
    "areas" in value && Array.isArray(value.areas) &&
    "memberships" in value && Array.isArray(value.memberships) &&
    "role" in value && ["admin", "manager", "collaborator"].includes(String(value.role));
}

function TeamMemberEditor({
  user,
  areas,
  memberships,
  role,
  currentEmail,
  onSaved,
}: {
  user: TeamData["users"][number];
  areas: TeamData["areas"];
  memberships: TeamData["memberships"];
  role: BackofficeRole;
  currentEmail: string;
  onSaved: () => void;
}) {
  const [selectedRole, setSelectedRole] = useState(
    ["admin", "manager", "collaborator"].includes(user.role) ? user.role : "none",
  );
  const [areaIds, setAreaIds] = useState(memberships.map((membership) => membership.area_id));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/backoffice/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          ...(role === "admin" ? { role: selectedRole } : {}),
          areaIds,
        }),
      });
      if (!response.ok) throw new Error("Não foi possível actualizar o acesso desta pessoa.");
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível actualizar o acesso.");
    } finally {
      setSaving(false);
    }
  }

  async function revokeAccess() {
    if (!window.confirm(`Revogar o acesso ao backoffice de ${user.email}? A conta e o histórico serão mantidos.`)) {
      return;
    }
    setRevoking(true);
    setError("");
    try {
      const response = await fetch("/api/backoffice/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role: "none", areaIds: [] }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const code = isObjectRecord(result) && typeof result.error === "string" ? result.error : "";
        throw new Error(
          code === "cannot_revoke_last_admin"
            ? "Não é possível remover o último administrador."
            : code === "cannot_revoke_self"
              ? "Não pode remover o seu próprio acesso."
              : "Não foi possível revogar o acesso desta pessoa.",
        );
      }
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível revogar o acesso.");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <article className="rounded-2xl border border-[#eee9e6] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all text-xs font-bold text-[#3a3233]">{user.email || "Sem e-mail"}</p>
          <p className="mt-1 text-[9px] text-[#928884]">Função: {user.role}</p>
        </div>
        {role === "admin" ? (
          <select aria-label={`Função de ${user.email}`} className="min-h-9 rounded-lg border border-[#e9e3e0] bg-white px-2 text-[10px]" onChange={(event) => setSelectedRole(event.target.value)} value={selectedRole}>
            {user.role === "none" ? <option disabled value="none">Sem acesso</option> : null}
            <option value="collaborator">Colaborador</option>
            <option value="manager">Gestor</option>
            <option value="admin">Administrador</option>
          </select>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {areas.map((area) => (
          <label className="flex items-center gap-1.5 text-[10px] text-[#766d69]" key={area.id}>
            <input
              checked={areaIds.includes(area.id)}
              onChange={(event) => setAreaIds((current) =>
                event.target.checked
                  ? [...current, area.id]
                  : current.filter((id) => id !== area.id),
              )}
              type="checkbox"
            />
            {area.name}
          </label>
        ))}
        {areas.length === 0 ? <span className="text-[10px] text-[#928884]">Sem áreas atribuídas para gerir.</span> : null}
      </div>
      {error ? <p className="mt-2 text-[10px] text-red-700" role="alert">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="min-h-8 rounded-full border border-[#e9e3e0] px-4 text-[10px] font-semibold text-[#6d605b] disabled:opacity-50" disabled={saving || revoking} onClick={() => void save()} type="button">
          {saving ? "A guardar…" : "Guardar acessos"}
        </button>
        {role === "admin" &&
        user.role !== "none" &&
        user.email.toLowerCase() !== currentEmail.toLowerCase() ? (
          <button
            className="min-h-8 rounded-full border border-red-200 px-4 text-[10px] font-semibold text-red-700 disabled:opacity-50"
            disabled={saving || revoking}
            onClick={() => void revokeAccess()}
            type="button"
          >
            {revoking ? "A revogar…" : "Remover do backoffice"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function MetricCard({
  metric,
}: {
  metric: {
    label: string;
    value: string;
    change: string;
    note: string;
    icon: string;
    tone: string;
  };
}) {
  return (
    <article className="rounded-[20px] border border-[#eee9e6] bg-white p-5">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold text-[#8e8581]">{metric.label}</p>
        <span className={`flex size-9 items-center justify-center rounded-xl ${metricBackground(metric.tone)} ${metricForeground(metric.tone)}`}>
          <Icon name={metric.icon} />
        </span>
      </div>
      <p className="mt-4 text-[22px] font-bold leading-none tracking-[-0.035em] text-[#302829]">{metric.value}</p>
      <div className="mt-3 flex items-center gap-1.5 text-[10px]">
        <span className={`font-bold ${metric.tone === "orange" ? "text-[#ae7d32]" : "text-[#66836c]"}`}>{metric.change}</span>
        <span className="text-[#a19894]">{metric.note}</span>
      </div>
    </article>
  );
}

function RevenueChart({ revenue }: { revenue: WeeklyPaymentRevenue[] | null }) {
  const maximum = Math.max(1, ...(revenue ?? []).flatMap((day) => [day.current, day.previous]));
  const chartDays = revenue ?? [];
  return (
    <div className="mt-7">
      <div className="relative flex h-[190px] items-end justify-between gap-2 border-b border-[#f0ece9] px-1 sm:gap-4">
        {[0, 1, 2, 3].map((line) => (
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[#f0ece9]" key={line} style={{ bottom: `${25 + line * 20}%` }} />
        ))}
        {chartDays.map((day) => (
          <div className="relative z-[1] flex h-full flex-1 items-end justify-center gap-1.5 pb-0.5" key={day.day}>
            <div className="w-[30%] max-w-7 rounded-t-md bg-[#e9dfdb]" style={{ height: `${day.previous ? Math.max(3, (day.previous / maximum) * 100) : 0}%` }} title={`Semana anterior: ${formatKz(day.previous)}`} />
            <div className="w-[30%] max-w-7 rounded-t-md bg-[#641d2d] transition-opacity hover:opacity-80" style={{ height: `${day.current ? Math.max(3, (day.current / maximum) * 100) : 0}%` }} title={`Esta semana: ${formatKz(day.current)}`} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between px-1">
        {chartDays.map((day) => <span className="flex-1 text-center text-[9px] text-[#a69d99]" key={day.day}>{day.day}</span>)}
      </div>
      <p className="mt-5 text-[10px] text-[#a49a96]">
        {revenue
          ? "Valores calculados a partir dos pagamentos confirmados no registo."
          : "Aplique a migração de pagamentos para consultar a receita."}
      </p>
    </div>
  );
}

function PaymentTable({
  orders,
  paymentsReady,
  compact = false,
}: {
  orders: KitadiOrder[];
  paymentsReady: boolean;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = orders.filter((order) => {
    const matchesQuery =
      !normalizedQuery ||
      [
        order.reference,
        order.name,
        order.email,
        order.phone,
        order.productTitle,
        order.variantLabel,
        order.providerTransactionId ?? "",
        order.paymentMethod ?? "",
        order.reason ?? "",
      ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const method = paymentMethodLabel(order.paymentMethod);
    const matchesMethod = methodFilter === "all" || method === methodFilter;
    const ageDays = (Date.now() - new Date(order.createdAt).getTime()) / 86_400_000;
    const matchesPeriod =
      periodFilter === "all" ||
      ageDays <= Number(periodFilter);
    return matchesQuery && matchesStatus && matchesMethod && matchesPeriod;
  });
  const rows = compact ? filtered.slice(0, 4) : filtered;

  return (
    <div className="mt-4">
      {!compact ? (
        <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_170px_170px_170px]">
          <input
            aria-label="Pesquisar pagamentos"
            className="min-h-10 rounded-xl border border-[#e9e3e0] px-3 text-[11px] outline-none focus:border-[#ae7d32]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar referência, cliente ou produto"
            value={query}
          />
          <select
            aria-label="Filtrar por estado"
            className="min-h-10 rounded-xl border border-[#e9e3e0] bg-white px-3 text-[11px] outline-none focus:border-[#ae7d32]"
            onChange={(event) => setStatusFilter(event.target.value)}
            value={statusFilter}
          >
            <option value="all">Todos os estados</option>
            <option value="accepted">Concluídos</option>
            <option value="pending">Pendentes</option>
            <option value="rejected">Falhados</option>
            <option value="expired">Expirados</option>
            <option value="canceled">Cancelados</option>
            <option value="refunded">Reembolsados</option>
          </select>
          <select
            aria-label="Filtrar por método de pagamento"
            className="min-h-10 rounded-xl border border-[#e9e3e0] bg-white px-3 text-[11px] outline-none focus:border-[#ae7d32]"
            onChange={(event) => setMethodFilter(event.target.value)}
            value={methodFilter}
          >
            <option value="all">Todos os métodos</option>
            {[...new Set(orders.map((order) => paymentMethodLabel(order.paymentMethod)))].map((method) => (
              <option key={method} value={method}>{method}</option>
            ))}
          </select>
          <select
            aria-label="Filtrar por período"
            className="min-h-10 rounded-xl border border-[#e9e3e0] bg-white px-3 text-[11px] outline-none focus:border-[#ae7d32]"
            onChange={(event) => setPeriodFilter(event.target.value)}
            value={periodFilter}
          >
            <option value="all">Todo o período</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Último ano</option>
          </select>
        </div>
      ) : null}
      <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left">
        <thead>
          <tr className="border-b border-[#f0ecea] text-[9px] font-bold uppercase tracking-[0.1em] text-[#a39995]">
            <th className="py-3 pr-4">Referência / cliente</th>
            <th className="py-3 pr-4">Produto / variante</th>
            <th className="py-3 pr-4">Método</th>
            <th className="py-3 pr-4">Data</th>
            <th className="py-3 pr-4">Valor</th>
            <th className="py-3">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f2eeec]">
          {rows.map((order) => (
            <tr className="align-top text-[10px]" key={order.reference}>
              <td className="py-3.5 pr-4">
                <p className="font-bold text-[#4a4141]">{order.name}</p>
                <p className="mt-1 text-[9px] text-[#766d69]">{order.email}</p>
                <p className="mt-0.5 text-[9px] text-[#a19894]">{order.phone}</p>
                <p className="mt-1.5 font-semibold text-[#8b5b39]">{order.reference}</p>
                {order.providerTransactionId ? (
                  <p className="mt-0.5 text-[9px] text-[#a19894]">WiPay: {order.providerTransactionId}</p>
                ) : null}
              </td>
              <td className="py-3.5 pr-4">
                <p className="font-semibold text-[#4a4141]">{order.productTitle}</p>
                <p className="mt-1 text-[9px] text-[#968c88]">{order.variantLabel}</p>
              </td>
              <td className="py-3.5 pr-4 text-[#726966]">
                <p>{paymentMethodLabel(order.paymentMethod)}</p>
                <p className="mt-1 text-[9px] text-[#a19894]">{order.paymentProvider.toUpperCase()}</p>
              </td>
              <td className="py-3.5 pr-4 text-[#968c88]">
                <p>{formatPaymentDate(order.createdAt)}</p>
                {order.paidAt ? <p className="mt-1 text-[9px] text-[#52765e]">Pago {formatPaymentDate(order.paidAt)}</p> : null}
              </td>
              <td className="py-3.5 pr-4 font-semibold text-[#554b4b]">{formatKz(order.amountKz)}</td>
              <td className="py-3.5">
                <StatusBadge status={paymentStatusLabel(order.status)} />
                {order.reason ? <p className="mt-1.5 max-w-48 text-[9px] leading-4 text-[#a43832]">{order.reason}</p> : null}
                {order.providerStatus ? <p className="mt-1 text-[9px] text-[#a19894]">WiPay: {order.providerStatus}</p> : null}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="py-8 text-center text-[11px] text-[#968c88]" colSpan={6}>
                {paymentsReady
                  ? orders.length
                    ? "Nenhum pagamento corresponde aos filtros."
                    : "Ainda não existem pagamentos registados."
                  : "Aplique a migração da tabela de pagamentos para consultar as transacções."}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      </div>
      {!compact && orders.length > rows.length && !normalizedQuery && statusFilter === "all" && methodFilter === "all" && periodFilter === "all" ? (
        <p className="mt-3 text-[10px] text-[#968c88]">
          A mostrar as {rows.length} transacções mais recentes. Os totais incluem o histórico completo.
        </p>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = status === "Concluído"
    ? "bg-[#edf4ee] text-[#52765e]"
    : status === "Pendente"
      ? "bg-[#fbf2df] text-[#9a702c]"
      : status === "Falhado" || status === "Expirado" || status === "Cancelado"
        ? "bg-[#fff1f0] text-[#a43832]"
      : "bg-[#f1edeb] text-[#786e6b]";
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-bold ${style}`}>{status}</span>;
}

function paymentStatusLabel(status: KitadiOrder["status"]) {
  const labels: Record<KitadiOrder["status"], string> = {
    pending: "Pendente",
    accepted: "Concluído",
    rejected: "Falhado",
    expired: "Expirado",
    canceled: "Cancelado",
    refunded: "Reembolsado",
  };
  return labels[status];
}

function paymentMethodLabel(method: string | null) {
  if (!method) return "A aguardar método";
  const normalized = method.toLocaleLowerCase();
  if (normalized.includes("express")) return "Express";
  if (normalized.includes("reference") || normalized.includes("referência")) return "Referência";
  if (normalized.includes("card") || normalized.includes("cartão")) return "Cartão";
  return method.replaceAll("_", " ");
}

function formatPaymentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Luanda",
  });
}

function formatKz(value: number) {
  return `${new Intl.NumberFormat("pt-PT", {
    maximumFractionDigits: 0,
  }).format(value)} Kz`;
}

function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#a8792f]">{eyebrow}</p>
      <h2 className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-[#302829] sm:text-[34px]">{title}</h2>
      <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#837a76]">{description}</p>
    </div>
  );
}

function SimpleStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[18px] border border-[#eee9e6] bg-white p-5">
      <p className="text-[11px] font-semibold text-[#918783]">{label}</p>
      <p className="mt-3 text-[20px] font-bold tracking-[-0.03em] text-[#342c2d]">{value}</p>
      <p className="mt-1.5 text-[10px] text-[#a09793]">{note}</p>
    </div>
  );
}

function SectionHeading({ title, subtitle, action, onAction }: { title: string; subtitle?: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[13px] font-bold text-[#352d2e]">{title}</h3>
        {subtitle ? <p className="mt-1 text-[10px] leading-5 text-[#9b918d]">{subtitle}</p> : null}
      </div>
      {action && onAction ? (
        <button className="shrink-0 text-[10px] font-bold text-[#8a5b38] hover:text-[#510f1d]" onClick={onAction} type="button">
          {action} <span aria-hidden="true">→</span>
        </button>
      ) : null}
    </div>
  );
}

function ProductMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] text-[#a19894] sm:hidden">{label}</p>
      <p className="mt-1 max-w-[150px] truncate text-[10px] font-semibold text-[#655c59] sm:mt-0">{value}</p>
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[12px] font-semibold transition-colors ${
        active ? "bg-[#f5eeeb] text-[#5a1b29]" : "text-[#77706d] hover:bg-[#faf8f7] hover:text-[#392f30]"
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon name={icon} />
      <span className="flex-1">{label}</span>
      {active ? <span className="h-5 w-[3px] rounded-full bg-[#a8792f]" /> : null}
    </button>
  );
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    payments: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18M7 15h3" /></>,
    objectives: <><path d="M5 19V5m0 14h15" /><path d="m8 15 3-4 3 2 5-6" /><circle cx="19" cy="7" r="1" /></>,
    commercial: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6m3-3h-6" /></>,
    funnel: <><path d="M3 4h18l-7 8v6l-4 2v-8L3 4Z" /></>,
    products: <><path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" /></>,
    team: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6m3-3h-6" /></>,
    revenue: <><path d="M4 19V5m0 14h17M8 15l4-4 3 2 6-7" /></>,
    pending: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    leads: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6m3-3h-6" /></>,
    conversion: <><path d="M4 17 10 11l4 4 7-8M15 7h6v6" /></>,
    payment: <><rect x="4" y="6" width="16" height="13" rx="2" /><path d="M4 10h16m-12 5h4" /></>,
    lead: <><path d="M4 5h16v12H8l-4 3V5Z" /><path d="M8 9h8m-8 4h5" /></>,
    booking: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4m8-4v4M4 10h16m-11 5h2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  };
  return (
    <svg aria-hidden="true" className="size-[17px] shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
      {paths[name] ?? paths.overview}
    </svg>
  );
}

function metricBackground(tone: string) {
  return tone === "gold" ? "bg-[#f8f2e7]" : tone === "orange" ? "bg-[#fbf1e7]" : tone === "plum" ? "bg-[#f3ecee]" : "bg-[#edf3ee]";
}

function metricForeground(tone: string) {
  return tone === "gold" ? "text-[#9b732c]" : tone === "orange" ? "text-[#ad703e]" : tone === "plum" ? "text-[#782f43]" : "text-[#52765e]";
}

function toneDot(tone: string) {
  return tone === "plum" ? "bg-[#8c5263]" : tone === "gold" ? "bg-[#c79a48]" : tone === "orange" ? "bg-[#d58b55]" : "bg-[#66836c]";
}

function toneAvatar(tone: string) {
  return tone === "plum" ? "bg-[#f2e8eb] text-[#75404f]" : tone === "gold" ? "bg-[#f8f0df] text-[#8c6a2c]" : tone === "orange" ? "bg-[#fbede2] text-[#a36e45]" : "bg-[#eaf1eb] text-[#57745d]";
}

function initials(email: string) {
  const name = email.includes("@") ? email.split("@")[0] ?? "" : email;
  const parts = name.split(email.includes("@") ? /[._-]/ : /\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase();
}
