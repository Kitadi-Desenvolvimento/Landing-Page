import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isStaffSchemaMissing } from "./staff-profiles";

type Admin = SupabaseClient;
type CheckinRow = {
  id: string;
  objective_id: string;
  checkin_date: string;
  value: unknown;
  note: string;
  checked_in_by: string | null;
  checked_in_by_email: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  updated_by_email: string;
};

const listColumns = "id,objective_id,checkin_date,value,note,checked_in_by,checked_in_by_email,created_at,updated_at,updated_by,updated_by_email";

function day(value: unknown) {
  return String(value).slice(0, 10);
}

async function pages<T>(
  load: (from: number) => PromiseLike<{ data: T[] | null; error: { code?: string } | null }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await load(from);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function latestInChunks(
  admin: Admin,
  ids: string[],
  filter?: { userId?: string; userIds?: string[] },
) {
  const found: CheckinRow[] = [];
  for (let index = 0; index < ids.length; index += 80) {
    const slice = ids.slice(index, index + 80);
    const waiting = new Set(slice);
    for (let from = 0; waiting.size > 0; from += 1000) {
      let query = admin
        .from("objective_checkins")
        .select(listColumns)
        .in("objective_id", slice)
        .order("checkin_date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, from + 999);
      if (filter?.userId) query = query.eq("checked_in_by", filter.userId);
      if (filter?.userIds) query = query.in("checked_in_by", filter.userIds);
      const { data, error } = await query;
      if (error) throw error;
      for (const row of (data ?? []) as CheckinRow[]) {
        if (!waiting.has(row.objective_id)) continue;
        waiting.delete(row.objective_id);
        found.push(row);
      }
      if (!data || data.length < 1000) break;
    }
  }
  return found;
}

export async function loadLatestCheckins(
  admin: Admin,
  ids: string[],
  filter?: { userId?: string; userIds?: string[] },
) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [] as CheckinRow[];
  if (filter?.userIds && filter.userIds.length === 0) return [] as CheckinRow[];
  if (!filter) {
    const rpc = await admin.rpc("latest_objective_checkins", { objective_ids: unique });
    if (!rpc.error && Array.isArray(rpc.data)) return rpc.data as CheckinRow[];
    if (rpc.error && !isStaffSchemaMissing(rpc.error.code)) throw rpc.error;
  }
  return latestInChunks(admin, unique, filter);
}

export async function loadCheckinSnapshots(admin: Admin, ids: string[], cutoffDate: string) {
  const latest = new Map<string, { date: string; value: unknown }>();
  const asOf = new Map<string, { date: string; value: unknown }>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return { latest, asOf };

  for (let index = 0; index < unique.length; index += 500) {
    const slice = unique.slice(index, index + 500);
    const rpc = await admin.rpc("objective_checkin_snapshots", { objective_ids: slice, cutoff: cutoffDate });
    if (rpc.error) {
      if (!isStaffSchemaMissing(rpc.error.code)) throw rpc.error;
      return loadCheckinSnapshotsDirect(admin, unique, cutoffDate);
    }
    for (const row of (rpc.data ?? []) as { objective_id: string; checkin_date: string; value: unknown; snapshot: string }[]) {
      const point = { date: day(row.checkin_date), value: row.value };
      if (row.snapshot === "latest") latest.set(row.objective_id, point);
      if (row.snapshot === "cutoff") asOf.set(row.objective_id, point);
    }
  }
  return { latest, asOf };
}

async function loadCheckinSnapshotsDirect(admin: Admin, ids: string[], cutoffDate: string) {
  const latest = new Map<string, { date: string; value: unknown }>();
  const asOf = new Map<string, { date: string; value: unknown }>();
  const recent: { objective_id: string; checkin_date: string; value: unknown }[] = [];
  for (let index = 0; index < ids.length; index += 80) {
    const slice = ids.slice(index, index + 80);
    recent.push(...await pages<{ objective_id: string; checkin_date: string; value: unknown }>((from) =>
      admin
        .from("objective_checkins")
        .select("objective_id,checkin_date,value")
        .in("objective_id", slice)
        .gte("checkin_date", cutoffDate)
        .order("checkin_date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, from + 999),
    ));
  }
  for (const row of recent) {
    const point = { date: day(row.checkin_date), value: row.value };
    if (!latest.has(row.objective_id)) latest.set(row.objective_id, point);
    if (point.date <= cutoffDate && !asOf.has(row.objective_id)) asOf.set(row.objective_id, point);
  }

  const missingLatest = ids.filter((id) => !latest.has(id));
  if (missingLatest.length > 0) {
    const older = await latestInChunks(admin, missingLatest);
    for (const row of older) {
      const point = { date: day(row.checkin_date), value: row.value };
      latest.set(row.objective_id, point);
      if (point.date <= cutoffDate) asOf.set(row.objective_id, point);
    }
  }

  const missingAsOf = ids.filter((id) => latest.has(id) && !asOf.has(id));
  for (let index = 0; index < missingAsOf.length && missingAsOf.length > 0; index += 80) {
    const slice = missingAsOf.slice(index, index + 80);
    const waiting = new Set(slice);
    for (let from = 0; waiting.size > 0; from += 1000) {
      const { data, error } = await admin
        .from("objective_checkins")
        .select("objective_id,checkin_date,value")
        .in("objective_id", slice)
        .lte("checkin_date", cutoffDate)
        .order("checkin_date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, from + 999);
      if (error) throw error;
      for (const row of data ?? []) {
        if (!waiting.has(row.objective_id)) continue;
        waiting.delete(row.objective_id);
        asOf.set(row.objective_id, { date: day(row.checkin_date), value: row.value });
      }
      if (!data || data.length < 1000) break;
    }
  }
  return { latest, asOf };
}
