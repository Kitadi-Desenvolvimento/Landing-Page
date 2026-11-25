"use client";

import { useEffect, useState } from "react";
import { messageForApiError } from "../lib/api-error-messages";
import { personInitials, personLabel } from "../lib/person-label";
import type { DashboardSection } from "./dashboard-data";

type ActivityDomain = "objectives" | "commercial" | "payments";

type ActivityEvent = {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  domain: ActivityDomain;
  verb: string;
  subject: string;
};

type CommandData = {
  fromDate: string;
  toDate: string;
  metrics: {
    revenue: string;
    revenueNote: string;
    pipeline: string;
    pipelineNote: string;
    attention: string;
    attentionNote: string;
  };
  revenueSeries: { label: string; amount: number }[];
  actions: { id: string; section: DashboardSection; title: string; detail: string; tone: "block" | "risk" }[];
  actionCounts: { objectives: number; commercial: number; payments: number };
  notices: { id: string; personName: string; title: string; contactName: string; stageLabel: string; days: number; next: string }[];
  noticeCount: number;
  noticesReady: boolean;
  sentences: string[];
  performance: { id: string; name: string; objectives: number; commercial: number; payments: number; total: number }[];
  activity: ActivityEvent[];
  objectiveStats: { total: number; behind: number; silent: number; blocked: number };
  objectiveMix: { label: string; count: number }[];
  progressBands: { label: string; count: number }[];
  commercialStats: { open: number; converted: number; lost: number; overdue: number; proposals: number };
  objectives: { id: string; title: string; detail: string; progress: number | null; status: string }[];
  objectiveTotal: number;
  funnel: { stage: string; label: string; count: number; amount: string; amountValue: number }[];
  payments: {
    acceptedKz: string;
    pendingKz: string;
    acceptedAmount: number;
    pendingAmount: number;
    acceptedCount: number;
    pendingCount: number;
    unreconciledCount: number;
    unreconciledKz: string;
    breakdown: { status: string; label: string; count: number; amount: string; amountValue: number }[];
    resultKz: string | null;
  };
  people: { id: string; email: string; displayName: string }[];
  products: { slug: string; title: string }[];
};

