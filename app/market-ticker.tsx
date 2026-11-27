"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  formatAoa,
  formatChange,
  formatLongDate,
  formatSharePrice,
  formatTradeTime,
  type FxRate,
  type MarketSnapshot,
  type QuoteRow,
} from "./lib/market-model";

const REFRESH_MS = 60 * 1000;

export default function MarketTicker() {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coverTop, setCoverTop] = useState(0);
  const titleId = useId();

  useEffect(() => {
    let timer = 0;
    let stopped = false;

    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/mercado");
        if (!response.ok) return;
        const next = await response.json() as MarketSnapshot;
        if (stopped || (!next.fx && !next.quotes)) return;
        setSnapshot(next);
      } catch {
        // Keep the last figures on screen when a refresh fails.
      }
    };

    const schedule = () => {
      timer = window.setTimeout(async () => {
        await load();
        if (!stopped) schedule();
      }, REFRESH_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };

    void load();
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const header = rootRef.current?.closest("header");
    const place = () => {
      if (header) setCoverTop(header.getBoundingClientRect().bottom);
    };
    place();
    window.addEventListener("resize", place);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  if (!snapshot || (!snapshot.fx && !snapshot.quotes)) return null;

  return (
    <div className="relative border-t border-white/10 bg-[#2a0912] text-white" ref={rootRef}>
      <div className="flex h-8 items-stretch">
        <p className="sr-only">{spokenSummary(snapshot)}</p>
        <div aria-hidden="true" className="market-ticker min-w-0 flex-1 overflow-hidden">
          <div className="market-ticker-track flex w-max items-center">
            <TickerSequence snapshot={snapshot} />
            <TickerSequence snapshot={snapshot} copy />
          </div>
        </div>
        <button
          aria-expanded={open}
          aria-controls={titleId}
          className="inline-flex shrink-0 items-center gap-1.5 border-l border-white/10 bg-[#2a0912] px-3 text-[12px] font-semibold text-[#cda45c] shadow-[-16px_0_16px_#2a0912] transition-colors hover:text-[#dab76e]"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          {open ? "Fechar" : "Ver mais"}
        </button>
      </div>

      {open ? (
        <>
          <button
            aria-label="Fechar o mercado do dia"
            className="fixed inset-x-0 bottom-0 z-40 bg-[#211d1e]/45"
            onClick={() => setOpen(false)}
            style={{ top: coverTop }}
            type="button"
          />
          <div
            aria-labelledby={titleId}
            className="absolute inset-x-0 top-full z-50 max-h-[min(720px,calc(100svh-7.5rem))] overflow-y-auto border-t border-[#ece8e6] bg-[#faf9f8] px-6 py-6 text-[#1f1b1c] shadow-2xl"
            ref={panelRef}
            role="dialog"
          >
            <div className="mx-auto w-full max-w-[1088px]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="section-eyebrow text-[#ae7d32]">Mercado do dia</p>
                  <h2 className="mt-2 text-[22px] font-bold tracking-[0.04em]" id={titleId}>
                    Câmbio e bolsa
                  </h2>
                </div>
                <button
                  className="inline-flex h-9 items-center rounded-full border border-[#e4ddd9] px-4 text-[13px] font-medium text-[#5c1f29]"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Fechar
                </button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                {snapshot.fx ? <FxCard date={snapshot.fx.date} rates={snapshot.fx.rates} /> : null}
                {snapshot.quotes ? (
                  <QuoteCard label={snapshot.quotes.label} open={snapshot.quotes.open} rows={snapshot.quotes.rows} />
                ) : null}
              </div>
              <p className="mt-4 max-w-[820px] text-[13px] leading-6 text-[#716a69]">{disclaimer(snapshot)}</p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function TickerSequence({ snapshot, copy = false }: { snapshot: MarketSnapshot; copy?: boolean }) {
  const rates = snapshot.fx?.rates ?? [];
  const quotes = snapshot.quotes?.rows ?? [];
  return (
    <div aria-hidden={copy ? true : undefined} className={`flex items-center ${copy ? "market-ticker-copy" : ""}`}>
      {rates.map((rate) => (
        <span className="inline-flex items-center gap-1.5 px-4 text-[12px] whitespace-nowrap" key={rate.code}>
          <CurrencyIcon code={rate.code} />
          <span className="font-semibold text-[#cda45c]">{rate.code}</span>
          <span>{formatAoa(rate.aoa)}</span>
        </span>
      ))}
      {quotes.map((row) => (
        <span className="inline-flex items-center gap-1.5 px-4 text-[12px] whitespace-nowrap" key={row.symbol}>
          <ShareIcon />
          <span className="font-semibold">{row.symbol}</span>
          <span>{formatSharePrice(row.price)}</span>
          <ChangeMark value={row.changePct} />
        </span>
      ))}
    </div>
  );
}

function CurrencyIcon({ code }: { code: FxRate["code"] }) {
  const glyph = code === "USD" ? "$" : code === "EUR" ? "€" : "R";
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-4 items-center justify-center rounded-full bg-[#cda45c] text-[9px] font-bold leading-none text-[#2b160f]"
    >
      {glyph}
    </span>
  );
}

function ShareIcon() {
  return (
    <svg aria-hidden="true" className="size-4 text-[#cda45c]" fill="none" viewBox="0 0 16 16">
      <path d="M2 12.5 6 8l2.5 2.5L14 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M10 4h4v4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

function ChangeMark({ value }: { value: number | null }) {
  const tone = value === null || value === 0 ? "text-white/55" : value > 0 ? "text-[#8ee0b0]" : "text-[#ffb4bc]";
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium ${tone}`}>
      <ChangeArrow value={value} />
      {formatChange(value)}
    </span>
  );
}

function ChangeArrow({ value }: { value: number | null }) {
  if (value === null || value === 0) {
    return (
      <svg aria-hidden="true" className="size-3" fill="none" viewBox="0 0 12 12">
        <path d="M2 6h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      </svg>
    );
  }
  const up = value > 0;
  return (
    <svg aria-hidden="true" className="size-3" fill="currentColor" viewBox="0 0 12 12">
      {up ? <path d="M6 1.5 10.5 8H1.5L6 1.5Z" /> : <path d="M6 10.5 1.5 4h9L6 10.5Z" />}
    </svg>
  );
}

function FxCard({ date, rates }: { date: string; rates: FxRate[] }) {
  return (
    <article className="rounded-3xl border border-[#ece8e6] bg-white p-6">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#ae7d32]">BNA</p>
      <h3 className="mt-2 text-[20px] font-bold tracking-[0.04em]">Taxa oficial</h3>
      <p className="mt-1 text-[14px] text-[#716a69]">Tabela de {formatLongDate(date)}</p>
      <table className="mt-4 w-full">
        <caption className="sr-only">Taxas de referência do BNA em kwanzas</caption>
        <tbody>
          {rates.map((rate) => (
            <tr className="border-t border-[#f0ecea]" key={rate.code}>
              <th className="py-3 pr-4 text-left font-medium" scope="row">
                <span className="inline-flex items-center gap-2">
                  <CurrencyIcon code={rate.code} />
                  <span>
                    <span className="block text-[15px] font-semibold">{rate.code}</span>
                    <span className="block text-[13px] font-normal text-[#716a69]">{rate.name}</span>
                  </span>
                </span>
              </th>
              <td className="py-3 text-right text-[18px] font-semibold">{formatAoa(rate.aoa)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function QuoteCard({ label, open, rows }: { label: string; open: boolean; rows: QuoteRow[] }) {
  return (
    <article className="rounded-3xl border border-[#ece8e6] bg-white p-6">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#ae7d32]">BODIVA</p>
      <h3 className="mt-2 text-[20px] font-bold tracking-[0.04em]">Últimas cotações</h3>
      <p className="mt-1 text-[14px] text-[#716a69]">
        <span className={`mr-2 inline-block size-2 rounded-full ${open ? "bg-[#1d7a45]" : "bg-[#c4b8b2]"}`} aria-hidden="true" />
        {label}
      </p>
      <table className="mt-4 w-full">
        <caption className="sr-only">Último preço das acções na BODIVA</caption>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t border-[#f0ecea]" key={row.symbol}>
              <th className="py-3 pr-4 text-left font-medium" scope="row">
                <span className="inline-flex items-center gap-2">
                  <ShareIcon />
                  <span>
                    <span className="block text-[15px] font-semibold text-[#1f1b1c]">{row.symbol}</span>
                    <span className="block text-[13px] font-normal text-[#716a69]">{row.name}</span>
                  </span>
                </span>
              </th>
              <td className="py-3 text-right">
                <span className="block text-[18px] font-semibold">{formatSharePrice(row.price)}</span>
                <span className={`mt-0.5 inline-flex items-center justify-end gap-1 text-[13px] ${panelChangeClass(row.changePct)}`}>
                  <ChangeArrow value={row.changePct} />
                  {formatChange(row.changePct)}
                  {formatTradeTime(row.tradedAt) ? ` · ${formatTradeTime(row.tradedAt)}` : ""}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function panelChangeClass(changePct: number | null): string {
  if (changePct === null || changePct === 0) return "text-[#716a69]";
  return changePct > 0 ? "text-[#1d7a45]" : "text-[#9d2c3a]";
}

function spokenSummary(snapshot: MarketSnapshot): string {
  const parts: string[] = [];
  for (const rate of snapshot.fx?.rates ?? []) {
    parts.push(`${rate.name} ${formatAoa(rate.aoa)}`);
  }
  for (const row of snapshot.quotes?.rows ?? []) {
    parts.push(`${row.name} ${formatSharePrice(row.price)}, variação ${formatChange(row.changePct)}`);
  }
  return parts.join(". ");
}

function disclaimer(snapshot: MarketSnapshot): string {
  const parts: string[] = [];
  if (snapshot.fx) parts.push(`Taxa oficial do BNA de ${formatLongDate(snapshot.fx.date)}.`);
  if (snapshot.quotes) parts.push(`${snapshot.quotes.label}.`);
  if (snapshot.stale) parts.push("A mostrar o último valor guardado.");
  parts.push("Não é recomendação de investimento.");
  return parts.join(" ");
}
