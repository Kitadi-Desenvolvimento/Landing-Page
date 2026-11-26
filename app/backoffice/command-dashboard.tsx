"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { messageForApiError } from "../lib/api-error-messages";
import { BackofficeRequestError, backofficeKeys, queryStaleTime } from "../lib/backoffice-query";
import { objectivePeriodGroupLabel, objectivePeriodPresence } from "../lib/objective-periods";
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
    revenueAmount: number;
    revenueNote: string;
    pipeline: string;
    pipelineAmount: number;
    pipelineNote: string;
    attention: string;
    attentionNote: string;
  };
  revenueSeries: { label: string; amount: number }[];
  actions: { id: string; section: DashboardSection; title: string; detail: string; tone: "block" | "risk" }[];
  actionCounts: { objectives: number; commercial: number; payments: number };
  notices: { id: string; personName: string; title: string; contactName: string; stageLabel: string; days: number; next: string; line: string }[];
  noticeCount: number;
  noticesReady: boolean;
  sentences: string[];
  performance: { id: string; name: string; objectives: number; commercial: number; payments: number; total: number }[];
  activity: ActivityEvent[];
  objectiveStats: { total: number; behind: number; silent: number; blocked: number };
  objectiveMix: { label: string; count: number }[];
  progressBands: { label: string; count: number }[];
  commercialStats: { open: number; converted: number; lost: number; overdue: number; proposals: number };
  objectives: { id: string; title: string; detail: string; progress: number | null; status: string; period: "annual" | "monthly" | "weekly" | "daily" | null; previousProgress: number | null }[];
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
    unreconciledAmount: number;
    breakdown: { status: string; label: string; count: number; amount: string; amountValue: number }[];
    resultKz: string | null;
    resultAmount: number | null;
  };
  people: { id: string; email: string; displayName: string }[];
  products: { slug: string; title: string }[];
  prior: {
    label: string;
    revenueKz: number;
    revenueCount: number;
    acceptedKz: number;
    acceptedCount: number;
    pendingKz: number;
    pendingCount: number;
    unreconciledKz: number;
    unreconciledCount: number;
    pipelineKz: number;
    open: number;
    converted: number;
    lost: number;
    overdue: number;
    proposals: number;
    resultKz: number | null;
    objectiveTotal: number;
    behind: number;
    silent: number;
    blocked: number;
    attention: number;
    noticeCount: number;
    funnel: { stage: string; count: number; amountValue: number }[];
    breakdown: { status: string; count: number; amountValue: number }[];
    mix: { label: string; count: number }[];
    bands: { label: string; count: number }[];
  };
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
  { id: "other", label: "Leitura" },
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

function comparedWith(current: number, previous: number, label: string, money = false) {
  const shown = (value: number) => money ? formatKz(value) : String(Math.round(value));
  const diff = current - previous;
  const before = label === "ontem"
    ? "Ontem eram"
    : label === "a semana anterior"
      ? "Na semana anterior eram"
      : label === "o mês anterior"
        ? "No mês anterior eram"
        : "No ano anterior eram";
  const same = label === "a semana anterior"
    ? "Igual à semana anterior."
    : label === "o mês anterior"
      ? "Igual ao mês anterior."
      : label === "o ano anterior"
        ? "Igual ao ano anterior."
        : "Igual a ontem.";
  if (diff === 0) return `${same} ${before} ${shown(previous)}.`;
  return `${diff > 0 ? "Mais" : "Menos"} ${shown(Math.abs(diff))} do que ${label}. ${before} ${shown(previous)}.`;
}

function formatKz(value: number) {
  return `${new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(value)} Kz`;
}

const mixColor: Record<string, string> = {
  "Vão a tempo": "#66836c",
  Atrasadas: "#c4a36a",
  "Sem progresso": "#a8792f",
  "Prazo neste período": "#7a4e86",
  Bloqueadas: "#8d3d4a",
};

function mixInsight(parts: { label: string; count: number }[]) {
  const total = parts.reduce((sum, part) => sum + part.count, 0);
  const countOf = (label: string) => parts.find((part) => part.label === label)?.count ?? 0;
  if (total === 0) return "Não há metas neste período para esta escolha.";
  const onTrack = countOf("Vão a tempo");
  const behind = countOf("Atrasadas");
  const silent = countOf("Sem progresso");
  const sentences = [`${onTrack} das ${total} metas vão a tempo.`];
  if (behind > 0) sentences.push(`${behind} ${behind === 1 ? "está atrasada" : "estão atrasadas"} face ao que já deviam ter feito até hoje.`);
  if (silent > 0) sentences.push(`${silent} ainda não têm progresso registado.`);
  return sentences.join(" ");
}

function bandInsight(bands: { label: string; count: number }[]) {
  const total = bands.reduce((sum, band) => sum + band.count, 0);
  if (total === 0) return "Não há metas neste período para esta escolha.";
  const unmeasured = bands.find((band) => band.label.startsWith("Metas ainda sem número"))?.count ?? 0;
  const reached = bands.find((band) => band.label.startsWith("Metas que já chegaram"))?.count ?? 0;
  return `O número é a quantidade de metas. Das ${total}, ${unmeasured} ainda não têm um número comparável com o alvo e ${reached} já chegaram ao alvo.`;
}

function funnelInsight(steps: { stage: string; label: string; count: number; amountValue: number }[]) {
  const open = steps.filter((step) => step.stage !== "converted" && step.stage !== "lost");
  const richest = open.reduce((best, step) => step.amountValue > best.amountValue ? step : best, open[0]);
  const closed = steps.filter((step) => step.stage === "converted" || step.stage === "lost");
  const closedCount = closed.reduce((sum, step) => sum + step.count, 0);
  const convertedCount = steps.find((step) => step.stage === "converted")?.count ?? 0;
  const closedSentence = closedCount > 0 ? ` De ${closedCount} contactos fechados, ${convertedCount} compraram.` : "";
  if (!richest || richest.amountValue <= 0) {
    return closedCount > 0 ? `Ainda não há valor indicado nestes contactos.${closedSentence}` : "Ainda não há valor indicado nestes contactos.";
  }
  const contacts = `${richest.count} ${richest.count === 1 ? "contacto" : "contactos"}`;
  return `O maior valor ainda por fechar está em ${richest.label}: ${formatKz(richest.amountValue)}, em ${contacts}.${closedSentence}`;
}

function revenueInsight(series: { label: string; amount: number }[]) {
  const peak = series.reduce((best, point) => point.amount > best.amount ? point : best, series[0]);
  if (!peak || peak.amount <= 0) return "Ainda não entrou dinheiro neste período.";
  const latest = series[series.length - 1];
  if (!latest || series.length === 1) return `Neste período entraram ${formatKz(peak.amount)}.`;
  const latestSentence = latest.label === peak.label ? "" : ` ${latest.label} vai em ${formatKz(latest.amount)}.`;
  return `${peak.label} foi o momento em que entrou mais dinheiro, ${formatKz(peak.amount)}.${latestSentence}`;
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
  if (!top || total === 0) return "Ainda não há registos da equipa neste período.";
  return `${Math.round((top.count / total) * 100)}% dos registos foram em ${top.label.toLowerCase()}. Isto conta o que foi lançado no sistema, não as horas de trabalho.`;
}

type Reading = {
  title: string;
  summary: string;
  meaning: string;
  items: { id: string; title: string; detail: string }[];
  remainder: string;
};

