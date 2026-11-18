import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
import { createSupabaseAdminClient } from "../supabase/admin";

type StoredToken = {
  value: string;
  expiresAt: number;
};

type EncryptedToken = {
  encrypted_token: string;
  encryption_iv: string;
  encryption_tag: string;
  expires_at: string;
  refresh_lock_expires_at: string | null;
};

function getEncryptionKey(clientSecret: string) {
  return createHmac("sha256", clientSecret)
    .update("kitadi:wipay:signature-token-cache:v1")
    .digest();
}

function encryptToken(token: string, clientSecret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(clientSecret), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return {
    encrypted_token: encrypted.toString("base64"),
    encryption_iv: iv.toString("base64"),
    encryption_tag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptToken(row: EncryptedToken, clientSecret: string) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(clientSecret),
    Buffer.from(row.encryption_iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(row.encryption_tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(row.encrypted_token, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export async function readWipaySignatureToken(
  clientSecret: string,
): Promise<StoredToken | null> {
  const { data, error } = await createSupabaseAdminClient()
    .from("wipay_signature_token_cache")
    .select(
      "encrypted_token,encryption_iv,encryption_tag,expires_at,refresh_lock_expires_at",
    )
    .eq("id", true)
    .maybeSingle();

  if (error) {
    console.error("[wipay] shared signature token lookup failed", {
      code: error.code ?? "unknown",
    });
    throw new Error("WiPay signature token cache is unavailable.");
  }
  if (
    !data ||
    typeof data.encrypted_token !== "string" ||
    typeof data.encryption_iv !== "string" ||
    typeof data.encryption_tag !== "string" ||
    typeof data.expires_at !== "string"
  ) {
    return null;
  }

  const expiresAt = Date.parse(data.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() + 60_000) {
    return null;
  }

  try {
    return {
      value: decryptToken(data as EncryptedToken, clientSecret),
      expiresAt,
    };
  } catch {
    console.error("[wipay] shared signature token could not be decrypted", {
      reason: "encryption_key_mismatch",
    });
    return null;
  }
}

export async function claimWipaySignatureTokenRefresh() {
  const now = new Date();
  const lockExpiresAt = new Date(now.getTime() + 30_000).toISOString();
  const { data, error } = await createSupabaseAdminClient()
    .from("wipay_signature_token_cache")
    .update({ refresh_lock_expires_at: lockExpiresAt })
    .eq("id", true)
    .or(`refresh_lock_expires_at.is.null,refresh_lock_expires_at.lt.${now.toISOString()}`)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[wipay] shared signature token lock failed", {
      code: error.code ?? "unknown",
    });
    throw new Error("WiPay signature token cache is unavailable.");
  }

  return Boolean(data);
}

export async function saveWipaySignatureToken(
  token: string,
  expiresAt: number,
  clientSecret: string,
) {
  const { error } = await createSupabaseAdminClient()
    .from("wipay_signature_token_cache")
    .update({
      ...encryptToken(token, clientSecret),
      expires_at: new Date(expiresAt).toISOString(),
      refresh_lock_expires_at: null,
    })
    .eq("id", true);

  if (error) {
    console.error("[wipay] shared signature token save failed", {
      code: error.code ?? "unknown",
    });
    throw new Error("WiPay signature token cache is unavailable.");
  }
}

export async function releaseWipaySignatureTokenRefresh() {
  const { error } = await createSupabaseAdminClient()
    .from("wipay_signature_token_cache")
    .update({ refresh_lock_expires_at: null })
    .eq("id", true);

  if (error) {
    console.error("[wipay] shared signature token lock release failed", {
      code: error.code ?? "unknown",
    });
  }
}
