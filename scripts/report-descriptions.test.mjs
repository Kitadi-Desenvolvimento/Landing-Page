import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeCommercialEvent,
  describeObjectiveChange,
  describeObjectiveProgress,
} from "../app/lib/report-descriptions.ts";

test("commercial stage narratives include the transition and recorded reason", () => {
  assert.equal(describeCommercialEvent({
    eventType: "stage_changed",
    fromStage: "new_contact",
    toStage: "in_conversation",
    paymentStatus: null,
    details: "Motivo da mudança: Pediu proposta",
  }, "Ana · Formação"), "A oportunidade «Ana · Formação» passou de «Novo contacto» para «Em conversa». Motivo indicado: Pediu proposta");
});

test("commercial narratives explain automatic changes and legacy missing reasons", () => {
  const commonEvent = {
    eventType: "stage_changed",
    fromStage: "proposal_sent",
    toStage: "converted",
    paymentStatus: null,
  };
  assert.match(describeCommercialEvent({
    ...commonEvent,
    details: "Motivo da mudança: Pagamento confirmado automaticamente.",
  }, "Ana · Formação"), /pagamento ser confirmado automaticamente/);
  assert.match(describeCommercialEvent({
    ...commonEvent,
    details: "",
  }, "Ana · Formação"), /Não foi guardada uma explicação/);
});

test("objective narratives explain check-ins, corrections, and lifecycle changes", () => {
  assert.equal(describeObjectiveProgress({
    title: "Novas vendas",
    scope: "no departamento Comercial",
    value: "3",
    note: "Contactos concluídos",
  }), "Foi registado progresso no objectivo «Novas vendas», no departamento Comercial. Valor registado: 3. Observação: Contactos concluídos");
  assert.equal(describeObjectiveProgress({
    title: "Novas vendas",
    scope: "",
    value: "2",
    note: "",
    previous: true,
    currentValue: "3",
  }), "O registo de progresso no objectivo «Novas vendas» foi corrigido. O valor passou de «2» para «3».");
  assert.equal(describeObjectiveChange("archived", "Novas vendas", "no departamento Comercial"), "O objectivo «Novas vendas», no departamento Comercial, foi arquivado e deixou de estar activo.");
});
