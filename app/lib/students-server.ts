import "server-only";

import { createHmac, randomBytes, randomInt, randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "./supabase/admin";

export type Student = { name: string; email: string; phone: string };

function secret() {
  const value = process.env.STUDENT_VERIFICATION_SECRET?.trim();
  if (!value || value.length < 32) throw new Error("STUDENT_VERIFICATION_SECRET must have at least 32 characters");
  return value;
}

export function studentDiscountEnabled() {
  return process.env.STUDENT_DISCOUNTS_ENABLED === "true";
}

function hash(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function normalizeStudentIdentifier(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  const phone = trimmed.replace(/[\s()+-]/g, "");
  return /^2449\d{8}$/.test(phone) ? phone.slice(3) : phone;
}

function mockStudents(): Student[] {
  const json = process.env.STUDENT_MOCK_DATA;
  if (!json) throw new Error("STUDENT_MOCK_DATA is not configured");
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error("STUDENT_MOCK_DATA must be an array");
  const students: Student[] = [];
  const identifiers = new Set<string>();
  for (const entry of data) {
    if (
      typeof entry !== "object" || entry === null ||
      typeof entry.name !== "string" || !entry.name.trim() || entry.name.trim().length > 120 ||
      typeof entry.email !== "string" || entry.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email.trim()) ||
      typeof entry.phone !== "string" || !/^\+?[0-9 ]{9,17}$/.test(entry.phone.trim()) ||
      !/^\d{9,15}$/.test(normalizeStudentIdentifier(entry.phone))
    ) throw new Error("Invalid student in STUDENT_MOCK_DATA");
    const student = { name: entry.name.trim(), email: entry.email.trim().toLowerCase(), phone: entry.phone.trim() };
    for (const id of [normalizeStudentIdentifier(student.email), normalizeStudentIdentifier(student.phone)]) {
      if (identifiers.has(id)) throw new Error("Duplicate identifier in STUDENT_MOCK_DATA");
      identifiers.add(id);
    }
    students.push(student);
  }
  return students;
}

async function sendVerificationEmail(email: string, code: string, id: string) {
  const apiKey = process.env.BIRD_API_KEY?.trim();
  if (!apiKey) throw new Error("BIRD_API_KEY is not configured");
  const host = apiKey.startsWith("bk_eu1_") ? "https://eu1.platform.bird.com" : "https://us1.platform.bird.com";
  const text = `O seu código de verificação Kitadi é ${code}. Expira em 10 minutos. Não partilhe este código.`;
  const response = await fetch(`${host}/v1/email/messages`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Idempotency-Key": `student-verification-${id}`,
    },
    body: JSON.stringify({
      from: { email: process.env.BIRD_FROM_EMAIL?.trim() || "comercial@kitadi.co.ao", name: process.env.BIRD_FROM_NAME?.trim() || "Kitadi" },
      to: [email],
      subject: "Código de verificação de aluno — Kitadi",
      text,
      html: `<p>O seu código de verificação Kitadi é <strong>${code}</strong>.</p><p>Expira em 10 minutos. Não partilhe este código.</p>`,
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Bird email failed (${response.status})`);
}

export async function startStudentVerification(identifier: string, ip: string) {
  const normalized = normalizeStudentIdentifier(identifier);
  const student = mockStudents().find((item) =>
    [item.email, item.phone].some((value) => normalizeStudentIdentifier(value) === normalized),
  );
  const id = randomUUID();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { data, error } = await createSupabaseAdminClient().rpc("start_student_verification", {
    p_id: id,
    p_identifier_hash: hash(`id:${normalized}`),
    p_ip_hash: hash(`ip:${ip}`),
    p_code_hash: hash(`code:${id}:${code}`),
    p_name: student?.name ?? null,
    p_email: student?.email ?? null,
    p_phone: student?.phone ?? null,
  });
  if (error) throw new Error(`Student verification start failed: ${error.code}`);
  if (!data) return null;
  if (student) await sendVerificationEmail(student.email, code, id);
  return id;
}

export async function verifyStudentCode(id: string, code: string) {
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await createSupabaseAdminClient().rpc("verify_student_code", {
    p_id: id,
    p_code_hash: hash(`code:${id}:${code}`),
    p_token_hash: hash(`token:${token}`),
  });
  if (error) throw new Error(`Student verification failed: ${error.code}`);
  const row = data?.[0];
  if (!row) return null;
  if (typeof row.student_name !== "string" || typeof row.student_email !== "string" || typeof row.student_phone !== "string") {
    throw new Error("Student verification returned invalid data");
  }
  return { token, student: { name: row.student_name, email: row.student_email, phone: row.student_phone } };
}

export async function getVerifiedStudent(token: string): Promise<Student | null> {
  if (!studentDiscountEnabled() || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const { data, error } = await createSupabaseAdminClient()
    .from("student_verification_requests")
    .select("student_name,student_email,student_phone")
    .eq("token_hash", hash(`token:${token}`))
    .not("verified_at", "is", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(`Student verification lookup failed: ${error.code}`);
  if (!data || !data.student_name || !data.student_email || !data.student_phone) return null;
  return { name: data.student_name, email: data.student_email, phone: data.student_phone };
}
