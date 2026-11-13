import { NextResponse, type NextRequest } from "next/server";
import { makeProductData, parseProductInput, productSlug } from "../../../lib/product-input";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { requireAdmin } from "../../../lib/supabase/require-admin";

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function authorize(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return jsonError("invalid_origin", 403);
  }
  const authorization = await requireAdmin();
  if (!authorization.authorized) {
    return jsonError(
      authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden",
      authorization.reason === "unauthenticated" ? 401 : 403,
    );
  }
  return null;
}

export async function POST(request: NextRequest) {
  const denied = await authorize(request);
  if (denied) return denied;
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return jsonError("invalid_content_type", 415);
  }
  if (Number(request.headers.get("content-length") ?? 0) > 4096) {
    return jsonError("request_too_large", 413);
  }

  let payload: unknown;
  try {
    const body = await request.text();
    if (body.length > 4096) return jsonError("request_too_large", 413);
    payload = JSON.parse(body);
  } catch {
    return jsonError("invalid_json", 400);
  }
  const input = parseProductInput(payload);
  if (!input) return jsonError("invalid_product", 400);

  const slug = productSlug(input.title);
  if (!slug) return jsonError("invalid_product_slug", 400);

  const admin = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("products")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (existingError) {
    console.error("[backoffice] product check failed", existingError.code);
    return jsonError("product_check_failed", 503);
  }
  if (existing) return jsonError("product_already_exists", 409);

  const { data: lastProduct, error: orderError } = await admin
    .from("products")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderError) {
    console.error("[backoffice] product order lookup failed", orderError.code);
    return jsonError("product_order_failed", 503);
  }

  const product = {
    slug,
    data: makeProductData(input, undefined, slug),
    published: input.published,
    sort_order: (lastProduct?.sort_order ?? -1) + 1,
  };
  const { data, error } = await admin
    .from("products")
    .insert(product)
    .select("slug, data, published, sort_order")
    .single();
  if (error) {
    console.error("[backoffice] product creation failed", error.code);
    return jsonError("product_create_failed", 503);
  }

  return NextResponse.json(data, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}