const mixMeaning: Record<string, string> = {
  "Vão a tempo": "Nesta fatia cada meta entra uma só vez. São as que não estão bloqueadas, nem atrasadas, nem sem progresso registado, nem com prazo a chegar neste período.",
  Atrasadas: "A meta fez menos do que já devia ter feito até hoje. A conta compara o que já foi feito com a parte do alvo que corresponde aos dias já passados.",
  "Sem progresso": "Ninguém registou um número nesta meta durante o período, e ela não está nesta fatia como atrasada nem como bloqueada.",
  "Prazo neste período": "A data de fim da meta cai dentro do período escolhido.",
  Bloqueadas: "Alguém foi indicado como a impedir o avanço. Se a meta também estiver atrasada, nesta fatia conta como bloqueada.",
};

const stageMeaning: Record<string, string> = {
  new_contact: "O contacto ainda está no início. O passo é ligar e passar para Em conversa.",
  in_conversation: "Já houve conversa. O passo é enviar a proposta ou marcar o próximo contacto.",
  proposal_sent: "A proposta já foi enviada e o dinheiro ainda pode não ter entrado.",
  converted: "Estes contactos compraram.",
  lost: "Estes contactos não avançaram.",
};

const paymentMeaning: Record<string, string> = {
  accepted: "Este dinheiro já foi confirmado e entra na receita do período.",
  pending: "O pagamento foi iniciado e ainda não foi confirmado.",
  rejected: "O pagamento foi recusado e não entra na receita.",
  expired: "O prazo para pagar terminou.",
  canceled: "O pagamento foi cancelado.",
  refunded: "O dinheiro foi devolvido.",
};

function allGoalsReading(data: CommandData): Reading {
  return {
    title: "Metas neste período",
    summary: `${data.objectiveStats.total} ${data.objectiveStats.total === 1 ? "meta cabe" : "metas cabem"} neste período e nesta escolha.`,
    meaning: `Uma meta conta se está activa e o período dela cruza o período escolhido. Os cartões ao lado podem repetir a mesma meta. No gráfico, cada meta entra numa só fatia. ${comparedWith(data.objectiveStats.total, data.prior.objectiveTotal, data.prior.label)}`,
    items: data.objectives.map((objective) => ({ id: objective.id, title: objective.title, detail: objective.detail })),
    remainder: data.objectiveTotal > data.objectives.length ? `Estão aqui as ${data.objectives.length} que pedem mais atenção, de ${data.objectiveTotal}.` : "",
  };
}

function goalsByStatus(data: CommandData, status: string): Reading {
  const items = data.objectives.filter((objective) => objective.status === status);
  const total = data.objectiveMix.find((part) => part.label === status)?.count ?? items.length;
    const previous = data.prior.mix.find((part) => part.label === status)?.count ?? 0;
    return {
    title: status,
    summary: `${total} ${total === 1 ? "meta está" : "metas estão"} nesta situação. ${comparedWith(total, previous, data.prior.label)}`,
    meaning: mixMeaning[status] ?? "Cada meta entra numa só fatia.",
    items: items.map((objective) => ({ id: objective.id, title: objective.title, detail: objective.detail })),
    remainder: total > items.length ? `Estão aqui ${items.length} de ${total}. As outras não entraram na lista das que pedem mais atenção.` : "",
  };
}

function bandMatches(label: string, progress: number | null) {
  if (label.startsWith("Metas ainda sem número")) return progress === null;
  if (label.startsWith("Metas abaixo de metade")) return progress !== null && progress < 50;
  if (label.startsWith("Metas entre metade")) return progress !== null && progress >= 50 && progress < 100;
  return progress !== null && progress >= 100;
}

function goalsByBand(data: CommandData, band: { label: string; count: number }): Reading {
  const items = data.objectives.filter((objective) => bandMatches(band.label, objective.progress));
  const previous = data.prior.bands.find((item) => item.label === band.label)?.count ?? 0;
  return {
    title: band.label,
    summary: `${band.count} ${band.count === 1 ? "meta entra" : "metas entram"} nesta faixa. ${comparedWith(band.count, previous, data.prior.label)}`,
    meaning: "A percentagem é o que já foi feito a dividir pelo alvo. Sem número quer dizer que a meta não tem um alvo em quantidade ou em kwanzas ligado a um produto.",
    items: items.map((objective) => ({
      id: objective.id,
      title: objective.title,
      detail: objective.progress === null ? objective.detail : `${objective.progress}% do alvo. ${objective.detail}`,
    })),
    remainder: band.count > items.length ? `Estão aqui ${items.length} de ${band.count}. As outras não entraram na lista das que pedem mais atenção.` : "",
  };
}

function pipelineReading(data: CommandData): Reading {
  const open = data.funnel.filter((step) => step.stage !== "converted" && step.stage !== "lost");
  return {
    title: "Ainda por fechar",
    summary: `${data.metrics.pipeline}. ${data.metrics.pipelineNote}. ${comparedWith(data.metrics.pipelineAmount, data.prior.pipelineKz, data.prior.label, true)}`,
    meaning: "Este valor soma as oportunidades que ainda não compraram nem foram dadas como perdidas. Ainda não é dinheiro que entrou.",
    items: open.map((step) => ({ id: step.stage, title: step.label, detail: `${step.count} ${step.count === 1 ? "contacto" : "contactos"} · ${step.amount}` })),
    remainder: "Os nomes destes contactos estão no comercial.",
  };
}

function openContactsReading(data: CommandData): Reading {
  return {
    title: "Contactos em aberto",
    summary: `${data.commercialStats.open} contactos continuam em aberto. ${data.commercialStats.converted} já compraram e ${data.commercialStats.lost} não avançaram. ${comparedWith(data.commercialStats.open, data.prior.open, data.prior.label)}`,
    meaning: "Em aberto são os contactos que ainda não compraram nem foram dados como perdidos.",
    items: data.funnel.filter((step) => step.stage !== "converted" && step.stage !== "lost").map((step) => ({ id: step.stage, title: step.label, detail: `${step.count} ${step.count === 1 ? "contacto" : "contactos"} · ${step.amount}` })),
    remainder: "Os nomes destes contactos estão no comercial.",
  };
}

function proposalReading(data: CommandData, actions: CommandData["actions"]): Reading {
  const items = actions.filter((action) => action.id.startsWith("proposal-"));
  return {
    title: "Propostas por pagar",
    summary: `${data.commercialStats.proposals} ${data.commercialStats.proposals === 1 ? "proposta foi enviada" : "propostas foram enviadas"} e o dinheiro ainda não entrou. ${comparedWith(data.commercialStats.proposals, data.prior.proposals, data.prior.label)}`,
    meaning: "A etapa é Proposta enviada e não há um pagamento confirmado.",
    items: items.map((action) => ({ id: action.id, title: action.title, detail: action.detail })),
    remainder: data.commercialStats.proposals > items.length ? `Estão aqui ${items.length} de ${data.commercialStats.proposals}.` : "",
  };
}

function stageReading(step: CommandData["funnel"][number], data: CommandData): Reading {
  const previous = data.prior.funnel.find((item) => item.stage === step.stage);
  return {
    title: step.label,
    summary: `${step.count} ${step.count === 1 ? "contacto" : "contactos"} · ${step.amount}. ${comparedWith(step.count, previous?.count ?? 0, data.prior.label)} ${comparedWith(step.amountValue, previous?.amountValue ?? 0, data.prior.label, true)}`,
    meaning: stageMeaning[step.stage] ?? "Esta é uma etapa do comercial.",
    items: [],
    remainder: "Os nomes destes contactos estão no comercial.",
  };
}

