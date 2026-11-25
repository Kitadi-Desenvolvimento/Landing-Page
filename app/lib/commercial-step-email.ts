import "server-only";

import { personLabel } from "./person-label";

type SendResult = { ok: true } | { ok: false; reason: string };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendCommercialStepEmail(input: {
  noticeKey: string;
  email: string;
  displayName: string;
  title: string;
  contactName: string;
  stageLabel: string;
  days: number;
  stageDue: boolean;
  followDue: boolean;
  nextStep: string;
}): Promise<SendResult> {
  const apiKey = process.env.BIRD_API_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "bird_api_key_missing" };
  if (!input.email.trim()) return { ok: false, reason: "email_missing" };

  const name = personLabel(input.displayName, input.email);
  const subject = `Próximo passo na oportunidade ${input.title}`;
  const stay = `A oportunidade «${input.title}», do contacto ${input.contactName || "sem nome"}, está em ${input.stageLabel} há ${input.days} ${input.days === 1 ? "dia" : "dias"}.`;
  const follow = "O seguimento marcado já passou da hora.";
  const lines = [
    `Olá, ${name}.`,
    "",
    stay,
    input.stageDue ? input.nextStep : "",
    input.followDue ? follow : "",
    input.stageDue ? "" : input.nextStep,
    "",
    "Abra o comercial no backoffice e dê este passo.",
  ].filter((line, index, all) => line !== "" || all[index - 1] !== "");
  const text = lines.join("\n");
  const html = [
    `<p>Olá, ${escapeHtml(name)}.</p>`,
    `<p>${escapeHtml(stay)}</p>`,
    input.stageDue ? `<p>${escapeHtml(input.nextStep)}</p>` : "",
    input.followDue ? `<p>${escapeHtml(follow)}</p>` : "",
    input.stageDue ? "" : `<p>${escapeHtml(input.nextStep)}</p>`,
    "<p>Abra o comercial no backoffice e dê este passo.</p>",
  ].join("");
  const host = apiKey.startsWith("bk_eu1_")
    ? "https://eu1.platform.bird.com"
    : "https://us1.platform.bird.com";
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 10_000);
  try {
    const response = await fetch(`${host}/v1/email/messages`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Idempotency-Key": `kitadi-step-${input.noticeKey}`,
      },
      body: JSON.stringify({
        from: {
          email: process.env.BIRD_FROM_EMAIL?.trim() || "comercial@kitadi.co.ao",
          name: process.env.BIRD_FROM_NAME?.trim() || "Kitadi",
        },
        to: [input.email],
        subject,
        html,
        text,
      }),
      signal: abortController.signal,
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, reason: `bird_http_${response.status}` };
    return { ok: true };
  } catch {
    return { ok: false, reason: "bird_request_failed" };
  } finally {
    clearTimeout(timeout);
  }
}
