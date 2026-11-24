import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCeuStudentResponse } from "../app/lib/ceu-api.ts";

test("parses the documented CEU validation response", () => {
  assert.deepEqual(
    parseCeuStudentResponse({
      success: true,
      message: "Estudante CEU validado com sucesso.",
      data: { card_number: "CEU-123", name: "Nome do Estudante" },
    }),
    { cardNumber: "CEU-123", name: "Nome do Estudante" },
  );
});

test("rejects unsuccessful or incomplete CEU responses", () => {
  assert.equal(parseCeuStudentResponse({ success: false, data: {} }), null);
  assert.equal(parseCeuStudentResponse({ success: true, data: { name: "Estudante" } }), null);
  assert.equal(
    parseCeuStudentResponse({ success: true, data: { card_number: "CEU-123", name: " " } }),
    null,
  );
});