function noticeReading(notice: CommandData["notices"][number]): Reading {
  return {
    title: notice.contactName || notice.title,
    summary: notice.line,
    meaning: `${notice.stageLabel} é a etapa actual. O aviso aparece porque o tempo desta etapa já passou, ou porque o seguimento é para hoje. ${notice.personName === "Sem responsável" ? "Ainda ninguém da equipa assumiu este contacto." : `${notice.personName} é quem criou o contacto.`}`,
    items: [],
    remainder: "",
  };
}

function paymentStatusReading(data: CommandData, status: string): Reading {
  const item = data.payments.breakdown.find((row) => row.status === status);
  const count = item?.count ?? 0;
  return {
    title: item?.label ?? "Pagamentos",
    summary: item ? `${item.amount} · ${count} ${count === 1 ? "pagamento" : "pagamentos"}. ${comparedWith(item.amountValue, data.prior.breakdown.find((row) => row.status === status)?.amountValue ?? 0, data.prior.label, true)}` : "Não há pagamentos nesta situação.",
    meaning: paymentMeaning[status] ?? "Esta é uma situação de pagamento.",
    items: [],
    remainder: "O detalhe de cada pagamento está em Pagamentos.",
  };
}

function unreconciledReading(data: CommandData, actions: CommandData["actions"]): Reading {
  return {
    title: "Falta conferir",
    summary: `${data.payments.unreconciledKz} já entraram e ainda não foram conferidos, em ${data.payments.unreconciledCount} ${data.payments.unreconciledCount === 1 ? "pagamento" : "pagamentos"}. ${comparedWith(data.payments.unreconciledAmount, data.prior.unreconciledKz, data.prior.label, true)}`,
    meaning: "O dinheiro foi confirmado e ainda ninguém marcou o pagamento como conferido.",
    items: actions.map((action) => ({ id: action.id, title: action.title, detail: action.detail })),
    remainder: data.payments.unreconciledCount > actions.length ? `Estão aqui ${actions.length} de ${data.payments.unreconciledCount}.` : "",
  };
}

function resultReading(data: CommandData): Reading {
  return {
    title: "Resultado do mês",
    summary: data.payments.resultAmount !== null && data.prior.resultKz !== null ? `${data.payments.resultKz}. ${comparedWith(data.payments.resultAmount, data.prior.resultKz, data.prior.label, true)}` : data.payments.resultKz ?? "—",
    meaning: data.payments.resultKz ? "É o dinheiro que entrou menos as despesas desse mês." : "Este número só aparece quando o período escolhido é o mês.",
    items: [],
    remainder: "",
  };
}

function revenuePointReading(point: { label: string; amount: number }, peak: boolean, total: string): Reading {
  return {
    title: point.label,
    summary: formatKz(point.amount),
    meaning: peak ? `Este foi o momento em que entrou mais dinheiro. No período inteiro entraram ${total}.` : `Este valor soma os pagamentos confirmados neste intervalo. No período inteiro entraram ${total}.`,
    items: [],
    remainder: "",
  };
}

function attentionReading(data: CommandData): Reading {
  const items = data.objectives.filter((objective) => objective.status !== "Vão a tempo");
  const total = Number(data.metrics.attention);
  return {
    title: "Metas que pedem decisão",
    summary: `${data.metrics.attention} ${data.metrics.attentionNote}. ${comparedWith(Number(data.metrics.attention), data.prior.attention, data.prior.label)}`,
    meaning: "Entram as metas atrasadas e as que estão sem progresso ou com prazo a chegar. Uma meta bloqueada também pede decisão.",
    items: items.map((objective) => ({ id: objective.id, title: objective.title, detail: objective.detail })),
    remainder: total > items.length ? `Estão aqui ${items.length} de ${total}. As outras não entraram na lista das que pedem mais atenção.` : "",
  };
}

function waitingContactsReading(data: CommandData): Reading {
  return {
    title: "Contactos à espera",
    summary: `${data.noticeCount} ${data.noticeCount === 1 ? "contacto está" : "contactos estão"} à espera de um passo da equipa. ${comparedWith(data.noticeCount, data.prior.noticeCount, data.prior.label)}`,
    meaning: "O tempo da etapa já passou, ou o seguimento é para hoje, até à meia-noite.",
    items: data.notices.map((notice) => ({ id: notice.id, title: notice.contactName || notice.title, detail: notice.line })),
    remainder: data.noticeCount > data.notices.length ? `Estão aqui ${data.notices.length} de ${data.noticeCount}.` : "",
  };
}

function effortSliceReading(data: CommandData, label: string): Reading {
  const field = label === "Objectivos" ? "objectives" : label === "Comercial" ? "commercial" : "payments";
  const domain = field === "objectives" ? "objectives" : field === "commercial" ? "commercial" : "payments";
  const count = data.performance.reduce((sum, row) => sum + row[field], 0);
  const events = data.activity.filter((event) => event.domain === domain);
  return {
    title: `Registos em ${label.toLowerCase()}`,
    summary: `${count} ${count === 1 ? "registo" : "registos"}.`,
    meaning: "Cada registo é um lançamento no sistema. Não é o resultado da meta nem as horas de trabalho.",
    items: events.slice(0, 20).map((event) => ({ id: event.id, title: event.actorName, detail: `${event.verb} · ${event.subject}` })),
    remainder: count > events.length ? `Estão aqui ${Math.min(20, events.length)} de ${count}. A lista recente não guarda todos.` : "",
  };
}

function personReading(row: CommandData["performance"][number], events: ActivityEvent[], field: "objectives" | "commercial" | "payments" | "all"): Reading {
  const own = events.filter((event) => event.actorId === row.id && (field === "all" || event.domain === field));
  const count = field === "all" ? row.total : row[field];
  const place = field === "objectives" ? "em metas" : field === "commercial" ? "no comercial" : field === "payments" ? "em pagamentos" : "nos três assuntos";
  return {
    title: row.name,
    summary: `${count} ${count === 1 ? "registo" : "registos"} ${place}. ${row.objectives} em metas, ${row.commercial} no comercial e ${row.payments} em pagamentos.`,
    meaning: "Cada registo é um lançamento no sistema: progresso, alteração, etapa, pagamento ou bloqueio. Não é o resultado da meta nem as horas de trabalho.",
    items: own.slice(0, 20).map((event) => ({ id: event.id, title: `${event.verb} · ${event.subject}`, detail: "" })),
    remainder: count > own.length ? `Estão aqui ${Math.min(20, own.length)} de ${count}. A lista recente não guarda todos.` : "",
  };
}

function actionReading(action: CommandData["actions"][number], meaning: string): Reading {
  return { title: action.title, summary: action.detail, meaning, items: [], remainder: "" };
}

