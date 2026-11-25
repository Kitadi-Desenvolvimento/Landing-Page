import "server-only";

import { createSupabaseAdminClient } from "./supabase/admin";
import type { BackofficeRole } from "./supabase/require-admin";

export type StaffPerson = {
  id: string;
  email: string;
  displayName: string;
};

export function isStaffSchemaMissing(code?: string) {
  return code === "42P01" || code === "PGRST205" || code === "PGRST204" || code === "PGRST202";
}

export async function loadDisplayNames(userIds: string[]) {
  const names = new Map<string, string>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return names;
  const { data, error } = await createSupabaseAdminClient()
    .from("staff_profiles")
    .select("user_id, display_name")
    .in("user_id", ids);
  if (error) {
    if (isStaffSchemaMissing(error.code)) return names;
    throw error;
  }
  for (const row of data ?? []) {
    if (typeof row.display_name === "string") names.set(row.user_id, row.display_name);
  }
  return names;
}

export async function saveDisplayName(userId: string, displayName: string) {
  const admin = createSupabaseAdminClient();
  const trimmed = displayName.trim();
  if (!trimmed) {
    const { error } = await admin.from("staff_profiles").delete().eq("user_id", userId);
    if (error && !isStaffSchemaMissing(error.code)) throw error;
    return "";
  }
  const { error } = await admin.from("staff_profiles").upsert({
    user_id: userId,
    display_name: trimmed,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return trimmed;
}

async function memberIdsInAreas(userId: string, areaIds: string[]) {
  if (areaIds.length === 0) return [userId];
  const { data, error } = await createSupabaseAdminClient()
    .from("objective_area_members")
    .select("user_id")
    .in("area_id", areaIds);
  if (error) throw error;
  return [...new Set([userId, ...(data ?? []).map((row) => row.user_id as string)])];
}

export async function listVisibleStaff(
  role: BackofficeRole,
  userId: string,
  managerAreaIds: string[] | null,
): Promise<StaffPerson[]> {
  const admin = createSupabaseAdminClient();
  const users: { id: string; email: string }[] = [];
  if (role === "admin") {
    for (let page = 1; ; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      users.push(...data.users.filter((user) => user.email).map((user) => ({
        id: user.id,
        email: user.email ?? "",
      })));
      if (data.users.length < 1000) break;
    }
  } else {
    let areaIds = managerAreaIds ?? [];
    if (role === "collaborator") {
      const { data, error } = await admin
        .from("objective_area_members")
        .select("area_id")
        .eq("user_id", userId);
      if (error) throw error;
      areaIds = [...new Set((data ?? []).map((row) => row.area_id as string))];
    }
    const ids = await memberIdsInAreas(userId, areaIds);
    for (const id of ids) {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error) throw error;
      if (data.user?.email) users.push({ id, email: data.user.email });
    }
  }
  const names = await loadDisplayNames(users.map((user) => user.id));
  return users
    .map((user) => ({ ...user, displayName: names.get(user.id) ?? "" }))
    .sort((left, right) => (left.displayName || left.email).localeCompare(right.displayName || right.email, "pt"));
}
