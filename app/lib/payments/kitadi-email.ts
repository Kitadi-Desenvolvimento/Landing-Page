import type { KitadiOrder } from "./orders";

type BirdSendResult =
  | { ok: true; messageId: string }
  | { ok: false; reason: string };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatKz(amountKz: number) {
  return `${new Intl.NumberFormat("pt-AO").format(amountKz)} Kz`;
}

function formatPaidAt(value: string | null) {
  if (!value) return "Confirmado pela WiPay";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Confirmado pela WiPay";
  return new Intl.DateTimeFormat("pt-AO", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function getBirdHost(apiKey: string) {
  return apiKey.startsWith("bk_eu1_")
    ? "https://eu1.platform.bird.com"
    : "https://us1.platform.bird.com";
}

export function buildPaymentEmail(order: KitadiOrder) {
  const name = escapeHtml(order.name);
  const product = escapeHtml(order.productTitle);
  const variant = escapeHtml(order.variantLabel);
  const reference = escapeHtml(order.reference);
  const edition = order.edition ? escapeHtml(order.edition) : "";
  const amount = escapeHtml(formatKz(order.amountKz));
  const paidAt = escapeHtml(formatPaidAt(order.paidAt));

  const subject = `Pagamento confirmado — ${order.productTitle}`;
  const text = [
    `Olá, ${order.name}!`,
    "",
    "O seu pagamento foi confirmado pela Kitadi.",
    "",
    `Produto: ${order.productTitle}`,
    `Variante: ${order.variantLabel}`,
    edition ? `Edição: ${order.edition}` : "",
    `Valor: ${formatKz(order.amountKz)}`,
    `Referência: ${order.reference}`,
    `Confirmado em: ${formatPaidAt(order.paidAt)}`,
    "",
    "Guarde esta referência. Ela é o seu ticket de compra.",
    "",
    "Dúvidas ou apoio:",
    "+244 936 250 151",
    "+244 945 178 042",
    "",
    "Com os melhores cumprimentos,",
    "Equipa Kitadi",
  ].filter((line) => line !== "").join("\n");

  const html = `<!doctype html>
<html lang="pt">
  <body style="margin:0;background:#f5f2f1;font-family:Arial,sans-serif;color:#211d1e;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f2f1;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e7e1df;">
            <tr>
              <td style="background:linear-gradient(110deg,#510f1d,#28070d);padding:34px 38px;text-align:center;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#cda45c;">Kitadi</p>
                <h1 style="margin:0;font-size:28px;line-height:1.2;color:#ffffff;">Pagamento confirmado</h1>
                <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#f1e7e8;">Estamos felizes por dar este próximo passo consigo.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 38px;">
                <p style="margin:0;font-size:16px;line-height:1.7;">Olá, <strong>${name}</strong>.</p>
                <p style="margin:12px 0 24px;font-size:15px;line-height:1.7;color:#716a69;">A sua compra foi confirmada com sucesso. Guarde o ticket abaixo — ele será útil para identificar a sua inscrição e receber apoio da nossa equipa.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e7e1df;border-radius:18px;">
                  <tr><td style="padding:18px;border-bottom:1px solid #eee8e5;color:#716a69;font-size:13px;">Produto</td><td style="padding:18px;border-bottom:1px solid #eee8e5;text-align:right;font-weight:700;font-size:14px;">${product}</td></tr>
                  <tr><td style="padding:18px;border-bottom:1px solid #eee8e5;color:#716a69;font-size:13px;">Variante</td><td style="padding:18px;border-bottom:1px solid #eee8e5;text-align:right;font-weight:700;font-size:14px;">${variant}</td></tr>
                  ${edition ? `<tr><td style="padding:18px;border-bottom:1px solid #eee8e5;color:#716a69;font-size:13px;">Edição</td><td style="padding:18px;border-bottom:1px solid #eee8e5;text-align:right;font-weight:700;font-size:14px;">${edition}</td></tr>` : ""}
                  <tr><td style="padding:18px;border-bottom:1px solid #eee8e5;color:#716a69;font-size:13px;">Valor pago</td><td style="padding:18px;border-bottom:1px solid #eee8e5;text-align:right;font-weight:700;font-size:14px;color:#510f1d;">${amount}</td></tr>
                  <tr><td style="padding:18px;border-bottom:1px solid #eee8e5;color:#716a69;font-size:13px;">Confirmação</td><td style="padding:18px;border-bottom:1px solid #eee8e5;text-align:right;font-size:13px;">${paidAt}</td></tr>
                  <tr><td style="padding:18px;color:#716a69;font-size:13px;">Ticket / referência</td><td style="padding:18px;text-align:right;"><strong style="display:inline-block;padding:8px 10px;border-radius:8px;background:#f7efe0;color:#510f1d;font-size:14px;letter-spacing:1px;">${reference}</strong></td></tr>
                </table>
                <p style="margin:24px 0 8px;font-size:15px;line-height:1.7;color:#716a69;">Se precisar de ajuda, a nossa equipa terá todo o gosto em atender-lhe.</p>
                <p style="margin:0;font-size:15px;line-height:1.8;"><a href="tel:+244936250151" style="color:#510f1d;font-weight:700;text-decoration:none;">+244 936 250 151</a><br/><a href="tel:+244945178042" style="color:#510f1d;font-weight:700;text-decoration:none;">+244 945 178 042</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 38px;background:#faf9f8;text-align:center;font-size:12px;line-height:1.6;color:#918783;">Com carinho e profissionalismo,<br/><strong style="color:#510f1d;">Equipa Kitadi</strong></td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

export async function sendKitadiPaymentEmail(order: KitadiOrder): Promise<BirdSendResult> {
  const apiKey = process.env.BIRD_API_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "bird_api_key_missing" };
  if (!order.email.trim()) return { ok: false, reason: "customer_email_missing" };

  const { subject, text, html } = buildPaymentEmail(order);
  const senderEmail = process.env.BIRD_FROM_EMAIL?.trim() || "onboarding@messagebird.dev";
  const senderName = process.env.BIRD_FROM_NAME?.trim() || "Kitadi";
  const host = getBirdHost(apiKey);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 10_000);

  try {
    const response = await fetch(`${host}/v1/email/messages`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Idempotency-Key": `kitadi-payment-${order.reference}`,
      },
      body: JSON.stringify({
        from: { email: senderEmail, name: senderName },
        to: [order.email],
        subject,
        html,
        text,
      }),
      signal: abortController.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const responseBody = (await response.text().catch(() => "")).slice(0, 300);
      console.error("[payments] Bird email send failed", {
        reference: order.reference,
        httpStatus: response.status,
        responseBody,
      });
      return { ok: false, reason: `bird_http_${response.status}` };
    }

    const data = (await response.json().catch(() => null)) as
      | { id?: unknown }
      | null;
    return {
      ok: true,
      messageId: typeof data?.id === "string" ? data.id : "",
    };
  } catch (error) {
    console.error("[payments] Bird email request failed", {
      reference: order.reference,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, reason: "bird_request_failed" };
  } finally {
    clearTimeout(timeout);
  }
}
