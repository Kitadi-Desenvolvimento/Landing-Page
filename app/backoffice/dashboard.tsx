"use client";

import Image from "next/image";
import { useState } from "react";
import InviteAdminForm from "./invite-admin-form";
import SignOutButton from "./sign-out-button";
import {
  dashboardMetrics,
  dashboardNavigation,
  productPerformance,
  salesPipeline,
  websiteFunnel,
  weeklyRevenue,
  type DashboardProduct,
  type DashboardSection,
  toDashboardProduct,
} from "./dashboard-data";
import type { ProductRecord } from "../product-types";
import type { KitadiOrder, PaymentSummary } from "../lib/payments/orders";
import type { FormEvent } from "react";

const sectionTitles: Record<DashboardSection, { title: string; subtitle: string }> = {
  overview: { title: "Visão geral", subtitle: "Uma leitura rápida da actividade da Kitadi." },
  payments: { title: "Pagamentos", subtitle: "Acompanhe os recebimentos e pedidos recentes." },
  commercial: { title: "Área comercial", subtitle: "Oportunidades e acompanhamento de potenciais clientes." },
  funnel: { title: "Funil do site", subtitle: "Do primeiro acesso à conversa e à conversão." },
  products: { title: "Produtos", subtitle: "Desempenho dos programas e experiências da Kitadi." },
  team: { title: "Equipa e acessos", subtitle: "Gestão mockada da equipa e convites de administradores." },
};

const workspaceNavigation = dashboardNavigation.filter((item) => item.group === "workspace");
const manageNavigation = dashboardNavigation.filter((item) => item.group === "manage");

