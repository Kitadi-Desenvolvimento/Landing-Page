import "server-only";

import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "./admin";
import { createSupabaseServerClient } from "./server";

export type BackofficeRole = "admin" | "manager" | "collaborator";
type BackofficeAuthorization =
  | { authorized: true; role: "admin" | "collaborator"; user: User; areaIds: null }
  | { authorized: true; role: "manager"; user: User; areaIds: string[] }
  | { authorized: false; reason: "unauthenticated" | "forbidden" | "unavailable" };

export async function requireBackofficeUser(): Promise<BackofficeAuthorization> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { authorized: false as const, reason: "unauthenticated" as const };
  }

  const role: unknown = data.user.app_metadata.role;
  if (role !== "admin" && role !== "manager" && role !== "collaborator") {
    return { authorized: false as const, reason: "forbidden" as const };
  }

  if (role !== "manager") {
    return {
      authorized: true as const,
      role: role as "admin" | "collaborator",
      user: data.user,
      areaIds: null,
    };
  }

  const { data: memberships, error: membershipError } = await createSupabaseAdminClient()
    .from("objective_area_members")
    .select("area_id")
    .eq("user_id", data.user.id);

  if (membershipError) {
    console.error("[backoffice] area access lookup failed", membershipError.code);
    return { authorized: false as const, reason: "unavailable" as const };
  }

  return {
    authorized: true as const,
    role,
    user: data.user,
    areaIds: [...new Set((memberships ?? []).map((membership) => membership.area_id))],
  };
}

export async function requireAdmin() {
  const authorization = await requireBackofficeUser();
  if (!authorization.authorized) return authorization;
  if (authorization.role !== "admin") {
    return { authorized: false as const, reason: "forbidden" as const };
  }
  return { authorized: true as const, user: authorization.user };
}

export function canManageArea(
  authorization: Extract<Awaited<ReturnType<typeof requireBackofficeUser>>, { authorized: true }>,
  areaId: string,
) {
  return authorization.role === "admin" ||
    (authorization.role === "manager" && authorization.areaIds.includes(areaId));
}
