import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";

type ContactChannel = "whatsapp" | "email" | "phone";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSlug(value: unknown): value is string {
  return typeof value === "string" &&
    value.length <= 100 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isValidPagePath(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 200 &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/api") &&
    !value.startsWith("/backoffice") &&
    !/[?#\u0000-\u001f]/.test(value);
}

function readChannel(value: unknown): ContactChannel | null {
  return value === "whatsapp" || value === "email" || value === "phone"
    ? value
    : null;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== request.nextUrl.host) {
        return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
    }
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 2_048) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  }

  const sessionId = body.sessionId;
  const eventType = body.eventType;
  const pagePath = body.pagePath;
  const productSlug = body.productSlug;
  if (
    typeof sessionId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId) ||
    (eventType !== "page_view" && eventType !== "contact_click") ||
    !isValidPagePath(pagePath) ||
    (productSlug !== undefined && productSlug !== null && !isSlug(productSlug))
  ) {
    return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  }

  const eventRows: {
    event_type: string;
    session_id: string;
    page_path: string;
    product_slug: string | null;
    channel: ContactChannel | null;
  }[] = [];

  if (eventType === "page_view") {
    const productPage = pagePath.match(/^\/produtos\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
    const checkoutPage = pagePath.match(/^\/formacoes\/([a-z0-9]+(?:-[a-z0-9]+)*)\/inscricao\/?$/);
    const safeProductSlug = productPage?.[1] ?? null;
    eventRows.push({
      event_type: "page_view",
      session_id: sessionId,
      page_path: pagePath,
      product_slug: safeProductSlug,
      channel: null,
    });
    if (checkoutPage) {
      eventRows.push({
        event_type: "checkout_start",
        session_id: sessionId,
        page_path: pagePath,
        product_slug: checkoutPage[1],
        channel: null,
      });
    }
  } else {
    const channel = readChannel(body.channel);
    if (!channel) {
      return NextResponse.json({ error: "invalid_channel" }, { status: 400 });
    }
    eventRows.push({
      event_type: "contact_click",
      session_id: sessionId,
      page_path: pagePath,
      product_slug: isSlug(productSlug) ? productSlug : null,
      channel,
    });
  }

  const { error } = await createSupabaseAdminClient()
    .from("site_analytics_events")
    .insert(eventRows);
  if (error) {
    console.error("[site-analytics] event insert failed", error.code ?? "unknown");
    return NextResponse.json({ error: "analytics_unavailable" }, { status: 503 });
  }

  return new NextResponse(null, { status: 204 });
}
