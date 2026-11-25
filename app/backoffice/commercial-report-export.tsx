"use client";

import Image from "next/image";
import { useState } from "react";
import type { ReportPeriod } from "../lib/objective-periods";
import { DateField } from "./date-field";
import { messageForApiError } from "../lib/api-error-messages";

function luandaToday() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function exportFallback(status: number) {
  if (status === 401) return "A sessão expirou. Inicie sessão novamente.";
  if (status === 403) return "Não tem permissão para exportar este relatório.";
  return "Não foi possível gerar o relatório comercial. Tente novamente.";
}

export default function CommercialReportExport() {
  const [period, setPeriod] = useState<ReportPeriod>("day");
  const [date, setDate] = useState(luandaToday);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download(format: "csv" | "pdf") {
    setBusy(true);
    setError("");
    try {
      const query = new URLSearchParams({ period, date, format });
      const response = await fetch(`/api/backoffice/commercial/reports?${query}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null);
        const code = typeof result === "object" && result !== null && "error" in result
          ? result.error
          : null;
        throw new Error(messageForApiError(code, exportFallback(response.status)));
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ??
        `kitadi-relatorio-comercial-${period}-${date}.${format}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar o relatório comercial.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Exportar relatório comercial"
      className="mb-5 rounded-[20px] border border-[#eee9e6] bg-white p-4 sm:flex sm:items-end sm:justify-between sm:gap-5 sm:p-5"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <Image
            alt="Kitadi"
            className="h-auto w-[86px] shrink-0"
            height={36}
            src="/kitadi-logo.png"
            width={88}
          />
          <div>
            <h2 className="text-sm font-bold text-[#342c2d]">Relatório da equipa comercial</h2>
            <p className="mt-1 text-[10px] leading-4 text-[#918783]">
              Mudanças de etapa, contactos e pagamentos. Não inclui actividades dos objectivos.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="text-[10px] font-semibold text-[#817773]">
            Período
            <select
              className="mt-1 block min-h-9 rounded-xl border border-[#e9e3e0] bg-white px-3 text-[11px] text-[#302829]"
              onChange={(event) => setPeriod(event.target.value as ReportPeriod)}
              value={period}
            >
              <option value="day">Dia</option>
              <option value="week">Semana</option>
              <option value="month">Mês</option>
            </select>
          </label>
          <label className="text-[10px] font-semibold text-[#817773]">
            Data de referência
            <DateField
              className="mt-1 block min-h-9 rounded-xl border border-[#e9e3e0] px-3 text-[11px] text-[#302829]"
              mode="date"
              onChange={(event) => setDate(event.target.value)}
              value={date}
            />
          </label>
        </div>
        {error ? <p className="mt-2 text-[10px] text-red-700" role="alert">{error}</p> : null}
      </div>
      <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
        <button
          className="min-h-9 rounded-full border border-[#e9e3e0] px-4 text-[10px] font-semibold text-[#625858] disabled:opacity-50"
          disabled={busy || !date}
          onClick={() => void download("csv")}
          type="button"
        >
          {busy ? "A preparar…" : "Descarregar CSV"}
        </button>
        <button
          className="min-h-9 rounded-full bg-[#510f1d] px-4 text-[10px] font-semibold text-white disabled:opacity-50"
          disabled={busy || !date}
          onClick={() => void download("pdf")}
          type="button"
        >
          {busy ? "A preparar…" : "Descarregar PDF"}
        </button>
      </div>
    </section>
  );
}
