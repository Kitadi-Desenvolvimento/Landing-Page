import test from "node:test";
import assert from "node:assert/strict";
import {
  canAlignObjective,
  objectivePeriodEnd,
  objectivePeriodStart,
  reportDateRange,
} from "../app/lib/objective-periods.ts";

test("normalizes period anchors and permits only direct hierarchy alignment", () => {
  assert.equal(objectivePeriodStart("weekly", "2026-11-25"), "2026-11-23");
  assert.equal(objectivePeriodEnd("monthly", "2026-11-01"), "2026-12-01");
  assert.equal(canAlignObjective("daily", "weekly"), true);
  assert.equal(canAlignObjective("daily", "annual"), false);
});

test("reports cover the selected local day, week, or month", () => {
  assert.deepEqual(reportDateRange("day", "2026-11-25"), {
    fromDate: "2026-11-25",
    toDate: "2026-11-26",
    from: "2026-11-24T23:00:00.000Z",
    to: "2026-11-25T23:00:00.000Z",
  });
  assert.equal(reportDateRange("week", "invalid"), null);
});
