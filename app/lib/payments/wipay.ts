type WipayScope = "payment" | "signature";

type WipayConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
};

type CachedToken = { value: string; expiresAt: number };

const tokenCache = new Map<WipayScope, CachedToken>();

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
  const cached = tokenCache.get(scope);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

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
    | { access_token?: unknown; expires_in?: unknown }
    | null;
  if (typeof data?.access_token !== "string" || !data.access_token) {
    console.error("[wipay] token response missing access_token", { scope });
    throw new WipayError("token_missing", "WiPay não devolveu um token de acesso válido.");
  }

  const expiresIn =
    typeof data.expires_in === "number" ? data.expires_in : scope === "payment" ? 3600 : 86400;
  tokenCache.set(scope, {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(30, expiresIn - 60) * 1000,
  });
  return data.access_token;
}

export async function getWipaySignatureToken(): Promise<string> {
  return getAccessToken("signature");
}

export async function createWipayHostedPayment(input: {
  amountKz: number;
  customer: string;
  reference: string;
  successUrl: string;
  failureUrl: string;
  callbackUrl?: string;
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
        callback_url: input.callbackUrl || config.callbackUrl,
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