function eventReading(event: ActivityEvent): Reading {
  return {
    title: event.actorName,
    summary: `${event.verb} · ${event.subject}`,
    meaning: event.domain === "objectives"
      ? "Isto é um lançamento numa meta: criar, alterar, progresso ou bloqueio."
      : event.domain === "commercial"
        ? "Isto é um lançamento no comercial: criar, mudar etapa, pagamento ou próximo contacto."
        : "Isto é um lançamento de pagamento: registar ou conferir.",
    items: [],
    remainder: "",
  };
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
  const [period, setPeriod] = useState<(typeof periods)[number]["id"]>("day");
  const [person, setPerson] = useState("all");
  const [product, setProduct] = useState("all");
  const [stage, setStage] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [objectiveSituation, setObjectiveSituation] = useState("all");
  const [tab, setTab] = useState<DashboardTab>("objectives");
  const [openActors, setOpenActors] = useState<string[]>([]);
  const [reading, setReading] = useState<Reading | null>(null);
  const commandQuery = useQuery({
    queryKey: backofficeKeys.command({ period, person, product, stage, paymentStatus, objectiveSituation }),
    queryFn: ({ signal }) => loadCommandDashboard({ period, person, product, stage, paymentStatus, objectiveSituation }, signal),
    staleTime: queryStaleTime.dashboard,
    placeholderData: keepPreviousData,
  });
  const data = commandQuery.data ?? null;
  const error = commandQuery.error instanceof Error ? commandQuery.error.message : "";
  const loading = commandQuery.isFetching;

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
          <p className="w-full text-[12px] text-[#8a807c]">Em metas, a pessoa é quem está atribuído. No comercial e nos pagamentos, é quem criou o registo.</p>
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
                <DashIcon name={item.id === "objectives" ? "target" : item.id === "commercial" ? "users" : item.id === "payments" ? "wallet" : "layers"} size={15} />
                {item.label}
                {count > 0 ? <span className={`rounded-full px-1.5 text-[10px] ${tab === item.id ? "bg-white/20 text-white" : "bg-[#f6ecee] text-[#8d3d4a]"}`}>{count}</span> : null}
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
              <option value="all">Todas as metas</option>
              <option value="attention">As que pedem decisão</option>
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi compare={comparedWith(data.objectiveStats.total, data.prior.objectiveTotal, data.prior.label)} icon="target" label="Metas" note="Quantas metas cabem neste período" onOpen={() => setReading(allGoalsReading(data))} value={String(data.objectiveStats.total)} />
            <Kpi compare={comparedWith(data.objectiveStats.behind, data.prior.behind, data.prior.label)} hot={data.objectiveStats.behind > 0} icon="down" label="Atrasadas" note="Fizeram menos do que já deviam até hoje" onOpen={() => setReading(goalsByStatus(data, "Atrasadas"))} tone="risk" value={String(data.objectiveStats.behind)} />
            <Kpi compare={comparedWith(data.objectiveStats.silent, data.prior.silent, data.prior.label)} hot={data.objectiveStats.silent > 0} icon="clock" label="Sem progresso" note="Ninguém registou um número neste período" onOpen={() => setReading(goalsByStatus(data, "Sem progresso"))} tone="watch" value={String(data.objectiveStats.silent)} />
            <Kpi compare={comparedWith(data.objectiveStats.blocked, data.prior.blocked, data.prior.label)} hot={data.objectiveStats.blocked > 0} icon="lock" label="Bloqueadas" note="Alguém está a impedir o avanço" onOpen={() => setReading(goalsByStatus(data, "Bloqueadas"))} tone="risk" value={String(data.objectiveStats.blocked)} />
          </div>
          <p className="text-[12px] text-[#8a807c]">Uma meta pode aparecer em mais do que um cartão. No gráfico ao lado, cada meta entra numa só fatia.</p>
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
              <h3 className="text-[15px] font-semibold text-[#2c2424]">Como estão as metas</h3>
              <p className="mt-1 text-[13px] text-[#8a807c]">{mixInsight(data.objectiveMix)} {comparedWith(data.objectiveStats.total, data.prior.objectiveTotal, data.prior.label)}</p>
              <Donut centerLabel="metas" onOpen={(label) => setReading(goalsByStatus(data, label))} parts={data.objectiveMix.map((part) => ({ ...part, color: mixColor[part.label] ?? "#c4a36a" }))} />
            </section>
            <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
              <h3 className="text-[15px] font-semibold text-[#2c2424]">Quantas metas em cada faixa</h3>
              <p className="mt-1 text-[13px] text-[#8a807c]">{bandInsight(data.progressBands)}</p>
              <BarList color="bg-[#c4a36a]" onOpen={(label) => { const band = data.progressBands.find((item) => item.label === label); if (band) setReading(goalsByBand(data, band)); }} rows={data.progressBands.map((band) => ({ label: band.label, value: band.count, display: `${band.count} ${band.count === 1 ? "meta" : "metas"}`, hint: comparedWith(band.count, data.prior.bands.find((item) => item.label === band.label)?.count ?? 0, data.prior.label) }))} />
            </section>
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
            <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
              <PanelTitle action="Abrir objectivos" title="Metas" onAction={() => onNavigate("objectives")} />
              <ul className="mt-4 space-y-4">
                {data.objectives.map((objective, index) => {
                  const mark = objectiveMark(objective.status);
                  const presence = objectivePeriodPresence(objective.period);
                  const previous = data.objectives[index - 1];
                  const showGroup = !previous || previous.period !== objective.period;
                  return (
                  <li key={objective.id}>
                    {showGroup ? <p className={`mb-2 uppercase ${presence.group}`}>{objectivePeriodGroupLabel(objective.period)}</p> : null}
                    <button className={`flex w-full gap-3 rounded-xl border px-3 text-left ${presence.pad} ${presence.borderWidth} ${presence.borderColor} ${mark.box}`} onClick={() => setReading({ title: objective.title, summary: objective.progress === null ? "Esta meta ainda não tem percentagem do alvo." : `${objective.progress}% do alvo.`, meaning: objective.detail, items: [], remainder: "" })} type="button">
                      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${mark.badge}`}><DashIcon name={mark.icon} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className={`truncate ${presence.title}`}>{objective.title}</p>
                          <p className="shrink-0 text-[12px] tabular-nums text-[#8a807c]">{objective.progress === null ? "sem percentagem do alvo" : `${objective.progress}% do alvo`}</p>
                        </div>
                        <p className="mt-0.5 text-[12px] leading-5 text-[#5c534f]">{objective.detail}</p>
                        <div className={`mt-2 overflow-hidden rounded-full bg-[#f3eeea] ${presence.bar}`}>
                          <div className={`h-full rounded-full ${mark.bar}`} style={{ width: `${Math.min(100, Math.max(0, objective.progress ?? 0))}%` }} />
                        </div>
                      </div>
                    </button>
                  </li>
                  );
                })}
                {data.objectives.length === 0 ? <li className="text-[13px] text-[#8a807c]">Não há metas neste período para esta escolha.</li> : null}
              </ul>
              {data.objectiveTotal > data.objectives.length ? <p className="mt-3 text-[12px] text-[#8a807c]">Estão aqui as primeiras {data.objectives.length}, das anuais para as diárias, de {data.objectiveTotal}. As outras estão em Objectivos.</p> : null}
            </section>
            <ActionList actions={objectiveActions} count={data.actionCounts.objectives} empty="Nenhuma meta pede uma decisão agora." onNavigate={onNavigate} onOpen={(action) => setReading(actionReading(action, "Esta linha é uma meta que pede uma decisão: bloqueio, atraso ou falta de progresso."))} title="O que fazer agora" />
          </div>
          <SubjectBars caption="Cada número é um registo lançado no sistema neste período: progresso, alteração ou bloqueio. Não é o resultado da meta." color="bg-[#c4a36a]" empty="Ninguém registou progresso, alterações ou bloqueios em metas neste período." field="objectives" onOpen={(row) => setReading(personReading(row, data.activity, "objectives"))} rows={data.performance} title="Registos em metas" />
          <ActivityBoard groups={groups} onOpen={(event) => setReading(eventReading(event))} openActors={openActors} peopleCount={peopleCount} period={period} setOpenActors={setOpenActors} showDomain={false} />
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
            <Kpi compare={comparedWith(data.metrics.pipelineAmount, data.prior.pipelineKz, data.prior.label, true)} icon="wallet" label="Ainda por fechar" note={data.metrics.pipelineNote} onOpen={() => setReading(pipelineReading(data))} value={data.metrics.pipeline} />
            <Kpi compare={comparedWith(data.commercialStats.open, data.prior.open, data.prior.label)} icon="users" label="Contactos em aberto" note={`${data.commercialStats.converted} já compraram · ${data.commercialStats.lost} não avançaram`} onOpen={() => setReading(openContactsReading(data))} value={String(data.commercialStats.open)} />
            <Kpi compare={comparedWith(data.commercialStats.overdue, data.prior.overdue, data.prior.label)} hot={data.commercialStats.overdue > 0} icon="phone" label="Contactos por fazer" note="Para contactar hoje, até à meia-noite" onOpen={() => setReading({ title: "Contactos por fazer", summary: `${data.commercialStats.overdue} ${data.commercialStats.overdue === 1 ? "contacto é para hoje" : "contactos são para hoje"}.`, meaning: `Entram os seguimentos marcados para hoje e os de dias anteriores que continuam em aberto. O dia acaba à meia-noite. O nome de cada pessoa está no comercial. ${comparedWith(data.commercialStats.overdue, data.prior.overdue, data.prior.label)}`, items: [], remainder: "" })} tone="watch" value={String(data.commercialStats.overdue)} />
            <Kpi compare={comparedWith(data.commercialStats.proposals, data.prior.proposals, data.prior.label)} hot={data.commercialStats.proposals > 0} icon="file" label="Propostas por pagar" note="A proposta foi enviada e o dinheiro ainda não entrou" onOpen={() => setReading(proposalReading(data, commercialActions))} tone="risk" value={String(data.commercialStats.proposals)} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
            <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
              <PanelTitle action="Abrir comercial" title="Contactos por etapa" onAction={() => onNavigate("commercial")} />
              <p className="mt-1 text-[13px] text-[#8a807c]">{funnelInsight(data.funnel)}</p>
              <FunnelChart onOpen={(step) => setReading(stageReading(step, data))} steps={data.funnel.map((step) => ({ ...step, compare: comparedWith(step.count, data.prior.funnel.find((item) => item.stage === step.stage)?.count ?? 0, data.prior.label) }))} />
            </section>
            <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
              <h3 className="text-[15px] font-semibold text-[#2c2424]">Quem contactar</h3>
              <p className="mt-1 text-[13px] text-[#8a807c]">{data.noticeCount === 0 ? "Todos os contactos estão dentro do prazo." : `${data.noticeCount} ${data.noticeCount === 1 ? "contacto à espera de um passo da equipa" : "contactos à espera de um passo da equipa"}`}</p>
              <ul className="mt-4 space-y-2">
                {data.notices.map((notice) => {
                  const unowned = notice.line.includes("ninguém da equipa");
                  return (
                    <li key={notice.id}>
                      <button className={`flex w-full gap-3 rounded-xl border px-3 py-3 text-left ${unowned ? "border-[#ead5d8] bg-[#fdf8f8]" : "border-[#ecd9ae] bg-[#fffaf6]"}`} onClick={() => setReading(noticeReading(notice))} type="button">
                        <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${unowned ? "bg-[#f6ecee] text-[#8d3d4a]" : "bg-[#f8f1e4] text-[#8a6232]"}`}><DashIcon name={unowned ? "flag" : "phone"} /></span>
                        <p className="text-[13px] leading-5 text-[#2c2424]">{notice.line}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {data.noticeCount > data.notices.length ? <p className="text-[12px] text-[#8a807c]">Mais {data.noticeCount - data.notices.length} contactos no comercial.</p> : null}
            </section>
          </div>
          <ActionList actions={commercialActions} count={data.actionCounts.commercial} empty="Nenhum contacto pede uma decisão agora." onNavigate={onNavigate} onOpen={(action) => setReading(actionReading(action, "Esta linha é um contacto que pede uma decisão: um bloqueio ou uma proposta ainda por pagar."))} title="O que fazer agora" />
          <SubjectBars caption="Cada número é um registo lançado no comercial: criar, mudar etapa, pagamento ou bloqueio. Não é o valor fechado." color="bg-[#7a4e86]" empty="Ninguém lançou registos no comercial neste período." field="commercial" onOpen={(row) => setReading(personReading(row, data.activity, "commercial"))} rows={data.performance} title="Registos no comercial" />
          <ActivityBoard groups={groups} onOpen={(event) => setReading(eventReading(event))} openActors={openActors} peopleCount={peopleCount} period={period} setOpenActors={setOpenActors} showDomain={false} />
        </div>
      ) : null}

      {data && tab === "payments" ? (
        <div className="space-y-4" role="tabpanel">
          <div className="flex justify-end">
            <select aria-label="Estado do pagamento" className={control} onChange={(event) => setPaymentStatus(event.target.value)} value={paymentStatus}>
              <option value="all">Todos os pagamentos</option>
              <option value="accepted">Já entraram</option>
              <option value="pending">Ainda não pagaram</option>
              <option value="unreconciled">Falta conferir</option>
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi compare={comparedWith(data.metrics.revenueAmount, data.prior.revenueKz, data.prior.label, true)} icon="check" label="Já entrou" note={`${data.payments.acceptedCount} ${data.payments.acceptedCount === 1 ? "pagamento confirmado" : "pagamentos confirmados"}`} onOpen={() => setReading(paymentStatusReading(data, "accepted"))} value={data.metrics.revenue} />
            <Kpi compare={comparedWith(data.payments.pendingAmount, data.prior.pendingKz, data.prior.label, true)} hot={data.payments.pendingCount > 0} icon="wait" label="Ainda não pagou" note={`${data.payments.pendingCount} ${data.payments.pendingCount === 1 ? "pagamento à espera" : "pagamentos à espera"}`} onOpen={() => setReading(paymentStatusReading(data, "pending"))} tone="watch" value={data.payments.pendingKz} />
            <Kpi compare={comparedWith(data.payments.unreconciledAmount, data.prior.unreconciledKz, data.prior.label, true)} hot={data.payments.unreconciledCount > 0} icon="flag" label="Falta conferir" note={`${data.payments.unreconciledCount} ${data.payments.unreconciledCount === 1 ? "pagamento entrou e ainda não foi conferido" : "pagamentos entraram e ainda não foram conferidos"}`} onOpen={() => setReading(unreconciledReading(data, paymentActions))} tone="risk" value={data.payments.unreconciledKz} />
            <Kpi compare={data.payments.resultAmount !== null && data.prior.resultKz !== null ? comparedWith(data.payments.resultAmount, data.prior.resultKz, data.prior.label, true) : undefined} icon="layers" label="Resultado do mês" note={data.payments.resultKz ? "Dinheiro que entrou menos as despesas" : "Este número só aparece quando o período escolhido é o mês"} onOpen={() => setReading(resultReading(data))} value={data.payments.resultKz ?? "—"} />
          </div>
          <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
            <PanelTitle action="Abrir pagamentos" title="Dinheiro que entrou ao longo do período" onAction={() => onNavigate("payments")} />
            <div className="mt-6 flex h-48 items-end gap-2">
              {data.revenueSeries.map((point) => {
                const peak = point.amount > 0 && point.amount === revenuePeak;
                return (
                  <button className="flex h-full min-w-0 flex-1 flex-col justify-end" key={point.label} onClick={() => setReading(revenuePointReading(point, peak, data.metrics.revenue))} type="button">
                    {data.revenueSeries.length <= 8 && point.amount > 0 ? <span className="mb-1 truncate text-center text-[9px] tabular-nums text-[#8d837f]">{formatKz(point.amount)}</span> : null}
                    {peak ? <span className="mb-1 text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-[#510f1d]">Maior</span> : null}
                    <div className={`rounded-t-md ${peak ? "bg-[#510f1d]" : "bg-[#e7d7c8]"}`} style={{ height: `${point.amount > 0 ? Math.max(10, (point.amount / revenueMax) * 100) : 3}%` }} />
                    <span className="mt-2 truncate text-center text-[10px] text-[#8d837f]">{point.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[13px] text-[#8a807c]">{revenueInsight(data.revenueSeries)} {comparedWith(data.metrics.revenueAmount, data.prior.revenueKz, data.prior.label, true)}</p>
            <h4 className="mt-6 text-[13px] font-semibold text-[#2c2424]">Quanto dinheiro em cada situação</h4>
            <BarList color="bg-[#510f1d]" onOpen={(label) => { const item = data.payments.breakdown.find((row) => row.label === label); if (item) setReading(paymentStatusReading(data, item.status)); }} rows={data.payments.breakdown.map((item) => ({ label: item.label, value: item.amountValue, display: `${item.amount} · ${item.count} ${item.count === 1 ? "pagamento" : "pagamentos"}`, hint: comparedWith(item.amountValue, data.prior.breakdown.find((row) => row.status === item.status)?.amountValue ?? 0, data.prior.label, true), bar: item.status === "accepted" ? "bg-[#66836c]" : item.status === "pending" ? "bg-[#c4a36a]" : item.status === "rejected" || item.status === "refunded" ? "bg-[#8d3d4a]" : "bg-[#cfc6c2]" }))} />
          </section>
          <ActionList actions={paymentActions} count={data.actionCounts.payments} empty="Não há pagamentos por conferir nesta escolha." onNavigate={onNavigate} onOpen={(action) => setReading(actionReading(action, "Este pagamento já entrou e ainda não foi conferido."))} title="Pagamentos por conferir" />
          <SubjectBars caption="Cada número é um registo de pagamento lançado ou conferido. Não é o valor em kwanzas." color="bg-[#8d3d4a]" empty="Ninguém lançou ou conferiu pagamentos neste período." field="payments" onOpen={(row) => setReading(personReading(row, data.activity, "payments"))} rows={data.performance} title="Registos em pagamentos" />
          <ActivityBoard groups={groups} onOpen={(event) => setReading(eventReading(event))} openActors={openActors} peopleCount={peopleCount} period={period} setOpenActors={setOpenActors} showDomain={false} />
        </div>
      ) : null}

      {reading ? <ExplainModal reading={reading} onClose={() => setReading(null)} /> : null}

      {data && tab === "other" ? (
        <div className="space-y-4" role="tabpanel">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi compare={comparedWith(data.metrics.revenueAmount, data.prior.revenueKz, data.prior.label, true)} icon="check" label="Já entrou" note={data.metrics.revenueNote} onOpen={() => setReading(paymentStatusReading(data, "accepted"))} value={data.metrics.revenue} />
            <Kpi compare={comparedWith(data.metrics.pipelineAmount, data.prior.pipelineKz, data.prior.label, true)} icon="wallet" label="Ainda por fechar" note={data.metrics.pipelineNote} onOpen={() => setReading(pipelineReading(data))} value={data.metrics.pipeline} />
            <Kpi compare={comparedWith(Number(data.metrics.attention), data.prior.attention, data.prior.label)} hot={Number(data.metrics.attention) > 0} icon="target" label="Metas que pedem decisão" note={data.metrics.attentionNote} onOpen={() => setReading(attentionReading(data))} tone="watch" value={data.metrics.attention} />
            <Kpi compare={comparedWith(data.noticeCount, data.prior.noticeCount, data.prior.label)} hot={data.noticeCount > 0} icon="phone" label="Contactos à espera" note="Para contactar hoje ou com o prazo da etapa a terminar" onOpen={() => setReading(waitingContactsReading(data))} tone="risk" value={String(data.noticeCount)} />
          </div>
          <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
            <h3 className="text-[15px] font-semibold text-[#2c2424]">Onde a equipa lançou registos</h3>
            <p className="mt-1 text-[13px] text-[#8a807c]">{effortInsight(data.performance)}</p>
            <Donut centerLabel="registos" onOpen={(label) => setReading(effortSliceReading(data, label))} parts={effortParts(data.performance)} />
          </section>
          <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
            <h3 className="text-[15px] font-semibold text-[#2c2424]">Registos da equipa</h3>
            <p className="mt-1 text-[13px] text-[#8a807c]">Cada número é um lançamento no sistema, nos três assuntos. Não é o resultado da meta nem as horas de trabalho.</p>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[#746b67]">
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#c4a36a]" />Objectivos</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#7a4e86]" />Comercial</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#8d3d4a]" />Pagamentos</span>
            </div>
            <ul className="mt-5 space-y-3.5">
              {data.performance.map((personRow) => (
                <li key={personRow.id}>
                  <button className="w-full text-left" onClick={() => setReading(personReading(personRow, data.activity, "all"))} type="button">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13px] font-medium text-[#2c2424]">{personRow.name}</span>
                    <span className="shrink-0 text-[12px] tabular-nums text-[#8a807c]">{personRow.total} registos</span>
                  </div>
                  <p className="mb-1.5 text-[12px] text-[#8a807c]">{personRow.objectives} em metas · {personRow.commercial} no comercial · {personRow.payments} em pagamentos</p>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#f3eeea]">
                    <div className="flex h-full" style={{ width: `${(personRow.total / performanceMax) * 100}%` }}>
                      <span className="h-full bg-[#c4a36a]" style={{ width: `${(personRow.objectives / personRow.total) * 100}%` }} />
                      <span className="h-full bg-[#7a4e86]" style={{ width: `${(personRow.commercial / personRow.total) * 100}%` }} />
                      <span className="h-full bg-[#8d3d4a]" style={{ width: `${(personRow.payments / personRow.total) * 100}%` }} />
                    </div>
                  </div>
                  </button>
                </li>
              ))}
            </ul>
            {data.performance.length === 0 ? <p className="mt-6 text-[13px] text-[#8a807c]">Ainda não há registos da equipa neste período.</p> : null}
          </section>
          <ActivityBoard groups={groups} onOpen={(event) => setReading(eventReading(event))} openActors={openActors} peopleCount={peopleCount} period={period} setOpenActors={setOpenActors} showDomain />
        </div>
      ) : null}

    </div>
  );
}

function Donut({ parts, centerLabel, onOpen }: { parts: { label: string; count: number; color: string }[]; centerLabel: string; onOpen: (label: string) => void }) {
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
        <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-white">
          <span className="text-[22px] font-semibold leading-none tracking-[-0.04em] text-[#2c2424]">{total}</span>
          <span className="mt-1 text-[10px] text-[#8a807c]">{centerLabel}</span>
        </div>
      </div>
      <ul className="min-w-[160px] flex-1 space-y-2">
        {parts.map((part) => (
          <li key={part.label}>
            <button className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-left text-[13px] hover:bg-[#fbfaf8]" onClick={() => onOpen(part.label)} type="button">
              <span className="inline-flex min-w-0 items-center gap-2 text-[#5c534f]"><span className="size-2 shrink-0 rounded-full" style={{ background: part.color }} />{legendIcon(part.label) ? <DashIcon name={legendIcon(part.label) as MarkName} size={14} /> : null}{part.label}</span>
              <span className="font-semibold tabular-nums text-[#2c2424]">{part.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarList({ rows, color, onOpen }: { rows: { label: string; value: number; display: string; bar?: string; hint?: string }[]; color: string; onOpen: (label: string) => void }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  const empty = rows.every((row) => row.value === 0);
  return (
    <ul className="mt-5 space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <button className="mb-1 flex w-full items-baseline justify-between gap-3 text-left text-[13px]" onClick={() => onOpen(row.label)} type="button">
            <span className="text-[#5c534f]">{row.label}{row.hint ? <span className="mt-0.5 block text-[11px] font-medium text-[#5c534f]">{row.hint}</span> : null}</span>
            <span className="font-semibold tabular-nums text-[#2c2424]">{row.display}</span>
          </button>
          <div className="h-2 overflow-hidden rounded-full bg-[#f3eeea]">
            <div className={`h-full rounded-full ${row.bar ?? color}`} style={{ width: `${row.value > 0 ? Math.max(6, (row.value / max) * 100) : 0}%` }} />
          </div>
        </li>
      ))}
      {empty ? <li className="text-[12px] text-[#8a807c]">Não há valores neste período para esta escolha.</li> : null}
    </ul>
  );
}

const funnelTone: Record<string, string> = {
  new_contact: "bg-[#c4a36a]",
  in_conversation: "bg-[#7a4e86]",
  proposal_sent: "bg-[#8d3d4a]",
  converted: "bg-[#66836c]",
  lost: "bg-[#d5ccc8]",
};

function FunnelChart({ steps, onOpen }: { steps: { stage: string; label: string; count: number; amount: string; amountValue: number; compare?: string }[]; onOpen: (step: { stage: string; label: string; count: number; amount: string; amountValue: number }) => void }) {
  const max = Math.max(1, ...steps.map((step) => step.count));
  return (
    <ol className="mt-5 space-y-2">
      {steps.map((step, index) => (
        <li key={step.stage}>
          <button className="flex w-full items-center gap-3 text-left" onClick={() => onOpen(step)} type="button">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f6f3f0] text-[11px] font-semibold text-[#5c534f]">{index + 1}</span>
          <div className={`h-8 rounded-md ${funnelTone[step.stage] ?? "bg-[#7a3040]"}`} style={{ width: `${step.count > 0 ? Math.max(18, (step.count / max) * 100) : 8}%` }} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-[#2c2424]">{step.label}</p>
            <p className="text-[12px] text-[#8a807c]">{step.count} {step.count === 1 ? "contacto" : "contactos"} · {step.amount}</p>
            {step.compare ? <p className="text-[11px] font-medium text-[#5c534f]">{step.compare}</p> : null}
          </div>
          </button>
        </li>
      ))}
    </ol>
  );
}

type MarkName = "target" | "down" | "clock" | "lock" | "wallet" | "wait" | "check" | "users" | "file" | "phone" | "flag" | "layers";

function objectiveMark(status: string) {
  if (status === "Bloqueadas") return { icon: "lock" as const, box: "border-[#ead5d8] bg-[#fdf8f8]", badge: "bg-white text-[#8d3d4a]", bar: "bg-[#8d3d4a]" };
  if (status === "Atrasadas") return { icon: "down" as const, box: "border-[#ead5d8] bg-white", badge: "bg-[#f6ecee] text-[#8d3d4a]", bar: "bg-[#8d3d4a]" };
  if (status === "Sem progresso") return { icon: "clock" as const, box: "border-[#ecd9ae] bg-white", badge: "bg-[#f8f1e4] text-[#8a6232]", bar: "bg-[#c4a36a]" };
  if (status === "Prazo neste período") return { icon: "flag" as const, box: "border-[#e4dbe8] bg-white", badge: "bg-[#f3eef2] text-[#6e4b71]", bar: "bg-[#7a4e86]" };
  return { icon: "check" as const, box: "border-[#e3eee6] bg-white", badge: "bg-[#eef5f0] text-[#3f6b4a]", bar: "bg-[#66836c]" };
}

function legendIcon(label: string): MarkName | null {
  const icons: Record<string, MarkName> = {
    "Vão a tempo": "check",
    Atrasadas: "down",
    "Sem progresso": "clock",
    "Prazo neste período": "flag",
    Bloqueadas: "lock",
    Objectivos: "target",
    Comercial: "users",
    Pagamentos: "wallet",
  };
  return icons[label] ?? null;
}

function DashIcon({ name, size = 18 }: { name: MarkName; size?: number }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "target") return <svg {...props}><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2" /></svg>;
  if (name === "down") return <svg {...props}><path d="M4 8l5 5 3-3 8 8" /><path d="M14 18h6v-6" /></svg>;
  if (name === "clock") return <svg {...props}><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></svg>;
  if (name === "lock") return <svg {...props}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
  if (name === "wallet") return <svg {...props}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="16.5" cy="14.5" r="1" /></svg>;
  if (name === "wait") return <svg {...props}><path d="M8 3h8M8 21h8" /><path d="M8 3c0 5 8 5 8 9s-8 4-8 9" /></svg>;
  if (name === "check") return <svg {...props}><circle cx="12" cy="12" r="8" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></svg>;
  if (name === "users") return <svg {...props}><circle cx="9" cy="9" r="3" /><path d="M4 19c.6-2.6 2.6-4 5-4s4.4 1.4 5 4" /><circle cx="17" cy="9" r="2.2" /><path d="M16 15c1.8.2 3.2 1.2 3.8 4" /></svg>;
  if (name === "file") return <svg {...props}><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v6h6" /></svg>;
  if (name === "phone") return <svg {...props}><path d="M8 3h3l1.5 4-2 1.2a12 12 0 0 0 5.3 5.3L17 12l4 1.5v3A2 2 0 0 1 19 18 15 15 0 0 1 6 5a2 2 0 0 1 2-2z" /></svg>;
  if (name === "flag") return <svg {...props}><path d="M6 3v18" /><path d="M6 4h11l-2 4 2 4H6" /></svg>;
  return <svg {...props}><path d="M12 3l8 4v5c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V7l8-4z" /></svg>;
}

function Kpi({ icon, label, value, note, compare, hot = false, tone = "calm", onOpen }: { icon: MarkName; label: string; value: string; note: string; compare?: string; hot?: boolean; tone?: "calm" | "watch" | "risk"; onOpen: () => void }) {
  const marked = hot && tone !== "calm";
  const box = marked && tone === "risk" ? "border-[#ead5d8] bg-[#fdf8f8]" : marked ? "border-[#ecd9ae] bg-[#fffaf6]" : "border-[#ece7e3] bg-white";
  const badge = marked && tone === "risk" ? "bg-[#f6ecee] text-[#8d3d4a]" : marked ? "bg-[#f8f1e4] text-[#8a6232]" : "bg-[#f6f3f0] text-[#746b67]";
  return (
    <button className={`h-full rounded-2xl border text-left transition-shadow hover:shadow-[0_8px_24px_rgba(44,36,36,0.06)] ${box}`} onClick={onOpen} type="button">
      <div className="flex items-start justify-between gap-3 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a89890]">{label}</p>
          <p className="mt-2 text-[30px] font-semibold tracking-[-0.04em] text-[#2c2424]">{value}</p>
          <p className="mt-1 text-[13px] leading-5 text-[#8a807c]">{note}</p>
          {compare ? <p className="mt-1 text-[12px] font-medium leading-5 text-[#5c534f]">{compare}</p> : null}
        </div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${badge}`}><DashIcon name={icon} /></span>
      </div>
    </button>
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
  onOpen,
}: {
  title: string;
  actions: CommandData["actions"];
  count: number;
  empty: string;
  onNavigate: (section: DashboardSection) => void;
  onOpen: (action: CommandData["actions"][number]) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
      <h3 className="text-[15px] font-semibold text-[#2c2424]">{title}</h3>
      {count > actions.length ? <p className="mt-1 text-[12px] text-[#8a807c]">{actions.length} de {count} decisões, as mais urgentes.</p> : null}
      <div className="mt-2">
        {actions.map((action) => (
          <div className="flex items-start gap-3 border-t border-[#f3eeea] py-3.5 first:border-t-0" key={action.id}>
          <button className="flex min-w-0 flex-1 items-start gap-3 text-left" onClick={() => onOpen(action)} type="button">
            <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${action.tone === "block" ? "bg-[#f6ecee] text-[#8d3d4a]" : "bg-[#f8f1e4] text-[#8a6232]"}`}><DashIcon name={action.tone === "block" ? "lock" : "flag"} size={16} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-[#2c2424]">{action.title}</span>
              <span className="mt-0.5 block text-[12px] leading-5 text-[#8a807c]">{action.detail}</span>
            </span>
            </button>
            <button className="shrink-0 pt-0.5 text-[12px] font-semibold text-[#8a5b38]" onClick={() => onNavigate(action.section)} type="button">Abrir</button>
          </div>
        ))}
        {actions.length === 0 ? <p className="py-6 text-[13px] text-[#8a807c]">{empty}</p> : null}
      </div>
    </section>
  );
}

function SubjectBars({
  title,
  caption,
  rows,
  field,
  color,
  empty,
  onOpen,
}: {
  title: string;
  caption: string;
  rows: CommandData["performance"];
  field: "objectives" | "commercial" | "payments";
  color: string;
  empty: string;
  onOpen: (row: CommandData["performance"][number]) => void;
}) {
  const visible = rows.filter((row) => row[field] > 0);
  const max = Math.max(1, ...visible.map((row) => row[field]));
  return (
    <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
      <h3 className="text-[15px] font-semibold text-[#2c2424]">{title}</h3>
      <p className="mt-1 text-[13px] text-[#8a807c]">{caption}</p>
      <ul className="mt-4 space-y-3">
        {visible.map((row) => (
          <li key={row.id}>
            <button className="mb-1.5 flex w-full items-baseline justify-between gap-3 text-left" onClick={() => onOpen(row)} type="button">
              <span className="truncate text-[13px] font-medium text-[#2c2424]">{row.name}</span>
              <span className="text-[12px] tabular-nums text-[#8a807c]">{row[field]} {row[field] === 1 ? "registo" : "registos"}</span>
            </button>
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
  onOpen,
}: {
  groups: { actorId: string; actorName: string; events: ActivityEvent[] }[];
  peopleCount: number;
  period: (typeof periods)[number]["id"];
  openActors: string[];
  setOpenActors: (value: string[] | ((current: string[]) => string[])) => void;
  showDomain: boolean;
  onOpen: (event: ActivityEvent) => void;
}) {
  const count = groups.reduce((sum, group) => sum + group.events.length, 0);
  return (
    <section className="rounded-2xl border border-[#ece7e3] bg-white p-5 sm:p-6">
      <h3 className="text-[15px] font-semibold text-[#2c2424]">O que cada pessoa fez</h3>
      <p className="mt-1 text-[13px] text-[#8a807c]">
        {count === 0 ? "Nenhum registo neste período para esta escolha." : `${count} ${count === 1 ? "registo" : "registos"} · ${peopleCount} ${peopleCount === 1 ? "pessoa" : "pessoas"}`}
      </p>
      {groups.length === 0 ? (
        <p className="mt-6 text-[13px] text-[#8a807c]">Quando alguém lançar um registo, aparece aqui o nome, o valor e o assunto.</p>
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
                    <p className="text-[12px] text-[#8a807c]">{group.events.length} {group.events.length === 1 ? "registo" : "registos"}</p>
                  </div>
                </div>
                <ul className="mt-3 border-t border-[#f0ebe7]">
                  {shown.map((event) => (
                    <li className="border-b border-[#f0ebe7] last:border-b-0" key={event.id}>
                      <button className="grid w-full grid-cols-[72px_minmax(0,1fr)] gap-3 py-2.5 text-left" onClick={() => onOpen(event)} type="button">
                        <time className="pt-0.5 text-[11px] tabular-nums text-[#a39893]" dateTime={event.at}>{activityTime(event.at, period)}</time>
                        <p className="flex gap-2 text-[13px] text-[#2c2424]">
                          <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md ${domainTone[event.domain]}`}><DashIcon name={event.domain === "objectives" ? "target" : event.domain === "commercial" ? "users" : "wallet"} size={12} /></span>
                          <span><span className="font-medium">{event.verb}</span><span className="text-[#5c534f]"> · {event.subject}</span></span>
                        </p>
                        {showDomain ? <span className={`col-start-2 -mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${domainTone[event.domain]}`}>{domainLabel[event.domain]}</span> : null}
                      </button>
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

async function loadCommandDashboard(
  params: { period: string; person: string; product: string; stage: string; paymentStatus: string; objectiveSituation: string },
  signal: AbortSignal,
) {
  const search = new URLSearchParams(params);
  const response = await fetch(`/api/backoffice/command?${search.toString()}`, { cache: "no-store", signal });
  const result: unknown = await response.json();
  if (!response.ok || typeof result !== "object" || result === null || !("metrics" in result) || !("activity" in result) || !("performance" in result)) {
    const code = typeof result === "object" && result !== null && "error" in result ? result.error : null;
    throw new BackofficeRequestError(messageForApiError(code, "Não foi possível carregar o dashboard."), response.status);
  }
  return result as CommandData;
}

function ExplainModal({ reading, onClose }: { reading: Reading; onClose: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#211d1e]/45 p-4" onClick={onClose}>
      <section aria-labelledby="reading-title" aria-modal="true" className="max-h-[min(720px,90vh)] w-full max-w-[640px] overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-[#2c2424]" id="reading-title">{reading.title}</h2>
          <button className="rounded-full border border-[#e7e1df] px-3 py-1.5 text-[12px] font-semibold text-[#716a69]" onClick={onClose} type="button">Fechar</button>
        </div>
        <p className="mt-3 text-[15px] leading-6 text-[#2c2424]">{reading.summary}</p>
        <p className="mt-2 text-[13px] leading-6 text-[#5c534f]">{reading.meaning}</p>
        {reading.items.length > 0 ? (
          <ul className="mt-4 border-t border-[#f3eeea]">
            {reading.items.map((item) => (
              <li className="border-b border-[#f3eeea] py-3" key={item.id}>
                <p className="text-[14px] font-medium text-[#2c2424]">{item.title}</p>
                {item.detail ? <p className="mt-0.5 text-[12px] leading-5 text-[#5c534f]">{item.detail}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {reading.remainder ? <p className="mt-3 text-[12px] leading-5 text-[#8a807c]">{reading.remainder}</p> : null}
      </section>
    </div>
  );
}
