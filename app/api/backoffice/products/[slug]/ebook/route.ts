import { NextResponse, type NextRequest } from "next/server";
import {
  assertUsableEbook,
  downloadStoredFile,
  ebookBucket,
  EbookError,
  getProductEbook,
  maxEbookBytes,
  originalEbookPath,
} from "../../../../../lib/ebooks";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";
import { requireAdmin } from "../../../../../lib/supabase/require-admin";
import type { ProductData } from "../../../../../product-types";

export const maxDuration = 60;

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFileName(value: unknown) {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= 160 &&
    /\.pdf$/i.test(value.trim())
    ? value.trim()
    : null;
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

async function readJson(request: NextRequest) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return { error: jsonError("invalid_content_type", 415) };
  }
  if (Number(request.headers.get("content-length") ?? 0) > 2048) {
    return { error: jsonError("request_too_large", 413) };
  }
  try {
    const body = await request.text();
    if (body.length > 2048) return { error: jsonError("request_too_large", 413) };
    const payload: unknown = JSON.parse(body);
    if (!isRecord(payload)) return { error: jsonError("invalid_ebook", 400) };
    return { payload };
  } catch {
    return { error: jsonError("invalid_json", 400) };
  }
}

async function loadProduct(slug: string) {
  const { data, error } = await createSupabaseAdminClient()
    .from("products")
    .select("slug, data")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("[backoffice] ebook product load failed", error.code);
    return { error: jsonError("product_load_failed", 503) };
  }
  if (!data) return { error: jsonError("product_not_found", 404) };
  const product = data as { slug: string; data: ProductData };
  if (product.data.course) return { error: jsonError("ebook_requires_simple_product", 400) };
  return { product };
}

/** Passo 1: devolve um link de upload directo para o bucket privado. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const denied = await authorize(request);
  if (denied) return denied;
  const { payload, error } = await readJson(request);
  if (error) return error;

  const fileName = readFileName(payload.fileName);
  const sizeBytes = payload.sizeBytes;
  if (
    !fileName ||
    typeof sizeBytes !== "number" ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes <= 0
  ) {
    return jsonError("invalid_ebook", 400);
  }
  if (sizeBytes > maxEbookBytes) return jsonError("ebook_too_large", 413);

  const { slug } = await params;
  const loaded = await loadProduct(slug);
  if (loaded.error) return loaded.error;

  const path = originalEbookPath(slug);
  const { data, error: uploadError } = await createSupabaseAdminClient()
    .storage.from(ebookBucket)
    .createSignedUploadUrl(path);
  if (uploadError || !data) {
    console.error("[backoffice] ebook upload url failed", uploadError?.message ?? "unknown");
    return jsonError("ebook_storage_unavailable", 503);
  }

  return NextResponse.json(
    { path: data.path, token: data.token },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Passo 2: valida o PDF carregado e associa-o ao produto. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const denied = await authorize(request);
  if (denied) return denied;
  const { payload, error } = await readJson(request);
  if (error) return error;

  const { slug } = await params;
  const fileName = readFileName(payload.fileName);
  const path = typeof payload.path === "string" ? payload.path : "";
  const expectedPrefix = `originals/${slug}/`;
  if (
    !fileName ||
    !path.startsWith(expectedPrefix) ||
    !/^[a-f0-9]{24}\.pdf$/.test(path.slice(expectedPrefix.length))
  ) {
    return jsonError("invalid_ebook", 400);
  }

  const loaded = await loadProduct(slug);
  if (loaded.error) return loaded.error;
  const storage = createSupabaseAdminClient().storage.from(ebookBucket);

  let bytes: Uint8Array;
  try {
    bytes = await downloadStoredFile(path);
    if (bytes.byteLength > maxEbookBytes) throw new EbookError("ebook_invalid_pdf");
    await assertUsableEbook(bytes);
  } catch (caught) {
    await storage.remove([path]).catch(() => undefined);
    const code = caught instanceof EbookError ? caught.code : "ebook_storage_unavailable";
    return jsonError(code, code === "ebook_invalid_pdf" ? 400 : 503);
  }

  const previous = getProductEbook(loaded.product.data);
  const data: ProductData = {
    ...loaded.product.data,
    ebook: {
      path,
      fileName,
      sizeBytes: bytes.byteLength,
      uploadedAt: new Date().toISOString(),
    },
  };
  const { data: saved, error: saveError } = await createSupabaseAdminClient()
    .from("products")
    .update({ data })
    .eq("slug", slug)
    .select("slug, data, published, sort_order")
    .single();
  if (saveError) {
    console.error("[backoffice] ebook product update failed", saveError.code);
    await storage.remove([path]).catch(() => undefined);
    return jsonError("product_update_failed", 503);
  }

  if (previous && previous.path !== path) {
    await storage.remove([previous.path]).catch(() => undefined);
  }

  return NextResponse.json(saved, { headers: { "Cache-Control": "no-store" } });
}
