import "server-only";

import { createSupabaseServerClient } from "./server";

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { authorized: false as const, reason: "unauthenticated" as const };
  }

  if (data.user.app_metadata.role !== "admin") {
    return { authorized: false as const, reason: "forbidden" as const };
  }

  return { authorized: true as const, user: data.user };
}
