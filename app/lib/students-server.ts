import "server-only";

import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "./supabase/admin";
import { parseCeuStudentResponse } from "./ceu-api";

const CEU_API_URL = "https://api.ceu.ao/api/v1/partners/students";
const VERIFICATION_TTL_MS = 30 * 60 * 1000;

export class CeuApiError extends Error {
  constructor(readonly status: number) {
    super(`CEU API request failed with HTTP ${status}`);
    this.name = "CeuApiError";
  }
}

export class CeuRateLimitError extends Error {
  constructor() {
    super("CEU API request limit reached");
    this.name = "CeuRateLimitError";
  }
}

function secret() {
  const value = process.env.STUDENT_VERIFICATION_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new Error("STUDENT_VERIFICATION_SECRET must have at least 32 characters");
  }
  return value;
}

function apiToken() {
  const secretValue = process.env.STUDENT_VERIFICATION_SECRET?.trim();
  if (!secretValue) throw new Error("STUDENT_VERIFICATION_SECRET is not configured");
  const parts = secretValue.split("|");
  if (parts.length !== 2 || !parts[1]) {
    throw new Error("STUDENT_VERIFICATION_SECRET format invalid (expected: id|token)");
  }
  return parts[1];
}

export function studentDiscountEnabled() {
  return process.env.STUDENT_DISCOUNTS_ENABLED === "true";
}

function hash(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

async function reserveCeuStudentValidation(id: string) {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "reserve_ceu_student_validation",
    { p_id: id },
  );
  if (error) throw new Error(`CEU validation reservation failed: ${error.code}`);
  return data === true;
}

async function saveVerifiedStudent(id: string, token: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("ceu_student_verifications")
    .update({
      token_hash: hash(`token:${token}`),
      expires_at: new Date(Date.now() + VERIFICATION_TTL_MS).toISOString(),
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`CEU validation could not be saved: ${error?.code ?? "not_found"}`);
  }
}

export async function verifyCeuStudentCard(cardNumber: string) {
  const token = apiToken();
  secret();

  const id = randomUUID();
  if (!(await reserveCeuStudentValidation(id))) throw new CeuRateLimitError();

  const response = await fetch(
    `${CEU_API_URL}/${encodeURIComponent(cardNumber)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    },
  );

  if (response.status === 404) return null;
  if (response.status !== 200) throw new CeuApiError(response.status);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new CeuApiError(502);
  }

  const student = parseCeuStudentResponse(body);
  if (!student) throw new CeuApiError(502);

  const verificationToken = randomBytes(32).toString("base64url");
  await saveVerifiedStudent(id, verificationToken);
  return { token: verificationToken, student };
}

export async function getVerifiedStudent(token: string): Promise<boolean> {
  if (!studentDiscountEnabled() || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const { data, error } = await createSupabaseAdminClient()
    .from("ceu_student_verifications")
    .select("id")
    .eq("token_hash", hash(`token:${token}`))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error(`CEU verification lookup failed: ${error.code}`);
  return Boolean(data);
}
