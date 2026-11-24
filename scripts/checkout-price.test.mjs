import assert from "node:assert/strict";
import { test } from "node:test";
import { courses, maxProductPriceKz, offersCheckout, offersPublicCheckout } from "../app/course-data.ts";

test("simple products can be purchased at and above 100,000 Kz", () => {
  for (const priceAmount of [99_999, 100_000, 100_001, 500_000, maxProductPriceKz]) {
    assert.equal(offersPublicCheckout({ checkoutEnabled: true, priceAmount }), true);
  }
});

test("course variants also accept prices at and above 100,000 Kz", () => {
  const original = courses.find((course) => course.variants.length > 0);
  assert.ok(original);
  const course = {
    ...original,
    priceAmount: 100_000,
    variants: [{ ...original.variants[0], priceAmount: 150_000 }],
  };
  assert.equal(offersCheckout(course), true);
  assert.equal(offersPublicCheckout({ checkoutEnabled: true, course }), true);
  assert.equal(offersCheckout({ ...course, variants: [{ ...course.variants[0], priceAmount: 0 }] }), false);
  assert.equal(offersPublicCheckout({ checkoutEnabled: false, course }), false);
});

test("checkout continues to reject invalid and unsupported amounts", () => {
  for (const priceAmount of [0, -1, 1.5, maxProductPriceKz + 1, NaN]) {
    assert.equal(offersPublicCheckout({ checkoutEnabled: true, priceAmount }), false);
  }
  assert.equal(offersPublicCheckout({ checkoutEnabled: true }), false);
});