const periods = [
  { id: "day", label: "Hoje" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mês" },
  { id: "year", label: "Ano" },
] as const;

const tabs = [
  { id: "objectives", label: "Objectivos" },
  { id: "commercial", label: "Comercial" },
  { id: "payments", label: "Pagamentos" },
  { id: "other", label: "Outros" },
] as const;

type DashboardTab = (typeof tabs)[number]["id"];

const domainLabel: Record<ActivityDomain, string> = {
  objectives: "Objectivo",
  commercial: "Comercial",
  payments: "Pagamento",
};

const domainTone: Record<ActivityDomain, string> = {
  objectives: "bg-[#f8f1e4] text-[#8a6232]",
  commercial: "bg-[#f3eef2] text-[#6e4b71]",
  payments: "bg-[#f6ecee] text-[#8d3d4a]",
};

function rangeLabel(fromDate: string, toDate: string) {
  const end = new Date(`${toDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  const format = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${format.format(new Date(`${fromDate}T00:00:00Z`))} – ${format.format(end)}`;
}

function formatKz(value: number) {
  return `${new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(value)} Kz`;
}

const mixColor: Record<string, string> = {
  "No ritmo": "#66836c",
  "Abaixo do ritmo": "#c4a36a",
  "Sem check-in": "#a8792f",
  "Prazo no período": "#7a4e86",
  Bloqueio: "#8d3d4a",
};

function mixInsight(parts: { label: string; count: number }[]) {
  const total = parts.reduce((sum, part) => sum + part.count, 0);
  const onTrack = parts.find((part) => part.label === "No ritmo")?.count ?? 0;
  if (total === 0) return "Ainda não há metas neste recorte.";
  return `${Math.round((onTrack / total) * 100)}% das metas estão no ritmo.`;
}

function funnelInsight(steps: { stage: string; label: string; count: number; amountValue: number }[]) {
  const open = steps.filter((step) => step.stage !== "converted" && step.stage !== "lost");
  const richest = open.reduce((best, step) => step.amountValue > best.amountValue ? step : best, open[0]);
  const closed = steps.filter((step) => step.stage === "converted" || step.stage === "lost");
  const closedCount = closed.reduce((sum, step) => sum + step.count, 0);
  const convertedCount = steps.find((step) => step.stage === "converted")?.count ?? 0;
  if (!richest || richest.amountValue <= 0) {
    return closedCount > 0 ? `${Math.round((convertedCount / closedCount) * 100)}% das oportunidades fechadas converteram.` : "O funil deste recorte ainda não tem valor indicado.";
  }
  const rate = closedCount > 0 ? ` ${Math.round((convertedCount / closedCount) * 100)}% das fechadas converteram.` : "";
  return `O maior valor em aberto está em ${richest.label}.${rate}`;
}

function revenueInsight(series: { label: string; amount: number }[]) {
  const peak = series.reduce((best, point) => point.amount > best.amount ? point : best, series[0]);
  if (!peak || peak.amount <= 0) return "Sem receita aceite neste período.";
  return `O ponto mais alto foi ${peak.label}, com ${formatKz(peak.amount)}.`;
}

function effortParts(rows: { objectives: number; commercial: number; payments: number }[]) {
  const totals = rows.reduce((sum, row) => ({
    objectives: sum.objectives + row.objectives,
    commercial: sum.commercial + row.commercial,
    payments: sum.payments + row.payments,
  }), { objectives: 0, commercial: 0, payments: 0 });
  return [
    { label: "Objectivos", count: totals.objectives, color: "#c4a36a" },
    { label: "Comercial", count: totals.commercial, color: "#7a4e86" },
    { label: "Pagamentos", count: totals.payments, color: "#8d3d4a" },
  ];
}

function effortInsight(rows: { objectives: number; commercial: number; payments: number }[]) {
  const parts = effortParts(rows);
  const top = parts.reduce((best, part) => part.count > best.count ? part : best, parts[0]);
  const total = parts.reduce((sum, part) => sum + part.count, 0);
  if (!top || total === 0) return "Ainda não há acções da equipa neste período.";
  return `${Math.round((top.count / total) * 100)}% das acções foram em ${top.label.toLowerCase()}.`;
}

function activityTime(value: string, period: (typeof periods)[number]["id"]) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: period === "day" ? undefined : "numeric",
    month: period === "day" ? undefined : "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Luanda",
  }).format(new Date(value));
}

