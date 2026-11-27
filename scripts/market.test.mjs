import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aoaRatesFromBna,
  formatChange,
  quoteFromTrades,
  sessionForTrade,
} from "../app/lib/market-model.ts";

const bnaRows = [
  { date: "2026-11-25", base: "EUR", quote: "AOA", rate: 900 },
  { date: "2026-11-26", base: "EUR", quote: "AOA", rate: 1001.7437 },
  { date: "2026-11-26", base: "EUR", quote: "USD", rate: 1.0972 },
  { date: "2026-11-26", base: "EUR", quote: "ZAR", rate: 19.2946 },
  { date: "2026-11-26", base: "USD", quote: "AOA", rate: 1 },
];

test("BNA rates become kwanzas per dollar, euro and rand", () => {
  const board = aoaRatesFromBna(bnaRows);
  assert.ok(board);
  assert.equal(board.date, "2026-11-26");
  assert.equal(board.rates[0].code, "USD");
  assert.ok(Math.abs(board.rates[0].aoa - 1001.7437 / 1.0972) < 0.0001);
  assert.equal(board.rates[1].aoa, 1001.7437);
  assert.ok(Math.abs(board.rates[2].aoa - 1001.7437 / 19.2946) < 0.0001);
});

test("the share change uses the previous session close", () => {
  const quote = quoteFromTrades({ symbol: "BAI", name: "Banco BAI" }, [
    { Data: "2026-11-26 14:39:17", Preco: 93900 },
    { Data: "2026-11-27 09:10:00", Preco: 93200 },
    { Data: "2026-11-27 13:17:25", Preco: 93000 },
  ]);
  assert.ok(quote);
  assert.equal(quote.price, 93000);
  assert.equal(quote.change, 93000 - 93900);
  assert.ok(quote.changePct !== null && Math.abs(quote.changePct - ((93000 - 93900) / 93900) * 100) < 0.0001);
  assert.equal(formatChange(quote.changePct), "-1,0%");
});

test("the session label follows the Luanda clock and the last trade", () => {
  const during = sessionForTrade(new Date("2026-11-27T13:17:00+01:00"), "2026-11-27 13:17:25");
  assert.equal(during.open, true);
  assert.equal(during.label, "Última cotação às 13:17");

  const afterClose = sessionForTrade(new Date("2026-11-27T16:00:00+01:00"), "2026-11-27 13:17:25");
  assert.equal(afterClose.open, false);
  assert.equal(afterClose.label, "Última sessão às 13:17");

  const nextMorning = sessionForTrade(new Date("2026-11-30T10:00:00+01:00"), "2026-11-27 13:17:25");
  assert.equal(nextMorning.open, false);
  assert.match(nextMorning.label, /^Última sessão de 27 de novembro$/);
});
