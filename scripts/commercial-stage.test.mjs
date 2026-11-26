import assert from "node:assert/strict";
import { test } from "node:test";
import { followUpAfterStageChange, isValidStageChangeReason } from "../app/lib/commercial-stage.ts";

test("requires a nonblank reason when the commercial stage changes", () => {
  assert.equal(isValidStageChangeReason("new_contact", "in_conversation", ""), false);
  assert.equal(isValidStageChangeReason("new_contact", "in_conversation", "Cliente pediu contacto"), true);
});

test("does not require a reason when the stage stays the same and rejects oversized reasons", () => {
  assert.equal(isValidStageChangeReason("in_conversation", "in_conversation", ""), true);
  assert.equal(isValidStageChangeReason("new_contact", "lost", "x".repeat(301)), false);
});

test("clears a due follow-up when the stage changes and the contact time stays the same", () => {
  const dueAt = "2026-11-26T08:16:00.000Z";
  assert.equal(followUpAfterStageChange(dueAt, dueAt, true, true), null);
  assert.equal(followUpAfterStageChange(dueAt, "2026-11-26T08:16:42.000Z", true, true), null);
});

test("keeps a newly chosen next contact and a follow-up that is not due yet", () => {
  const dueAt = "2026-11-26T08:16:00.000Z";
  const nextAt = "2026-11-27T09:00:00.000Z";
  assert.equal(followUpAfterStageChange(dueAt, nextAt, true, true), nextAt);
  assert.equal(followUpAfterStageChange(nextAt, nextAt, true, false), nextAt);
  assert.equal(followUpAfterStageChange(dueAt, dueAt, false, true), dueAt);
});
