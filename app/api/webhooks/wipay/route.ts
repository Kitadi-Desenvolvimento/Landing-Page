import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { courses, offersCheckout } from "../../../course-data";
import { getOrder, isKitadiReference, updateOrder } from "../../../lib/payments/orders";
import { getWipaySignatureToken } from "../../../lib/payments/wipay";

function isKnownCheckoutAmount(amount: number) {
  return courses.some(
    (course) =>
      offersCheckout(course) &&
      course.variants.some((variant) => variant.priceAmount === amount),
  );
}

function isValidSignature(rawBody: string, signature: string | null, token: string) {
  if (!signature || !/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", token).update(rawBody).digest();
  const provided = Buffer.from(signature, "hex");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("signature");

  let signatureToken: string;
  try {
    signatureToken = await getWipaySignatureToken();
  } catch {
    console.error("[wipay:webhook] signature token unavailable");
    return NextResponse.json({ error: "signature_validation_unavailable" }, { status: 503 });
  }

  if (!isValidSignature(rawBody, signature, signatureToken)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const reference = typeof body.reference_id === "string" ? body.reference_id.trim() : "";
  if (!reference || !isKitadiReference(reference)) {
    return NextResponse.json({ error: "invalid_reference" }, { status: 400 });
  }

  const status = typeof body.status === "string" ? body.status.toLowerCase() : "";
  const order = await getOrder(reference);
  const amount = Number(body.amount);
  const currency = String(body.currency ?? "").toLowerCase();
  if (!order) {
    if (currency === "aoa" && isKnownCheckoutAmount(amount)) {
      console.error("[wipay:webhook] signed payment has no local order", { reference, status });
      return NextResponse.json({ ok: true, status, stored: false });
    }
    return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
  }

  if (amount !== order.amountKz || currency !== "aoa") {
    return NextResponse.json({ error: "payment_details_mismatch" }, { status: 400 });
  }

  if (status === "accepted") {
    await updateOrder(reference, { status: "accepted" });
    return NextResponse.json({ ok: true, status: "accepted" });
  }

  if (status === "rejected") {
    const reason = typeof body.status_reason === "string" ? body.status_reason : "rejected";
    await updateOrder(reference, { status: "rejected", reason });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  return NextResponse.json({ ok: true, ignored: true });
}
