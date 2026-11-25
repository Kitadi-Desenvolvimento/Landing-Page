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

export async function sendBlockEmail(input: {
  blockId: string;
  userId: string;
  email: string;
  displayName: string;
  subjectTitle: string;
  subjectKind: "objectivo" | "oportunidade";
  reason: string;
}): Promise<SendResult> {
  const apiKey = process.env.BIRD_API_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "bird_api_key_missing" };
  if (!input.email.trim()) return { ok: false, reason: "email_missing" };

  const name = personLabel(input.displayName, input.email);
  const title = input.subjectTitle;
  const subject = `Está a bloquear um ${input.subjectKind} da Kitadi`;
  const text = [
    `Olá, ${name}.`,
    "",
    `Foi indicado como bloqueio em ${title}.`,
    "",
    `Motivo: ${input.reason}`,
    "",
    "Abra o backoffice, resolva o ponto e peça para retirarem o bloqueio.",
  ].join("\n");
  const html = `<p>Olá, ${escapeHtml(name)}.</p><p>Foi indicado como bloqueio em <strong>${escapeHtml(title)}</strong>.</p><p>Motivo: ${escapeHtml(input.reason)}</p><p>Abra o backoffice, resolva o ponto e peça para retirarem o bloqueio.</p>`;
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
        "Idempotency-Key": `kitadi-block-${input.blockId}-${input.userId}`,
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
