import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidStageChangeReason } from "../app/lib/commercial-stage.ts";

test("requires a nonblank reason when the commercial stage changes", () => {
  assert.equal(isValidStageChangeReason("new_contact", "in_conversation", ""), false);
  assert.equal(isValidStageChangeReason("new_contact", "in_conversation", "Cliente pediu contacto"), true);
});

test("does not require a reason when the stage stays the same and rejects oversized reasons", () => {
  assert.equal(isValidStageChangeReason("in_conversation", "in_conversation", ""), true);
  assert.equal(isValidStageChangeReason("new_contact", "lost", "x".repeat(301)), false);
});