export default function CommandDashboard({
  onNavigate,
}: {
  onNavigate: (section: DashboardSection) => void;
}) {
  const [period, setPeriod] = useState<(typeof periods)[number]["id"]>("month");
  const [person, setPerson] = useState("all");
  const [product, setProduct] = useState("all");
  const [stage, setStage] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [objectiveSituation, setObjectiveSituation] = useState("all");
  const [tab, setTab] = useState<DashboardTab>("objectives");
  const [openActors, setOpenActors] = useState<string[]>([]);
  const [data, setData] = useState<CommandData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ period, person, product, stage, paymentStatus, objectiveSituation });
    const controller = new AbortController();
    setLoading(true);
    void fetch(`/api/backoffice/command?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok || typeof result !== "object" || result === null || !("metrics" in result) || !("activity" in result) || !("performance" in result)) {
          const code = typeof result === "object" && result !== null && "error" in result ? result.error : null;
          throw new Error(messageForApiError(code, "Não foi possível carregar o dashboard."));
        }
        setData(result as CommandData);
        setError("");
      })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Não foi possível carregar o dashboard.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [objectiveSituation, paymentStatus, period, person, product, stage]);

  const control = "h-9 rounded-lg border border-[#e7e1dc] bg-white px-3 text-[12px] text-[#302829]";
  const revenueMax = Math.max(1, ...(data?.revenueSeries.map((point) => point.amount) ?? [1]));
  const revenuePeak = data?.revenueSeries.reduce((best, point) => point.amount > best ? point.amount : best, 0) ?? 0;
  const performanceMax = Math.max(1, ...(data?.performance.map((row) => row.total) ?? [1]));
  const objectiveActions = (data?.actions ?? []).filter((action) => action.section === "objectives");
  const commercialActions = (data?.actions ?? []).filter((action) => action.section === "commercial");
  const paymentActions = (data?.actions ?? []).filter((action) => action.section === "payments");
  const activity = (data?.activity ?? []).filter((event) => tab === "other" || event.domain === (tab === "objectives" ? "objectives" : tab === "commercial" ? "commercial" : "payments"));
  const groups = activity.reduce<{ actorId: string; actorName: string; events: ActivityEvent[] }[]>((list, event) => {
    const current = list.find((group) => group.actorId === event.actorId);
    if (current) current.events.push(event);
    else list.push({ actorId: event.actorId, actorName: event.actorName, events: [event] });
    return list;
  }, []);
  const peopleCount = new Set(activity.map((event) => event.actorId)).size;

  return (
    <div className={`space-y-4 transition-opacity ${loading && data ? "opacity-70" : ""}`}>
      <section className="rounded-2xl border border-[#ece7e3] bg-white px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a8792f]">Período</p>
            <p className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-[#2c2424]">{data ? rangeLabel(data.fromDate, data.toDate) : "A preparar"}</p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl bg-[#f6f3f0] p-1" role="group" aria-label="Período">
            {periods.map((item) => (
              <button
                aria-pressed={period === item.id}
                className={`h-9 rounded-lg px-3.5 text-[12px] font-semibold ${period === item.id ? "bg-white text-[#510f1d] shadow-[0_1px_2px_rgba(44,36,36,0.06)]" : "text-[#746b67]"}`}
                key={item.id}
                onClick={() => setPeriod(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#f3eeea] pt-4">
          <select aria-label="Pessoa" className={control} onChange={(event) => setPerson(event.target.value)} value={person}>
            <option value="all">Toda a equipa</option>
            <option value="mine">Os meus</option>
            {(data?.people ?? []).map((item) => (
              <option key={item.id} value={item.id}>{personLabel(item.displayName, item.email)}</option>
            ))}
          </select>
          <select aria-label="Produto" className={control} onChange={(event) => setProduct(event.target.value)} value={product}>
            <option value="all">Todos os produtos</option>
            {(data?.products ?? []).map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}
          </select>
          {loading && data ? <span className="text-[12px] text-[#a39893]">A actualizar</span> : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-1 border-t border-[#f3eeea] pt-4" role="tablist" aria-label="Assuntos">
          {tabs.map((item) => {
            const count = item.id === "objectives"
              ? Number(data?.metrics.attention ?? 0)
              : item.id === "commercial"
                ? data?.noticeCount ?? 0
                : item.id === "payments"
                  ? data?.payments.unreconciledCount ?? 0
                  : 0;
            return (
              <button
                aria-selected={tab === item.id}
                className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold ${tab === item.id ? "bg-[#510f1d] text-white" : "text-[#746b67] hover:bg-[#f6f3f0]"}`}
                key={item.id}
                onClick={() => setTab(item.id)}
                role="tab"
                type="button"
              >
                {item.label}
                {count > 0 ? <span className={`rounded-full px-1.5 text-[10px] ${tab === item.id ? "bg-white/20 text-white" : "bg-[#f3eeea] text-[#5c534f]"}`}>{count}</span> : null}
              </button>
            );
          })}
        </div>
      </section>

      {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p> : null}
      {loading && !data ? <p className="px-1 text-sm text-[#817773]">A preparar a leitura do período…</p> : null}

      {data && tab === "objectives" ? (
        <div className="space-y-4" role="tabpanel">
          <div className="flex justify-end">
            <select aria-label="Situação dos objectivos" className={control} onChange={(event) => setObjectiveSituation(event.target.value)} value={objectiveSituation}>
              <option value="all">Todos os objectivos</option>
              <option value="attention">A pedir atenção</option>
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi accent="bg-[#c4a36a]" label="No período" note="Metas neste recorte" value={String(data.objectiveStats.total)} />
            <Kpi accent="bg-[#8d3d4a]" label="Abaixo do ritmo" note="Meta atrás do esperado" value={String(data.objectiveStats.behind)} />
            <Kpi accent="bg-[#a8792f]" label="Sem check-in" note="Sem progresso registado" value={String(data.objectiveStats.silent)} />
            <Kpi accent="bg-[#510f1d]" label="Bloqueios" note="À espera de alguém" value={String(data.objectiveStats.blocked)} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
              <h3 className="text-[15px] font-semibold text-[#2c2424]">Estado das metas</h3>
              <p className="mt-1 text-[13px] text-[#8a807c]">{mixInsight(data.objectiveMix)}</p>
              <Donut parts={data.objectiveMix.map((part) => ({ ...part, color: mixColor[part.label] ?? "#c4a36a" }))} />
            </section>
            <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
              <h3 className="text-[15px] font-semibold text-[#2c2424]">Onde está o progresso</h3>
              <p className="mt-1 text-[13px] text-[#8a807c]">Cada meta entra numa faixa, da que ainda não se mede à que já chegou ao alvo.</p>
              <BarList color="bg-[#c4a36a]" rows={data.progressBands.map((band) => ({ label: band.label, value: band.count, display: String(band.count) }))} />
            </section>
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
            <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
              <PanelTitle action="Abrir objectivos" title="Metas" onAction={() => onNavigate("objectives")} />
              <ul className="mt-4 space-y-4">
                {data.objectives.map((objective) => (
                  <li key={objective.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-[13px] font-medium text-[#2c2424]">{objective.title}</p>
                      <p className="shrink-0 text-[12px] tabular-nums text-[#8a807c]">{objective.progress === null ? "—" : `${objective.progress}%`}</p>
                    </div>
                    <p className="mt-0.5 text-[12px] text-[#8a807c]">{objective.status} · {objective.detail}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f3eeea]">
                      <div className="h-full rounded-full bg-[#c4a36a]" style={{ width: `${Math.min(100, Math.max(0, objective.progress ?? 0))}%` }} />
                    </div>
                  </li>
                ))}
                {data.objectives.length === 0 ? <li className="text-[13px] text-[#8a807c]">Sem objectivos neste recorte.</li> : null}
              </ul>
              {data.objectiveTotal > data.objectives.length ? <p className="mt-3 text-[12px] text-[#8a807c]">{data.objectives.length} de {data.objectiveTotal} metas. As restantes estão em Objectivos.</p> : null}
            </section>
            <ActionList actions={objectiveActions} count={data.actionCounts.objectives} empty="Nada a decidir nos objectivos." onNavigate={onNavigate} title="Decisões" />
          </div>
          <SubjectBars color="bg-[#c4a36a]" empty="Sem acções em objectivos neste período." field="objectives" rows={data.performance} title="Quem trabalhou os objectivos" />
          <ActivityBoard groups={groups} openActors={openActors} peopleCount={peopleCount} period={period} setOpenActors={setOpenActors} showDomain={false} />
        </div>
      ) : null}

      {data && tab === "commercial" ? (
        <div className="space-y-4" role="tabpanel">
          <div className="flex justify-end">
            <select aria-label="Etapa comercial" className={control} onChange={(event) => setStage(event.target.value)} value={stage}>
              <option value="all">Todas as etapas</option>
              <option value="new_contact">Contacto novo</option>
              <option value="in_conversation">Em conversa</option>
              <option value="proposal_sent">Proposta enviada</option>
              <option value="converted">Convertido</option>
              <option value="lost">Perdido</option>
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi accent="bg-[#7a4e86]" label="Pipeline aberto" note={data.metrics.pipelineNote} value={data.metrics.pipeline} />
            <Kpi accent="bg-[#6e4b71]" label="Oportunidades abertas" note={`${data.commercialStats.converted} convertidas · ${data.commercialStats.lost} perdidas`} value={String(data.commercialStats.open)} />
            <Kpi accent="bg-[#a8792f]" label="Follow-ups em atraso" note="Hora marcada já passou" value={String(data.commercialStats.overdue)} />
            <Kpi accent="bg-[#8d3d4a]" label="Propostas sem pagamento" note="Enviadas e ainda em aberto" value={String(data.commercialStats.proposals)} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
            <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
              <PanelTitle action="Abrir comercial" title="Funil" onAction={() => onNavigate("commercial")} />
              <p className="mt-1 text-[13px] text-[#8a807c]">{funnelInsight(data.funnel)}</p>
              <FunnelChart steps={data.funnel} />
            </section>
            <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
              <h3 className="text-[15px] font-semibold text-[#2c2424]">Avisos</h3>
              <p className="mt-1 text-[13px] text-[#8a807c]">{data.noticeCount === 0 ? "Etapas e follow-ups dentro do prazo." : `${data.noticeCount} ${data.noticeCount === 1 ? "passo à espera" : "passos à espera"}`}</p>
              {data.noticesReady ? (
                <p className="mt-3 text-[12px] leading-5 text-[#8a807c]">O e-mail vai para quem cadastrou, uma vez por prazo.</p>
              ) : (
                <p className="mt-3 text-[12px] leading-5 text-[#8c6a2c]">Os avisos estão aqui. O e-mail fica guardado quando a migração de avisos estiver aplicada.</p>
              )}
              <ul className="mt-3">
                {data.notices.map((notice) => (
                  <li className="border-t border-[#f3eeea] py-3 first:border-t-0" key={notice.id}>
                    <p className="text-[11px] font-semibold text-[#8a5b38]">{notice.personName}</p>
                    <p className="mt-0.5 truncate text-[14px] font-medium text-[#2c2424]">{notice.title}</p>
                    <p className="mt-0.5 text-[12px] leading-5 text-[#5c534f]">Há {notice.days} {notice.days === 1 ? "dia" : "dias"} em {notice.stageLabel}. {notice.next}</p>
                  </li>
                ))}
              </ul>
              {data.noticeCount > data.notices.length ? <p className="text-[12px] text-[#8a807c]">Mais {data.noticeCount - data.notices.length} no comercial.</p> : null}
            </section>
          </div>
          <ActionList actions={commercialActions} count={data.actionCounts.commercial} empty="Nada a decidir no comercial." onNavigate={onNavigate} title="Decisões" />
          <SubjectBars color="bg-[#7a4e86]" empty="Sem acções comerciais neste período." field="commercial" rows={data.performance} title="Quem trabalhou o comercial" />
          <ActivityBoard groups={groups} openActors={openActors} peopleCount={peopleCount} period={period} setOpenActors={setOpenActors} showDomain={false} />
        </div>
      ) : null}

      {data && tab === "payments" ? (
        <div className="space-y-4" role="tabpanel">
          <div className="flex justify-end">
            <select aria-label="Estado do pagamento" className={control} onChange={(event) => setPaymentStatus(event.target.value)} value={paymentStatus}>
              <option value="all">Todos os pagamentos</option>
              <option value="accepted">Aceites</option>
              <option value="pending">Pendentes</option>
              <option value="unreconciled">Por reconciliar</option>
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi accent="bg-[#510f1d]" label="Receita aceite" note={`${data.payments.acceptedCount} ${data.payments.acceptedCount === 1 ? "pagamento" : "pagamentos"}`} value={data.metrics.revenue} />
            <Kpi accent="bg-[#a8792f]" label="Pendente" note={`${data.payments.pendingCount} ${data.payments.pendingCount === 1 ? "pagamento" : "pagamentos"}`} value={data.payments.pendingKz} />
            <Kpi accent="bg-[#8d3d4a]" label="Por reconciliar" note={`${data.payments.unreconciledCount} aceites sem fecho`} value={data.payments.unreconciledKz} />
            <Kpi accent="bg-[#c4a36a]" label="Resultado do mês" note={data.payments.resultKz ? "Entradas menos despesas" : "Visível na vista do mês"} value={data.payments.resultKz ?? "—"} />
          </div>
          <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
            <PanelTitle action="Abrir pagamentos" title="Receita ao longo do período" onAction={() => onNavigate("payments")} />
            <div className="mt-6 flex h-48 items-end gap-2">
              {data.revenueSeries.map((point) => {
                const peak = point.amount > 0 && point.amount === revenuePeak;
                return (
                  <div className="flex h-full min-w-0 flex-1 flex-col justify-end" key={point.label}>
                    {data.revenueSeries.length <= 8 && point.amount > 0 ? <span className="mb-1 truncate text-center text-[9px] tabular-nums text-[#8d837f]">{formatKz(point.amount)}</span> : null}
                    <div className={`rounded-t-md ${peak ? "bg-[#510f1d]" : "bg-[#e7d7c8]"}`} style={{ height: `${point.amount > 0 ? Math.max(10, (point.amount / revenueMax) * 100) : 3}%` }} title={formatKz(point.amount)} />
                    <span className="mt-2 truncate text-center text-[10px] text-[#8d837f]">{point.label}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[13px] text-[#8a807c]">{revenueInsight(data.revenueSeries)}</p>
            <h4 className="mt-6 text-[13px] font-semibold text-[#2c2424]">Valor por estado</h4>
            <BarList color="bg-[#510f1d]" rows={data.payments.breakdown.map((item) => ({ label: item.label, value: item.amountValue, display: `${item.amount} · ${item.count}` }))} />
          </section>
          <ActionList actions={paymentActions} count={data.actionCounts.payments} empty="Nada a decidir nos pagamentos." onNavigate={onNavigate} title="Por reconciliar" />
          <SubjectBars color="bg-[#8d3d4a]" empty="Sem acções de pagamento neste período." field="payments" rows={data.performance} title="Quem tratou pagamentos" />
          <ActivityBoard groups={groups} openActors={openActors} peopleCount={peopleCount} period={period} setOpenActors={setOpenActors} showDomain={false} />
        </div>
      ) : null}

      {data && tab === "other" ? (
        <div className="space-y-4" role="tabpanel">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi accent="bg-[#510f1d]" label="Receita aceite" note={data.metrics.revenueNote} value={data.metrics.revenue} />
            <Kpi accent="bg-[#7a4e86]" label="Pipeline aberto" note={data.metrics.pipelineNote} value={data.metrics.pipeline} />
            <Kpi accent="bg-[#c4a36a]" label="Objectivos em atenção" note={data.metrics.attentionNote} value={data.metrics.attention} />
            <Kpi accent="bg-[#8d3d4a]" label="Avisos comerciais" note="Passos que já deviam ter acontecido" value={String(data.noticeCount)} />
          </div>
          <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
            <h3 className="text-[15px] font-semibold text-[#2c2424]">Onde a equipa pôs o trabalho</h3>
            <p className="mt-1 text-[13px] text-[#8a807c]">{effortInsight(data.performance)}</p>
            <Donut parts={effortParts(data.performance)} />
          </section>
          <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
            <h3 className="text-[15px] font-semibold text-[#2c2424]">Performance da equipa</h3>
            <p className="mt-1 text-[13px] text-[#8a807c]">Acções deste período, nos três assuntos.</p>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[#746b67]">
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#c4a36a]" />Objectivos</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#7a4e86]" />Comercial</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#8d3d4a]" />Pagamentos</span>
            </div>
            <ul className="mt-5 space-y-3.5">
              {data.performance.map((personRow) => (
                <li key={personRow.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13px] font-medium text-[#2c2424]">{personRow.name}</span>
                    <span className="shrink-0 text-[12px] tabular-nums text-[#8a807c]">{personRow.total}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#f3eeea]" title={`${personRow.objectives} objectivos · ${personRow.commercial} comercial · ${personRow.payments} pagamentos`}>
                    <div className="flex h-full" style={{ width: `${(personRow.total / performanceMax) * 100}%` }}>
                      <span className="h-full bg-[#c4a36a]" style={{ width: `${(personRow.objectives / personRow.total) * 100}%` }} />
                      <span className="h-full bg-[#7a4e86]" style={{ width: `${(personRow.commercial / personRow.total) * 100}%` }} />
                      <span className="h-full bg-[#8d3d4a]" style={{ width: `${(personRow.payments / personRow.total) * 100}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {data.performance.length === 0 ? <p className="mt-6 text-[13px] text-[#8a807c]">Ainda não há acções da equipa neste período.</p> : null}
          </section>
          <ActivityBoard groups={groups} openActors={openActors} peopleCount={peopleCount} period={period} setOpenActors={setOpenActors} showDomain />
        </div>
      ) : null}

    </div>
  );
}

function Donut({ parts }: { parts: { label: string; count: number; color: string }[] }) {
  const total = parts.reduce((sum, part) => sum + part.count, 0);
  let cursor = 0;
  const gradient = total === 0
    ? "#f3eeea 0% 100%"
    : parts.map((part) => {
      const start = cursor;
      cursor += (part.count / total) * 100;
      return `${part.color} ${start}% ${cursor}%`;
    }).join(", ");
  return (
    <div className="mt-5 flex flex-wrap items-center gap-6">
      <div className="relative size-36 shrink-0 rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="absolute inset-[18px] flex items-center justify-center rounded-full bg-white">
          <span className="text-[22px] font-semibold tracking-[-0.04em] text-[#2c2424]">{total}</span>
        </div>
      </div>
      <ul className="min-w-[160px] flex-1 space-y-2">
        {parts.map((part) => (
          <li className="flex items-center justify-between gap-3 text-[13px]" key={part.label}>
            <span className="inline-flex min-w-0 items-center gap-2 text-[#5c534f]"><span className="size-2 shrink-0 rounded-full" style={{ background: part.color }} />{part.label}</span>
            <span className="font-semibold tabular-nums text-[#2c2424]">{part.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarList({ rows, color }: { rows: { label: string; value: number; display: string }[]; color: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  const empty = rows.every((row) => row.value === 0);
  return (
    <ul className="mt-5 space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-[#5c534f]">{row.label}</span>
            <span className="font-semibold tabular-nums text-[#2c2424]">{row.display}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#f3eeea]">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${row.value > 0 ? Math.max(6, (row.value / max) * 100) : 0}%` }} />
          </div>
        </li>
      ))}
      {empty ? <li className="text-[12px] text-[#8a807c]">Sem valores neste recorte.</li> : null}
    </ul>
  );
}

function FunnelChart({ steps }: { steps: { stage: string; label: string; count: number; amount: string }[] }) {
  const max = Math.max(1, ...steps.map((step) => step.count));
  return (
    <ol className="mt-5 space-y-2">
      {steps.map((step, index) => (
        <li className="flex items-center gap-3" key={step.stage}>
          <div className="h-8 rounded-md bg-[#7a3040]" style={{ width: `${step.count > 0 ? Math.max(18, (step.count / max) * 100) : 8}%`, opacity: step.stage === "lost" ? 0.35 : 1 - index * 0.08 }} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-[#2c2424]">{step.label}</p>
            <p className="text-[12px] text-[#8a807c]">{step.count} · {step.amount}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Kpi({ accent, label, value, note }: { accent: string; label: string; value: string; note: string }) {
  return (
    <section className="h-full overflow-hidden rounded-2xl border border-[#ece7e3] bg-white">
      <div className={`h-1 ${accent}`} />
      <div className="px-5 py-4 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a89890]">{label}</p>
        <p className="mt-2 text-[30px] font-semibold tracking-[-0.04em] text-[#2c2424]">{value}</p>
        <p className="mt-1 text-[13px] text-[#8a807c]">{note}</p>
      </div>
    </section>
  );
}

function PanelTitle({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-[15px] font-semibold text-[#2c2424]">{title}</h3>
      <button className="text-[12px] font-semibold text-[#8a5b38]" onClick={onAction} type="button">{action}</button>
    </div>
  );
}

function ActionList({
  title,
  actions,
  count,
  empty,
  onNavigate,
}: {
  title: string;
  actions: CommandData["actions"];
  count: number;
  empty: string;
  onNavigate: (section: DashboardSection) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
      <h3 className="text-[15px] font-semibold text-[#2c2424]">{title}</h3>
      {count > actions.length ? <p className="mt-1 text-[12px] text-[#8a807c]">{actions.length} de {count}</p> : null}
      <div className="mt-2">
        {actions.map((action) => (
          <button className="flex w-full items-start gap-3 border-t border-[#f3eeea] py-3.5 text-left first:border-t-0" key={action.id} onClick={() => onNavigate(action.section)} type="button">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${action.tone === "block" ? "bg-[#8d3d4a]" : "bg-[#c4a36a]"}`} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-[#2c2424]">{action.title}</span>
              <span className="mt-0.5 block truncate text-[12px] text-[#8a807c]">{action.detail}</span>
            </span>
            <span className="shrink-0 pt-0.5 text-[12px] font-semibold text-[#8a5b38]">Abrir</span>
          </button>
        ))}
        {actions.length === 0 ? <p className="py-6 text-[13px] text-[#8a807c]">{empty}</p> : null}
      </div>
    </section>
  );
}

function SubjectBars({
  title,
  rows,
  field,
  color,
  empty,
}: {
  title: string;
  rows: CommandData["performance"];
  field: "objectives" | "commercial" | "payments";
  color: string;
  empty: string;
}) {
  const visible = rows.filter((row) => row[field] > 0);
  const max = Math.max(1, ...visible.map((row) => row[field]));
  return (
    <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
      <h3 className="text-[15px] font-semibold text-[#2c2424]">{title}</h3>
      <ul className="mt-4 space-y-3">
        {visible.map((row) => (
          <li key={row.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="truncate text-[13px] font-medium text-[#2c2424]">{row.name}</span>
              <span className="text-[12px] tabular-nums text-[#8a807c]">{row[field]}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#f3eeea]">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${(row[field] / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {visible.length === 0 ? <p className="mt-4 text-[13px] text-[#8a807c]">{empty}</p> : null}
    </section>
  );
}

function ActivityBoard({
  groups,
  peopleCount,
  period,
  openActors,
  setOpenActors,
  showDomain,
}: {
  groups: { actorId: string; actorName: string; events: ActivityEvent[] }[];
  peopleCount: number;
  period: (typeof periods)[number]["id"];
  openActors: string[];
  setOpenActors: (value: string[] | ((current: string[]) => string[])) => void;
  showDomain: boolean;
}) {
  const count = groups.reduce((sum, group) => sum + group.events.length, 0);
  return (
    <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
      <h3 className="text-[15px] font-semibold text-[#2c2424]">O que cada pessoa fez</h3>
      <p className="mt-1 text-[13px] text-[#8a807c]">
        {count === 0 ? "Nenhuma acção neste recorte." : `${count} ${count === 1 ? "acção" : "acções"} · ${peopleCount} ${peopleCount === 1 ? "pessoa" : "pessoas"}`}
      </p>
      {groups.length === 0 ? (
        <p className="mt-6 text-[13px] text-[#8a807c]">Quando houver uma acção, aparece aqui com o nome de quem a fez.</p>
      ) : (
        <div className={`mt-5 grid gap-4 ${groups.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {groups.map((group) => {
            const open = openActors.includes(group.actorId) || group.events.length <= 4;
            const shown = open ? group.events : group.events.slice(0, 4);
            return (
              <article className="rounded-xl bg-[#fbfaf8] p-4" key={group.actorId}>
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-[#f3e6df] text-[11px] font-semibold text-[#510f1d]">
                    {personInitials(group.actorName, group.actorName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[#2c2424]">{group.actorName}</p>
                    <p className="text-[12px] text-[#8a807c]">{group.events.length} {group.events.length === 1 ? "acção" : "acções"}</p>
                  </div>
                </div>
                <ul className="mt-3 border-t border-[#f0ebe7]">
                  {shown.map((event) => (
                    <li className="border-b border-[#f0ebe7] py-2.5 last:border-b-0" key={event.id}>
                      <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
                        <time className="pt-0.5 text-[11px] tabular-nums text-[#a39893]" dateTime={event.at}>{activityTime(event.at, period)}</time>
                        <p className="text-[13px] text-[#2c2424]">
                          <span className="font-medium">{event.verb}</span>
                          <span className="text-[#5c534f]"> · {event.subject}</span>
                        </p>
                      </div>
                      {showDomain ? <span className={`ml-[84px] mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${domainTone[event.domain]}`}>{domainLabel[event.domain]}</span> : null}
                    </li>
                  ))}
                </ul>
                {group.events.length > 4 ? (
                  <button
                    className="mt-2 text-[12px] font-semibold text-[#8a5b38]"
                    onClick={() => setOpenActors((current) => current.includes(group.actorId) ? current.filter((id) => id !== group.actorId) : [...current, group.actorId])}
                    type="button"
                  >
                    {open ? "Mostrar menos" : `Mais ${group.events.length - 4}`}
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
