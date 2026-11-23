import "server-only";

import { createSupabaseAdminClient } from "../supabase/admin";
import { throwDatabaseError } from "./orders";

export type Withdrawal = {
  id: string;
  amountKz: number;
  withdrawnAt: string;
  providerReference: string;
  status: "active" | "voided";
  voidReason: string | null;
  voidedAt: string | null;
  reconciledAt: string | null;
  createdAt: string;
};

function fromDatabase(row: Record<string, unknown>): Withdrawal {
  return {
    id: row.id as string,
    amountKz: row.amount_kz as number,
    withdrawnAt: row.withdrawn_at as string,
    providerReference: row.provider_reference as string,
    status: row.status as Withdrawal["status"],
    voidReason: typeof row.void_reason === "string" ? row.void_reason : null,
    voidedAt: typeof row.voided_at === "string" ? row.voided_at : null,
    reconciledAt: typeof row.reconciled_at === "string" ? row.reconciled_at : null,
    createdAt: row.created_at as string,
  };
}

export class DuplicateWithdrawalReferenceError extends Error {
  constructor() {
    super("Já existe um levantamento activo com esta referência.");
    this.name = "DuplicateWithdrawalReferenceError";
  }
}

export async function listWithdrawals(limit = 100) {
  const { data, error } = await createSupabaseAdminClient()
    .from("wipay_withdrawals")
    .select("*")
    .order("withdrawn_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throwDatabaseError("listing withdrawals", error);
  return (data ?? []).map((row) => fromDatabase(row));
}

export async function createWithdrawal(input: {
  amountKz: number;
  withdrawnAt: string;
  providerReference: string;
  createdBy: string;
}) {
  const { data, error } = await createSupabaseAdminClient()
    .from("wipay_withdrawals")
    .insert({
      amount_kz: input.amountKz,
      withdrawn_at: input.withdrawnAt,
      provider_reference: input.providerReference,
      created_by: input.createdBy,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") throw new DuplicateWithdrawalReferenceError();
    throwDatabaseError("creating withdrawal", error);
  }
  return fromDatabase(data as Record<string, unknown>);
}

export async function setWithdrawalReconciled(
  id: string,
  reconciled: boolean,
  userId: string,
) {
  const { data, error } = await createSupabaseAdminClient()
    .from("wipay_withdrawals")
    .update({
      reconciled_at: reconciled ? new Date().toISOString() : null,
      reconciled_by: reconciled ? userId : null,
    })
    .eq("id", id)
    .eq("status", "active")
    .select("*")
    .maybeSingle();

  if (error) throwDatabaseError("reconciling withdrawal", error);
  return data ? fromDatabase(data) : null;
}

export async function voidWithdrawal(id: string, reason: string, userId: string) {
  const { data, error } = await createSupabaseAdminClient()
    .from("wipay_withdrawals")
    .update({
      status: "voided",
      void_reason: reason,
      voided_at: new Date().toISOString(),
      voided_by: userId,
    })
    .eq("id", id)
    .eq("status", "active")
    .select("*")
    .maybeSingle();

  if (error) throwDatabaseError("voiding withdrawal", error);
  return data ? fromDatabase(data) : null;
}
