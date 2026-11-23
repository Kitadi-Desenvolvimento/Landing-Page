import assert from "node:assert/strict";
import { test } from "node:test";
import { studentDiscountedAmount, studentDiscountPercent } from "../app/lib/student-discount.ts";

test("applies 15% below 50,000 Kz and 25% from 50,000 Kz", () => {
  assert.equal(studentDiscountPercent(49_999), 15);
  assert.equal(studentDiscountedAmount(40_000), 34_000);
  assert.equal(studentDiscountPercent(50_000), 25);
  assert.equal(studentDiscountedAmount(50_000), 37_500);
  assert.equal(studentDiscountedAmount(60_000), 45_000);
});

test("rounds fractional kwanzas consistently", () => {
  assert.equal(studentDiscountedAmount(49_999), 42_499);
});