export default function BackofficeDashboard({
  email,
  products,
  catalogReady,
  payments,
  paymentSummary,
  paymentsReady,
}: {
  email: string;
  products: DashboardProduct[];
  catalogReady: boolean;
  payments: KitadiOrder[];
  paymentSummary: PaymentSummary;
  paymentsReady: boolean;
}) {
  const [catalogProducts, setCatalogProducts] = useState(products);
  const [activeSection, setActiveSection] = useState<DashboardSection>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const page = sectionTitles[activeSection];

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
            {workspaceNavigation.map((item) => (
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
            {manageNavigation.map((item) => (
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

        <div className="mt-auto rounded-[20px] bg-[#f8f4ec] p-4">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#66836c]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#5b6d5f]">
              Dados mistos
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-5 text-[#77706c]">
            Pagamentos e catálogo são dados reais. A área comercial e o funil ainda são demonstrativos.
          </p>
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
              Pagamentos reais · restantes dados de demonstração
            </span>
            <span className="flex size-9 items-center justify-center rounded-full bg-[#f1e8e4] text-[12px] font-bold text-[#652636]">
              {initials(email)}
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-[1480px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
          {activeSection === "overview" ? (
            <Overview
              onNavigate={navigate}
              paymentSummary={paymentSummary}
              payments={payments}
              paymentsReady={paymentsReady}
            />
          ) : null}
          {activeSection === "payments" ? (
            <Payments
              paymentSummary={paymentSummary}
              payments={payments}
              paymentsReady={paymentsReady}
            />
          ) : null}
          {activeSection === "commercial" ? <Commercial /> : null}
          {activeSection === "funnel" ? <Funnel /> : null}
          {activeSection === "products" ?           <Products
            catalogReady={catalogReady}
            onProductsChange={setCatalogProducts}
            products={catalogProducts}
          /> : null}
          {activeSection === "team" ? <Team email={email} /> : null}
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
}: {
  onNavigate: (section: DashboardSection) => void;
  payments: KitadiOrder[];
  paymentSummary: PaymentSummary;
  paymentsReady: boolean;
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
              <p className="mt-1 text-[11px] text-[#a19894]">Comparação semanal · dados de demonstração</p>
            </div>
            <div className="flex gap-4 text-[10px] font-semibold text-[#847b77]">
              <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#510f1d]" />Esta semana</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#e8dcd7]" />Anterior</span>
            </div>
          </div>
          <RevenueChart />
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
            {websiteFunnel.slice(0, 4).map((step) => (
              <div key={step.label}>
                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                  <span className="font-medium text-[#6e6561]">{step.label}</span>
                  <span className="font-bold text-[#393132]">{step.value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#f0ece9]">
                  <div className={`h-full rounded-full ${step.color}`} style={{ width: `${step.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
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
          no Supabase para começar a guardar novas transacções.
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

function Commercial() {
  return (
    <>
      <PageIntro eyebrow="Relacionamento" title="Funil comercial" description="Organize cada contacto até à reserva ou compra, com acompanhamento próximo." />
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          ["24", "oportunidades abertas"],
          ["6", "convertidas"],
          ["485.000 Kz", "em negociação"],
        ].map(([value, label]) => (
          <span className="rounded-xl border border-[#ece6e2] bg-white px-4 py-2.5 text-[11px] text-[#776e6a]" key={label}>
            <strong className="mr-1.5 text-[#352d2e]">{value}</strong>{label}
          </span>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-4">
        {salesPipeline.map((stage) => (
          <section className="min-w-0 rounded-[20px] border border-[#eee9e6] bg-[#f1eeec] p-3" key={stage.stage}>
            <div className="flex items-center justify-between px-1 pb-3 pt-1">
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${toneDot(stage.tone)}`} />
                <h3 className="text-[12px] font-bold text-[#393132]">{stage.stage}</h3>
                <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#857b77]">{stage.count}</span>
              </div>
              <button aria-label={`Opções: ${stage.stage}`} className="text-[#9c928e]" type="button">···</button>
            </div>
            <p className="mb-3 px-1 text-[10px] text-[#968c88]">Valor potencial · {stage.total}</p>
            <div className="space-y-3">
              {stage.deals.map((deal) => (
                <article className="rounded-[15px] border border-[#ebe5e2] bg-white p-3.5 shadow-[0_3px_10px_rgba(47,32,28,0.025)]" key={deal.name}>
                  <div className="flex items-center gap-2.5">
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${toneAvatar(stage.tone)}`}>{deal.initials}</span>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold text-[#3d3435]">{deal.name}</p>
                      <p className="mt-0.5 truncate text-[10px] text-[#998f8b]">{deal.product}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#f2eeec] pt-2.5">
                    <span className="truncate text-[9px] text-[#a39995]">{deal.source}</span>
                    <span className="shrink-0 text-[10px] font-bold text-[#62514c]">{deal.value}</span>
                  </div>
                </article>
              ))}
              <button className="w-full rounded-xl border border-dashed border-[#d6cbc6] py-2 text-[10px] font-semibold text-[#938783]" type="button">
                + Adicionar contacto
              </button>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function Funnel() {
  return (
    <>
      <PageIntro eyebrow="Aquisição e conversão" title="Funil do site" description="Uma visão mockada do percurso desde a visita até à compra ou reserva." />
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <SimpleStat label="Visitantes únicos" value="3.240" note="+18,2% vs. período anterior" />
        <SimpleStat label="Contactos gerados" value="126" note="WhatsApp e formulários" />
        <SimpleStat label="Conversão geral" value="4,8%" note="+0,6 pp no período" />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <section className="rounded-[22px] border border-[#eee9e6] bg-white p-5 sm:p-7">
          <SectionHeading title="Percurso de conversão" subtitle="Volume ilustrativo por etapa · últimos 30 dias" />
          <div className="mt-7 space-y-5">
            {websiteFunnel.map((step, index) => (
              <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3" key={step.label}>
                <div className="flex flex-col items-center">
                  <span className={`flex size-7 items-center justify-center rounded-full text-[10px] font-bold ${index === 4 ? "bg-[#e9f0e9] text-[#52765e]" : "bg-[#f4eeeb] text-[#75404a]"}`}>{index + 1}</span>
                  {index < websiteFunnel.length - 1 ? <span className="mt-1 min-h-8 w-px flex-1 bg-[#e9e2de]" /> : null}
                </div>
                <div className="pb-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[12px] font-bold text-[#393132]">{step.label}</span>
                    <span className="text-[15px] font-bold text-[#393132]">{step.value}</span>
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
          <SectionHeading title="Origem dos contactos" subtitle="Distribuição mockada por canal" />
          <div className="mt-6 space-y-5">
            {[
              { label: "WhatsApp", value: 44, count: 55, color: "bg-[#66836c]" },
              { label: "Formulário do site", value: 27, count: 34, color: "bg-[#510f1d]" },
              { label: "Instagram", value: 18, count: 23, color: "bg-[#ae7d32]" },
              { label: "Referência", value: 11, count: 14, color: "bg-[#b9aaa3]" },
            ].map((source) => (
              <div key={source.label}>
                <div className="mb-2 flex justify-between text-[11px]">
                  <span className="font-medium text-[#635a57]">{source.label}</span>
                  <span className="text-[#918783]">{source.count} <b className="ml-1 text-[#403738]">{source.value}%</b></span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#f0ece9]">
                  <div className={`h-full rounded-full ${source.color}`} style={{ width: `${source.value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-7 rounded-2xl bg-[#f8f4ec] p-4">
            <p className="text-[11px] font-bold text-[#6a4b20]">Oportunidade</p>
            <p className="mt-1.5 text-[11px] leading-5 text-[#80746b]">
              Acompanhar os cliques de WhatsApp por produto ajudará a identificar que oferta gera mais conversas.
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
}: {
  products: DashboardProduct[];
  onProductsChange: (products: DashboardProduct[]) => void;
  catalogReady: boolean;
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

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageIntro eyebrow="Catálogo Kitadi" title="Produtos" description="Gerencie os produtos publicados na landing page. Os indicadores continuam demonstrativos." />
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
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <SimpleStat label="Produtos no catálogo" value={String(products.length).padStart(2, "0")} note="programas e experiências" />
        <SimpleStat label="Visualizações" value="1.937" note="total ilustrativo" />
        <SimpleStat label="Leads gerados" value="131" note="nos últimos 30 dias" />
      </div>
      <section className="mt-5 overflow-hidden rounded-[22px] border border-[#eee9e6] bg-white">
        <div className="flex flex-col justify-between gap-2 border-b border-[#f0ecea] px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h3 className="text-[14px] font-bold text-[#342c2d]">Catálogo e desempenho</h3>
            <p className="mt-1 text-[11px] text-[#9b918d]">Os resultados apresentados são demonstrativos.</p>
          </div>
          <span className="w-fit rounded-full bg-[#f6f1e6] px-3 py-1.5 text-[10px] font-bold text-[#8d692c]">Sincronizado com a landing</span>
        </div>
        <div className="hidden grid-cols-[minmax(210px,1.4fr)_repeat(4,minmax(80px,0.6fr))] border-b border-[#f0ecea] bg-[#fcfbfa] px-6 py-3 sm:grid">
          {["Produto", "Preço", "Visualizações", "Contactos", "Vendas / receita"].map((label) => (
            <p className="text-[9px] font-bold uppercase tracking-[0.09em] text-[#a39995]" key={label}>{label}</p>
          ))}
        </div>
        <div className="divide-y divide-[#f1edeb]">
          {products.map((product) => {
            const performance = productPerformance[product.slug];
            return (
              <article className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(210px,1.4fr)_repeat(4,minmax(80px,0.6fr))] sm:items-center sm:px-6" key={product.slug}>
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
                <ProductMetric label="Visualizações" value={performance?.views ?? "—"} />
                <ProductMetric label="Contactos" value={String(performance?.leads ?? 0)} />
                <ProductMetric label="Vendas / receita" value={`${performance?.sales ?? 0} · ${performance?.revenue ?? "—"}`} />
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

function Team({ email }: { email: string }) {
  return (
    <>
      <PageIntro eyebrow="Administração" title="Equipa e acessos" description="Convide administradores. O controlo de permissões e os dados da equipa são mockados nesta fase." />
      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <section className="rounded-[22px] border border-[#eee9e6] bg-white p-5 sm:p-7">
          <SectionHeading title="Acesso ao back office" subtitle="Os convites geram um link de uso único, sem envio de e-mail." />
          <InviteAdminForm />
        </section>
        <section className="rounded-[22px] border border-[#eee9e6] bg-white p-5 sm:p-7">
          <SectionHeading title="Sessão actual" />
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[#faf8f7] p-4">
            <span className="flex size-10 items-center justify-center rounded-full bg-[#f0e5e2] text-[12px] font-bold text-[#652636]">{initials(email)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-bold text-[#3a3233]">{email}</p>
              <p className="mt-1 text-[10px] text-[#928884]">Administrador · sessão activa</p>
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

function RevenueChart() {
  return (
    <div className="mt-7">
      <div className="relative flex h-[190px] items-end justify-between gap-2 border-b border-[#f0ece9] px-1 sm:gap-4">
        {[0, 1, 2, 3].map((line) => (
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[#f0ece9]" key={line} style={{ bottom: `${25 + line * 20}%` }} />
        ))}
        {weeklyRevenue.map((day) => (
          <div className="relative z-[1] flex h-full flex-1 items-end justify-center gap-1.5 pb-0.5" key={day.day}>
            <div className="w-[30%] max-w-7 rounded-t-md bg-[#e9dfdb]" style={{ height: `${day.previous}%` }} />
            <div className="w-[30%] max-w-7 rounded-t-md bg-[#641d2d] transition-opacity hover:opacity-80" style={{ height: `${day.current}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between px-1">
        {weeklyRevenue.map((day) => <span className="flex-1 text-center text-[9px] text-[#a69d99]" key={day.day}>{day.day}</span>)}
      </div>
      <p className="mt-5 text-[10px] text-[#a49a96]">Comparação semanal ilustrativa. Os valores e transacções reais estão na secção Pagamentos.</p>
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
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase();
}
