import { createClient } from "@supabase/supabase-js";
import { courses, productListings } from "../app/course-data.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceRoleKey) {
  throw new Error("Configure o Supabase no .env.local antes de executar o seed.");
}

const courseBySlug = new Map(courses.map((course) => [course.slug, course]));
const rows = productListings.map((listing, sort_order) => ({
  slug: listing.slug,
  data: {
    ...listing,
    course: courseBySlug.get(listing.slug) ?? null,
  },
  published: true,
  sort_order,
}));

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});
const { error } = await supabase
  .from("products")
  .upsert(rows, { onConflict: "slug", ignoreDuplicates: true });

if (error) {
  throw new Error(
    `Seed de produtos falhou (${error.code ?? "erro_supabase"}). Aplique primeiro a migração de produtos.`,
  );
}

console.log(`Seed verificado: ${rows.length} produtos disponíveis no catálogo.`);
