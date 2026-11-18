import {
  claimWipaySignatureTokenRefresh,
  readWipaySignatureToken,
  releaseWipaySignatureTokenRefresh,
  saveWipaySignatureToken,
} from "./wipay-signature-token-store";

type WipayScope = "payment" | "signature";

type WipayConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
};

type CachedToken = { value: string; expiresAt: number };

let paymentTokenCache: CachedToken | null = null;

export class WipayError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function isWipayConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(
    env.WIPAY_CLIENT_ID?.trim() &&
      env.WIPAY_CLIENT_SECRET?.trim() &&
      env.WIPAY_CALLBACK_URL?.trim(),
  );
}

function getConfig(env: NodeJS.ProcessEnv = process.env): WipayConfig {
  const clientId = env.WIPAY_CLIENT_ID?.trim();
  const clientSecret = env.WIPAY_CLIENT_SECRET?.trim();
  const callbackUrl = env.WIPAY_CALLBACK_URL?.trim();
  if (!clientId || !clientSecret || !callbackUrl) {
    throw new WipayError("config_missing", "WiPay não está configurada no servidor.");
  }

  return {
    baseUrl: (env.WIPAY_BASE_URL?.trim() || "https://api.wipay.ao").replace(/\/$/, ""),
    clientId,
    clientSecret,
    callbackUrl,
  };
}

async function getAccessToken(scope: WipayScope): Promise<string> {
  const cached = scope === "payment" ? paymentTokenCache : null;
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  const token = await issueAccessToken(scope);
  if (scope === "payment") {
    paymentTokenCache = token;
  }
  return token.value;
}

async function issueAccessToken(scope: WipayScope): Promise<CachedToken> {
  const config = getConfig();
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/v1/credentials/token`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope,
      }),
      cache: "no-store",
    });
  } catch {
    throw new WipayError("token_network", "Não foi possível contactar a WiPay.");
  }

  if (!response.ok) {
    console.error("[wipay] token request failed", { scope, httpStatus: response.status });
    throw new WipayError(
      `token_http_${response.status}`,
      `WiPay token request failed (${response.status}).`,
    );
  }

  const data = (await response.json().catch(() => null)) as
    | { access_token?: unknown; expires_in?: unknown; scope?: unknown }
    | null;
  if (typeof data?.access_token !== "string" || !data.access_token) {
    console.error("[wipay] token response missing access_token", { scope });
    throw new WipayError("token_missing", "WiPay não devolveu um token de acesso válido.");
  }

  const expiresIn =
    typeof data.expires_in === "number" ? data.expires_in : scope === "payment" ? 3600 : 86400;
  if (data.scope !== undefined && data.scope !== scope) {
    throw new WipayError(
      "token_scope_mismatch",
      "WiPay devolveu um token com scope diferente do solicitado.",
    );
  }
  return {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(30, expiresIn - 60) * 1000,
  };
}

export async function getWipaySignatureToken(): Promise<string> {
  const { clientSecret } = getConfig();
  const cached = await readWipaySignatureToken(clientSecret);
  if (!cached) {
    throw new WipayError(
      "signature_token_not_primed",
      "O token WiPay signature não foi preparado antes do callback.",
    );
  }
  console.info("[wipay] shared signature access token reused", {
    cache: "shared",
    expiresInSeconds: Math.floor((cached.expiresAt - Date.now()) / 1000),
  });
  return cached.value;
}

export async function ensureWipaySignatureToken(): Promise<void> {
  const config = getConfig();
  const cached = await readWipaySignatureToken(config.clientSecret);
  if (cached) {
    console.info("[wipay] shared signature access token reused before charge", {
      cache: "shared",
      expiresInSeconds: Math.floor((cached.expiresAt - Date.now()) / 1000),
    });
    return;
  }

  const claimed = await claimWipaySignatureTokenRefresh();
  if (!claimed) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (await readWipaySignatureToken(config.clientSecret)) return;
    }

    throw new WipayError(
      "signature_token_refresh_busy",
      "O token WiPay signature está a ser renovado; tente novamente.",
    );
  }

  try {
    const token = await issueAccessToken("signature");
    await saveWipaySignatureToken(
      token.value,
      token.expiresAt,
      config.clientSecret,
    );
    console.info("[wipay] shared signature access token prepared", {
      requestedScope: "signature",
      cache: "shared",
      expiresInSeconds: Math.floor((token.expiresAt - Date.now()) / 1000),
    });
  } catch (error) {
    await releaseWipaySignatureTokenRefresh();
    throw error;
  }
}

export async function createWipayHostedPayment(input: {
  amountKz: number;
  customer: string;
  reference: string;
  successUrl: string;
  failureUrl: string;
}): Promise<{ checkoutUrl: string }> {
  const config = getConfig();
  const token = await getAccessToken("payment");
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/v1/hosts/payments`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: String(input.amountKz),
        currency: "aoa",
        customer: input.customer,
        reference_id: input.reference,
        callback_url: config.callbackUrl,
        success_url: input.successUrl,
        failure_url: input.failureUrl,
      }),
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    throw new WipayError("payment_network", "Não foi possível contactar a WiPay.");
  }

  if (response.status !== 303) {
    console.error("[wipay] payment request failed", {
      reference: input.reference,
      httpStatus: response.status,
    });
    throw new WipayError(
      `payment_http_${response.status}`,
      `WiPay payment request failed (${response.status}).`,
    );
  }

  const location = response.headers.get("location");
  if (!location) {
    throw new WipayError("location_missing", "WiPay não devolveu o URL de pagamento.");
  }

  let checkoutUrl: URL;
  try {
    checkoutUrl = new URL(location);
  } catch {
    throw new WipayError("location_invalid", "WiPay devolveu um URL de pagamento inválido.");
  }

  const allowedHosts = new Set(["hosted.wipay.ao", "pay.wiza.ao"]);
  if (checkoutUrl.protocol !== "https:" || !allowedHosts.has(checkoutUrl.hostname)) {
    console.error("[wipay] hosted checkout destination rejected", {
      reference: input.reference,
      hostname: checkoutUrl.hostname,
    });
    throw new WipayError("location_untrusted", "WiPay devolveu um destino de pagamento não permitido.");
  }

  return { checkoutUrl: checkoutUrl.toString() };
}
