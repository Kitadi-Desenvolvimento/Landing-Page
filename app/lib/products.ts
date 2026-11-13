import "server-only";

import { createClient } from "@supabase/supabase-js";
import { courses, productListings, type Course } from "../course-data";
import type { ProductData, ProductRecord } from "../product-types";
import { createSupabaseAdminClient } from "./supabase/admin";
import { getSupabaseConfig } from "./supabase/config";

export class ProductCatalogNotMigratedError extends Error {
  constructor() {
    super("A tabela de produtos ainda não foi criada no Supabase.");
    this.name = "ProductCatalogNotMigratedError";
  }
}

function getLegacyProducts(): ProductRecord[] {
  const courseBySlug = new Map(courses.map((course) => [course.slug, course]));
  return productListings.map((listing, sort_order) => ({
    slug: listing.slug,
    data: {
      ...listing,
      course: courseBySlug.get(listing.slug) ?? null,
    },
    published: true,
    sort_order,
  }));
}

function isMissingProductsTable(error: { code?: string }) {
  return error.code === "PGRST205";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseProduct(value: unknown): ProductRecord {
  if (!isRecord(value) || !isRecord(value.data)) {
    throw new Error("O catálogo contém um produto com formato inválido.");
  }

  const { slug, data, published, sort_order: sortOrder } = value;
  const requiredStrings = [
    "slug",
    "category",
    "title",
    "shortName",
    "tagline",
    "image",
    "alt",
    "statusLabel",
    "imageMode",
    "modality",
  ];
  if (
    typeof slug !== "string" ||
    requiredStrings.some((key) => typeof data[key] !== "string") ||
    (data.edition !== undefined && typeof data.edition !== "string") ||
    typeof published !== "boolean" ||
    typeof sortOrder !== "number"
  ) {
    throw new Error("O catálogo contém um produto com campos inválidos.");
  }

  if (data.course !== undefined && data.course !== null) {
    const course = data.course;
    if (
      !isRecord(course) ||
      course.slug !== slug ||
      typeof course.priceAmount !== "number" ||
      !Array.isArray(course.variants) ||
      !Array.isArray(course.results) ||
      !Array.isArray(course.aboutBody) ||
      !Array.isArray(course.audienceGroups) ||
      !Array.isArray(course.methodSteps) ||
      !Array.isArray(course.includes) ||
      !Array.isArray(course.nextSteps)
    ) {
      throw new Error(`O produto "${slug}" tem detalhes de formação inválidos.`);
    }
  }

  return {
    slug,
    data: data as ProductData,
    published,
    sort_order: sortOrder,
  };
}

function createPublicClient() {
  const { url, anonKey } = getSupabaseConfig();
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export async function getPublishedProducts(): Promise<ProductRecord[]> {
  const { data, error } = await createPublicClient()
    .from("products")
    .select("slug, data, published, sort_order")
    .eq("published", true)
    .order("sort_order")
    .order("slug");

  if (error) {
    if (isMissingProductsTable(error)) {
      console.warn(
        "[products] public catalog is using the legacy catalog; apply the products migration",
      );
      return getLegacyProducts();
    }
    console.error("[products] public catalog query failed", error.code);
    throw new Error("Não foi possível carregar o catálogo de produtos.");
  }

  return (data ?? []).map(parseProduct);
}

export async function getPublishedCourseBySlug(
  slug: string,
): Promise<Course | undefined> {
  const product = await getPublishedProductBySlug(slug);
  return product?.data.course ?? undefined;
}

export async function getPublishedProductBySlug(
  slug: string,
): Promise<ProductRecord | undefined> {
  return (await getPublishedProducts()).find((item) => item.slug === slug);
}

export async function getAdminProducts(): Promise<ProductRecord[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("products")
    .select("slug, data, published, sort_order")
    .order("sort_order")
    .order("slug");

  if (error) {
    if (isMissingProductsTable(error)) {
      throw new ProductCatalogNotMigratedError();
    }
    console.error("[products] admin catalog query failed", error.code);
    throw new Error("Não foi possível carregar os produtos no back office.");
  }

  return (data ?? []).map(parseProduct);
}
