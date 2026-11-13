import { NextResponse, type NextRequest } from "next/server";
import { makeProductData, parseProductInput } from "../../../../lib/product-input";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { requireAdmin } from "../../../../lib/supabase/require-admin";

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
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

  const { slug } = await params;
  const admin = createSupabaseAdminClient();
  const { data: current, error: queryError } = await admin
    .from("products")
    .select("slug, data")
    .eq("slug", slug)
    .maybeSingle();
  if (queryError) {
    console.error("[backoffice] product load failed", queryError.code);
    return jsonError("product_load_failed", 503);
  }
  if (!current) return jsonError("product_not_found", 404);

  const { data, error } = await admin
    .from("products")
    .update({
      data: makeProductData(input, current.data, slug),
      published: input.published,
    })
    .eq("slug", slug)
    .select("slug, data, published, sort_order")
    .single();
  if (error) {
    console.error("[backoffice] product update failed", error.code);
    return jsonError("product_update_failed", 503);
  }

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
