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
  
  const collaborators: ObjectiveCollaborator[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return [];
    
    collaborators.push(
      ...data.users
        .filter((user) => user.email && user.app_metadata?.role === "collaborator")
        .map((user) => ({
          id: user.id,
          email: user.email || "",
        })),
    );
    
    if (data.users.length < 1000) break;
  }
  
  return collaborators.sort((a, b) => a.email.localeCompare(b.email));
}
