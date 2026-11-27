import {
  newestQuote,
  quoteFromTrades,
  sessionForTrade,
  aoaRatesFromBna,
  type MarketSnapshot,
  type QuoteBoard,
  type QuoteRow,
} from "./market-model";

const FX_URL = "https://api.frankfurter.dev/v2/providers/bna/rates";
const TRADES_URL = "https://www.bodiva.ao/website/api/GetAllDaillyTradeAmountVariation_no.php";
const FX_REVALIDATE_SECONDS = 60 * 60;
const QUOTE_REVALIDATE_SECONDS = 60;

const EQUITIES = [
  { code: "BAIAAAAA", symbol: "BAI", name: "Banco BAI" },
  { code: "BFAAAAAA", symbol: "BFA", name: "Banco BFA" },
  { code: "UNTLAAAA", symbol: "UNITEL", name: "Unitel" },
  { code: "ENSAAAAA", symbol: "ENSA", name: "ENSA" },
  { code: "SBAOAAAA", symbol: "SBAO", name: "Standard Bank" },
] as const;

let memory: MarketSnapshot | null = null;

export async function getMarketSnapshot(now = new Date()): Promise<MarketSnapshot> {
  const [fxResult, quoteResult] = await Promise.allSettled([
    readFx(),
    readQuotes(now),
  ]);
  let fx = fxResult.status === "fulfilled" ? fxResult.value : null;
  let quotes = quoteResult.status === "fulfilled" ? quoteResult.value : null;
  let stale = false;

  if (!fx && memory?.fx) {
    fx = memory.fx;
    stale = true;
  }
  if (!quotes && memory?.quotes) {
    quotes = memory.quotes;
    stale = true;
  }

  const snapshot: MarketSnapshot = {
    updatedAt: now.toISOString(),
    fx,
    quotes,
    stale,
  };
  if (fx || quotes) memory = snapshot;
  return snapshot;
}

async function readFx() {
  return aoaRatesFromBna(await readJson(FX_URL, FX_REVALIDATE_SECONDS));
}

async function readQuotes(now: Date): Promise<QuoteBoard | null> {
  const settled = await Promise.all(EQUITIES.map(async (equity) => {
    try {
      const payload = await readJson(
        `${TRADES_URL}?securityCode=${equity.code}&timeline=7`,
        QUOTE_REVALIDATE_SECONDS,
      );
      return quoteFromTrades(equity, payload);
    } catch {
      return null;
    }
  }));
  const rows = settled.filter((row): row is QuoteRow => row !== null);
  if (rows.length === 0) return null;
  const newest = newestQuote(rows);
  const session = newest ? sessionForTrade(now, newest.tradedAt) : { open: false, label: "Última sessão" };
  return {
    source: "BODIVA",
    open: session.open,
    label: session.label,
    rows,
  };
}

async function readJson(url: string, revalidate: number): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Kitadi/1.0 (+https://www.kitadi.co.ao)",
    },
    next: { revalidate },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`market_upstream_${response.status}`);
  return response.json();
}
