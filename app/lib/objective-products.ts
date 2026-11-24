import "server-only";

import { createSupabaseAdminClient } from "./supabase/admin";

export type ObjectiveProduct = {
  slug: string;
  title: string;
  image: string | null;
};

export type ObjectiveCollaborator = {
  id: string;
  email: string;
};

export async function loadAvailableProducts(): Promise<ObjectiveProduct[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("products")
    .select("slug,data")
    .eq("published", true)
    .order("sort_order");
  
  if (error || !data) return [];
  
  return data
    .map((product) => ({
      slug: product.slug,
      title: typeof product.data?.title === "string" ? product.data.title : product.slug,
      image: typeof product.data?.image === "string" ? product.data.image : null,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function loadObjectiveCollaborators(
  areaIds?: string[] | null,
): Promise<ObjectiveCollaborator[]> {
  const admin = createSupabaseAdminClient();
  
  let query = admin.auth.admin.listUsers({ perPage: 1000 });
  
  const { data, error } = await query;
  if (error || !data) return [];
  
  return data.users
    .filter((user) => user.email && user.app_metadata?.role === "collaborator")
    .map((user) => ({
      id: user.id,
      email: user.email || "",
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
}
