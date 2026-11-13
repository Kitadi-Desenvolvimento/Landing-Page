import { NextResponse, type NextRequest } from "next/server";
import { getOrder, isKitadiReference, updateOrder } from "../../../../lib/payments/orders";
import { requireAdmin } from "../../../../lib/supabase/require-admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const authorization = await requireAdmin();
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden" },
      { status: authorization.reason === "unauthenticated" ? 401 : 403 },
    );
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "invalid_content_type" }, { status: 415 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 1024) {
    return NextResponse.json({ error: "request_too_large" }, { status: 413 });
  }

  const { reference } = await params;
  if (!isKitadiReference(reference)) {
    return NextResponse.json({ error: "invalid_reference" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("checkedIn" in body) ||
    typeof body.checkedIn !== "boolean"
  ) {
    return NextResponse.json({ error: "invalid_checkin_value" }, { status: 400 });
  }

  try {
    const order = await getOrder(reference);
    if (!order) return NextResponse.json({ error: "attendee_not_found" }, { status: 404 });
    if (order.status !== "accepted") {
      return NextResponse.json({ error: "payment_not_confirmed" }, { status: 409 });
    }

    const checkedIn = body.checkedIn;
    const updated = await updateOrder(reference, {
      checkedIn,
      checkedInAt: checkedIn ? new Date().toISOString() : null,
      checkedInBy: checkedIn ? authorization.user.id : null,
    });
    if (!updated) {
      return NextResponse.json({ error: "attendee_not_found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        reference: updated.reference,
        checkedIn: updated.checkedIn,
        checkedInAt: updated.checkedInAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[backoffice] attendee check-in update failed", {
      reference,
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "checkin_update_failed" }, { status: 503 });
  }
}
