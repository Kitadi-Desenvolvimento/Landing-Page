"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { DashboardProduct } from "./dashboard-data";

type Attendee = {
  reference: string;
  name: string;
  email: string;
  phone: string;
  courseSlug: string;
  productTitle: string;
  edition: string | null;
  variantLabel: string;
  amountKz: number;
  paidAt: string | null;
  checkedIn: boolean;
  checkedInAt: string | null;
};

export default function Attendees({ products }: { products: DashboardProduct[] }) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [courseSlug, setCourseSlug] = useState("");
  const [edition, setEdition] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingReference, setSavingReference] = useState("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (courseSlug) params.set("courseSlug", courseSlug);
    setLoading(true);
    setError("");
    void fetch(`/api/backoffice/attendees?${params.toString()}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok || !isAttendeeList(body)) {
          throw new Error(
            response.status === 503
              ? "Aplique as migrações de pagamentos e participantes no Supabase."
              : "Não foi possível carregar a lista de participantes.",
          );
        }
        if (active) setAttendees(body.attendees);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Falha ao carregar participantes.");
          setAttendees([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [startDate, endDate, courseSlug, edition]);

  const editions = [...new Set(
    attendees
      .filter((attendee) => !courseSlug || attendee.courseSlug === courseSlug)
      .map((attendee) => attendee.edition)
      .filter((value): value is string => Boolean(value)),
  )].sort((a, b) => a.localeCompare(b, "pt"));

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return attendees.filter((attendee) =>
      (!edition || attendee.edition === edition) &&
      (!needle ||
        [
          attendee.reference,
          attendee.name,
          attendee.email,
          attendee.phone,
          attendee.productTitle,
          attendee.edition ?? "",
        ].some((value) => value.toLocaleLowerCase().includes(needle))),
    );
  }, [attendees, edition, search]);

  async function setCheckedIn(attendee: Attendee, checkedIn: boolean) {
    setSavingReference(attendee.reference);
    setError("");
    try {
      const response = await fetch(
        `/api/backoffice/attendees/${encodeURIComponent(attendee.reference)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkedIn }),
        },
      );
      const body: unknown = await response.json();
      if (!response.ok || !isCheckInResult(body, attendee.reference, checkedIn)) {
        throw new Error("Não foi possível actualizar a presença. Tente novamente.");
      }
      setAttendees((current) =>
        current.map((item) =>
          item.reference === attendee.reference
            ? {
                ...item,
                checkedIn,
                checkedInAt: body.checkedInAt,
              }
            : item,
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao actualizar presença.");
    } finally {
      setSavingReference("");
    }
  }

  function exportExcel() {
    const columns = [
      "Referência",
      "Nome",
      "Email",
      "Telefone",
      "Produto",
      "Edição",
      "Variante",
      "Valor (Kz)",
      "Data de pagamento",
      "Presença registada",
    ];
    const rows = filtered.map((attendee) => [
      attendee.reference,
      attendee.name,
      attendee.email,
      attendee.phone,
      attendee.productTitle,
      attendee.edition ?? "",
      attendee.variantLabel,
      String(attendee.amountKz),
      formatDate(attendee.paidAt),
      attendee.checkedIn ? "Sim" : "Não",
    ]);
    const xmlRows = [columns, ...rows]
      .map(
        (row) =>
          `<Row>${row
            .map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`)
            .join("")}</Row>`,
      )
      .join("");
    const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Participantes"><Table>${xmlRows}</Table></Worksheet></Workbook>`;
    downloadFile(
      new Blob(["\uFEFF", workbook], { type: "application/vnd.ms-excel;charset=utf-8" }),
      `kitadi-participantes-${new Date().toISOString().slice(0, 10)}.xls`,
    );
  }

  return (
    <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#a8792f]">
            Inscrições confirmadas
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#302829]">Participantes e entradas</h2>
          <p className="mt-2 text-sm text-[#817773]">
            Pesquise pela referência, filtre por datas, produto ou edição, e registe a presença à entrada.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="min-h-10 rounded-full border border-[#e4dcd8] bg-white px-4 text-[11px] font-semibold text-[#574d4b] disabled:opacity-50"
            disabled={loading}
            onClick={() => window.print()}
            type="button"
          >
            Exportar PDF
          </button>
          <button
            className="min-h-10 rounded-full bg-[#510f1d] px-4 text-[11px] font-semibold text-white disabled:opacity-50"
            disabled={loading || filtered.length === 0}
            onClick={exportExcel}
            type="button"
          >
            Exportar Excel
          </button>
        </div>
      </div>

      <section className="mt-6 rounded-[22px] border border-[#eee9e6] bg-white p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="text-[10px] font-semibold text-[#817773]">
            De
            <input
              className="mt-1 block min-h-10 w-full rounded-xl border border-[#e9e3e0] px-3 text-[12px] text-[#302829]"
              onChange={(event) => setStartDate(event.target.value)}
              type="date"
              value={startDate}
            />
          </label>
          <label className="text-[10px] font-semibold text-[#817773]">
            Até
            <input
              className="mt-1 block min-h-10 w-full rounded-xl border border-[#e9e3e0] px-3 text-[12px] text-[#302829]"
              onChange={(event) => setEndDate(event.target.value)}
              type="date"
              value={endDate}
            />
          </label>
          <label className="text-[10px] font-semibold text-[#817773]">
            Produto
            <select
              className="mt-1 block min-h-10 w-full rounded-xl border border-[#e9e3e0] bg-white px-3 text-[12px] text-[#302829]"
              onChange={(event) => {
                setCourseSlug(event.target.value);
                setEdition("");
              }}
              value={courseSlug}
            >
              <option value="">Todos os produtos</option>
              {products.map((product) => (
                <option key={product.slug} value={product.slug}>{product.title}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-semibold text-[#817773]">
            Edição
            <select
              className="mt-1 block min-h-10 w-full rounded-xl border border-[#e9e3e0] bg-white px-3 text-[12px] text-[#302829]"
              disabled={editions.length === 0}
              onChange={(event) => setEdition(event.target.value)}
              value={edition}
            >
              <option value="">Todas as edições</option>
              {editions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-semibold text-[#817773]">
            Pesquisa
            <input
              className="mt-1 block min-h-10 w-full rounded-xl border border-[#e9e3e0] px-3 text-[12px] text-[#302829]"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome, email ou referência"
              type="search"
              value={search}
            />
          </label>
        </div>
      </section>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <section className="mt-5 overflow-hidden rounded-[22px] border border-[#eee9e6] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0ecea] px-5 py-4">
          <p className="text-[12px] font-bold text-[#342c2d]">
            {loading ? "A carregar participantes…" : `${filtered.length} participante${filtered.length === 1 ? "" : "s"}`}
          </p>
          <p className="text-[10px] text-[#938985]">
            {filtered.filter((item) => item.checkedIn).length} presenças registadas
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead>
              <tr className="border-b border-[#f0ecea] bg-[#fcfbfa] text-[9px] font-bold uppercase tracking-[0.1em] text-[#a39995]">
                <th className="px-5 py-3">Participante / referência</th>
                <th className="px-4 py-3">Produto / edição</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-5 py-3">Entrada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2eeec]">
              {filtered.map((attendee) => (
                <tr className="text-[11px]" key={attendee.reference}>
                  <td className="px-5 py-4">
                    <p className="font-bold text-[#3b3334]">{attendee.name}</p>
                    <p className="mt-1 font-semibold text-[#8b5b39]">{attendee.reference}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-[#4a4141]">{attendee.productTitle}</p>
                    <p className="mt-1 text-[10px] text-[#8f8581]">
                      {[attendee.edition, attendee.variantLabel].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-[#706764]">
                    <p>{attendee.email}</p>
                    <p className="mt-1 text-[10px]">{attendee.phone}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-[#4a4141]">{formatKz(attendee.amountKz)}</p>
                    <p className="mt-1 text-[10px] text-[#8f8581]">{formatDate(attendee.paidAt)}</p>
                  </td>
                  <td className="px-5 py-4">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-[#4a4141]">
                      <input
                        checked={attendee.checkedIn}
                        disabled={savingReference === attendee.reference}
                        onChange={(event) => void setCheckedIn(attendee, event.target.checked)}
                        type="checkbox"
                      />
                      {attendee.checkedIn ? "Presente / usado" : "Registar entrada"}
                    </label>
                    {attendee.checkedInAt ? (
                      <p className="mt-1 text-[9px] text-[#8f8581]">{formatDate(attendee.checkedInAt)}</p>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 ? (
                <tr><td className="px-5 py-10 text-center text-[11px] text-[#968c88]" colSpan={5}>Não foram encontrados participantes para estes filtros.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="print-area report-print-area">
        <header className="report-print-header">
          <Image alt="Kitadi" height={54} src="/kitadi-logo.png" width={132} />
          <div>
            <h1>Lista de participantes</h1>
            <p>Pagamentos confirmados · Kitadi</p>
            <p>
              Período: {startDate || "início"} — {endDate || "hoje"}
              {courseSlug ? ` · Produto: ${products.find((item) => item.slug === courseSlug)?.title ?? courseSlug}` : ""}
              {edition ? ` · Edição: ${edition}` : ""}
            </p>
          </div>
        </header>
        <table className="report-print-table">
          <thead>
            <tr>
              {["Referência", "Nome", "Produto / edição", "Email / telefone", "Pago em", "Entrada"].map((label) => <th key={label}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((attendee) => (
              <tr key={attendee.reference}>
                <td>{attendee.reference}</td>
                <td>{attendee.name}</td>
                <td>{attendee.productTitle}{attendee.edition ? ` · ${attendee.edition}` : ""}</td>
                <td>{attendee.email}<br />{attendee.phone}</td>
                <td>{formatDate(attendee.paidAt)}</td>
                <td>{attendee.checkedIn ? "Presente" : "Por registar"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="report-print-footer">Gerado em {new Date().toLocaleString("pt-AO")}</p>
      </section>
    </>
  );
}

function isAttendeeList(value: unknown): value is { attendees: Attendee[] } {
  return typeof value === "object" && value !== null &&
    "attendees" in value && Array.isArray(value.attendees) &&
    value.attendees.every((attendee: unknown) =>
      typeof attendee === "object" &&
      attendee !== null &&
      "reference" in attendee &&
      typeof attendee.reference === "string" &&
      "name" in attendee &&
      typeof attendee.name === "string" &&
      "email" in attendee &&
      typeof attendee.email === "string" &&
      "phone" in attendee &&
      typeof attendee.phone === "string" &&
      "courseSlug" in attendee &&
      typeof attendee.courseSlug === "string" &&
      "productTitle" in attendee &&
      typeof attendee.productTitle === "string" &&
      "edition" in attendee &&
      (typeof attendee.edition === "string" || attendee.edition === null) &&
      "variantLabel" in attendee &&
      typeof attendee.variantLabel === "string" &&
      "amountKz" in attendee &&
      typeof attendee.amountKz === "number" &&
      "paidAt" in attendee &&
      (typeof attendee.paidAt === "string" || attendee.paidAt === null) &&
      "checkedIn" in attendee &&
      typeof attendee.checkedIn === "boolean" &&
      "checkedInAt" in attendee &&
      (typeof attendee.checkedInAt === "string" || attendee.checkedInAt === null),
    );
}

function isCheckInResult(
  value: unknown,
  reference: string,
  checkedIn: boolean,
): value is { reference: string; checkedIn: boolean; checkedInAt: string | null } {
  return typeof value === "object" &&
    value !== null &&
    "reference" in value &&
    value.reference === reference &&
    "checkedIn" in value &&
    value.checkedIn === checkedIn &&
    "checkedInAt" in value &&
    (typeof value.checkedInAt === "string" || value.checkedInAt === null);
}

function formatKz(value: number) {
  return `${new Intl.NumberFormat("pt-AO").format(value)} Kz`;
}

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString("pt-AO", { dateStyle: "medium", timeStyle: "short" })
    : "—";
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  })[character] ?? character);
}

function downloadFile(file: Blob, filename: string) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
