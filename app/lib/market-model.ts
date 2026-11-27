export const LUANDA_TIME_ZONE = "Africa/Luanda";

export type FxRate = {
  code: "USD" | "EUR" | "ZAR";
  name: string;
  aoa: number;
};

export type FxBoard = {
  source: "BNA";
  date: string;
  rates: FxRate[];
};

export type QuoteRow = {
  symbol: string;
  name: string;
  price: number;
  change: number | null;
  changePct: number | null;
  tradedAt: string;
};

export type QuoteBoard = {
  source: "BODIVA";
  open: boolean;
  label: string;
  rows: QuoteRow[];
};

export type MarketSnapshot = {
  updatedAt: string;
  fx: FxBoard | null;
  quotes: QuoteBoard | null;
  stale: boolean;
};

type BnaRow = {
  date?: unknown;
  base?: unknown;
  quote?: unknown;
  rate?: unknown;
};

type TradePoint = {
  at: string;
  day: string;
  time: string | null;
  price: number;
};

const SESSION_OPEN_MINUTES = 9 * 60;
const SESSION_CLOSE_MINUTES = 15 * 60;
const WEEKDAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);

export function aoaRatesFromBna(payload: unknown): FxBoard | null {
  if (!Array.isArray(payload)) return null;

  let date = "";
  const perEuro = new Map<string, number>();
  for (const entry of payload) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as BnaRow;
    if (row.base !== "EUR" || typeof row.quote !== "string") continue;
    const rate = typeof row.rate === "number" ? row.rate : Number(row.rate);
    const rowDate = typeof row.date === "string" ? row.date : "";
    if (!rowDate || !Number.isFinite(rate) || rate <= 0) continue;
    if (rowDate < date) continue;
    if (rowDate > date) {
      date = rowDate;
      perEuro.clear();
    }
    perEuro.set(row.quote, rate);
  }

  const euro = perEuro.get("AOA");
  const dollar = perEuro.get("USD");
  const rand = perEuro.get("ZAR");
  if (!date || !euro || !dollar || !rand) return null;

  return {
    source: "BNA",
    date,
    rates: [
      { code: "USD", name: "Dólar americano", aoa: euro / dollar },
      { code: "EUR", name: "Euro", aoa: euro },
      { code: "ZAR", name: "Rand", aoa: euro / rand },
    ],
  };
}

export function quoteFromTrades(
  equity: { symbol: string; name: string },
  payload: unknown,
): QuoteRow | null {
  const trades = readTrades(payload);
  if (trades.length === 0) return null;

  const byDay = new Map<string, TradePoint>();
  for (const trade of trades) byDay.set(trade.day, trade);
  const days = [...byDay.keys()].sort();
  const last = byDay.get(days[days.length - 1]);
  if (!last) return null;
  const previous = days.length > 1 ? byDay.get(days[days.length - 2]) : undefined;
  const change = previous ? last.price - previous.price : null;
  const changePct = previous && previous.price > 0 && change !== null
    ? (change / previous.price) * 100
    : null;

  return {
    symbol: equity.symbol,
    name: equity.name,
    price: last.price,
    change,
    changePct,
    tradedAt: last.at,
  };
}

export function sessionForTrade(now: Date, tradedAt: string): { open: boolean; label: string } {
  const trade = tradeClock(tradedAt);
  const today = luandaDay(now);
  const sameDay = trade.day !== "" && trade.day === today;
  const open = sameDay && isSessionOpen(now);

  if (open && trade.time) return { open: true, label: `Última cotação às ${trade.time}` };
  if (sameDay && trade.time) return { open: false, label: `Última sessão às ${trade.time}` };
  if (trade.day) return { open: false, label: `Última sessão de ${formatLongDate(trade.day)}` };
  return { open: false, label: "Última sessão" };
}

export function newestQuote(rows: QuoteRow[]): QuoteRow | null {
  return rows.reduce<QuoteRow | null>((newest, row) => {
    if (!newest || row.tradedAt > newest.tradedAt) return row;
    return newest;
  }, null);
}

export function formatLongDate(day: string): string {
  const date = new Date(`${day}T12:00:00+01:00`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat("pt-PT", {
    day: "numeric",
    month: "long",
    timeZone: LUANDA_TIME_ZONE,
  }).format(date);
}

export function formatAoa(value: number): string {
  return `${new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value)} Kz`;
}

export function formatSharePrice(value: number): string {
  return `${new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 }).format(value)} Kz`;
}

export function formatChange(changePct: number | null): string {
  if (changePct === null || !Number.isFinite(changePct)) return "—";
  const sign = changePct > 0 ? "+" : "";
  return `${sign}${changePct.toLocaleString("pt-PT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function formatTradeTime(tradedAt: string): string {
  return tradeClock(tradedAt).time ?? "";
}

function readTrades(payload: unknown): TradePoint[] {
  if (!Array.isArray(payload)) return [];
  const trades: TradePoint[] = [];
  for (const entry of payload) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { Data?: unknown; Preco?: unknown };
    const at = typeof row.Data === "string" ? row.Data.trim() : "";
    const clock = tradeClock(at);
    const price = typeof row.Preco === "number" ? row.Preco : Number(row.Preco);
    if (!clock.day || !Number.isFinite(price) || price <= 0) continue;
    trades.push({ at, day: clock.day, time: clock.time, price });
  }
  trades.sort((left, right) => left.at.localeCompare(right.at));
  return trades;
}

function tradeClock(value: string): { day: string; time: string | null } {
  const match = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(value);
  if (!match) return { day: "", time: null };
  return { day: match[1], time: match[2] ? `${match[2]}:${match[3]}` : null };
}

function luandaDay(date: Date): string {
  const parts = luandaParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isSessionOpen(date: Date): boolean {
  const parts = luandaParts(date);
  if (!WEEKDAYS.has(parts.weekday)) return false;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return minutes >= SESSION_OPEN_MINUTES && minutes < SESSION_CLOSE_MINUTES;
}

function luandaParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LUANDA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    weekday: read("weekday"),
  };
}
