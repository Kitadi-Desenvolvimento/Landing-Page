import { NextResponse, type NextRequest } from "next/server";
import { isValidStageChangeReason } from "../../../../lib/commercial-stage";
import { getProductBySlugForDelivery } from "../../../../lib/products";
import { touchBackofficeData } from "../../../../lib/read-cache";
import { listVisibleStaff } from "../../../../lib/staff-profiles";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { requireAdmin } from "../../../../lib/supabase/require-admin";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const stages = new Set(["new_contact", "in_conversation", "proposal_sent", "converted", "lost"]);
const missingCrmCodes = new Set(["42P01", "PGRST202", "PGRST204", "PGRST205"]);

type RouteContext = { params: Promise<{ id: string }> };

type ManualOfferUpdate = {
  product_slug: string | null;
  product_title: string | null;
  amount_kz: number | null;
};

function readAmount(value: unknown) {
  if (value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 2_000_000_000) {
    return undefined;
  }
  return value;
}

async function readManualOfferUpdate(
  id: string,
  body: Record<string, unknown>,
): Promise<ManualOfferUpdate | null | "invalid" | "unavailable"> {
  if (!("productSlug" in body) && !("amountKz" in body)) return null;
  const admin = createSupabaseAdminClient();
  const current = await admin
    .from("crm_opportunities")
    .select("source,payment_reference,product_slug,product_title,amount_kz")
    .eq("id", id)
    .maybeSingle();
  if (current.error) {
    if (missingCrmCodes.has(current.error.code ?? "")) return "unavailable";
    console.error("[commercial] loading opportunity offer failed", current.error.code ?? "unknown");
    return "unavailable";
  }
  if (!current.data || current.data.source !== "manual" || current.data.payment_reference) return null;

  const productSlug = "productSlug" in body ? body.productSlug : current.data.product_slug;
  const amount = "amountKz" in body ? readAmount(body.amountKz) : undefined;
  if (
    (productSlug !== null && (typeof productSlug !== "string" || !slugPattern.test(productSlug))) ||
    ("amountKz" in body && amount === undefined)
  ) {
    return "invalid";
  }

  let productTitle: string | null = null;
  if (typeof productSlug === "string") {
    try {
      const product = await getProductBySlugForDelivery(productSlug);
      productTitle = product?.data.title
        ?? (productSlug === current.data.product_slug ? current.data.product_title : null);
    } catch (error) {
      console.error("[commercial] resolving product failed", error instanceof Error ? error.message : "unknown");
      return "unavailable";
    }
    if (!productTitle) return "invalid";
  }

  return {
    product_slug: typeof productSlug === "string" ? productSlug : null,
    product_title: productTitle,
    amount_kz: "amountKz" in body ? amount ?? null : current.data.amount_kz,
  };
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const authorization = await requireAdmin();
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden" },
      { status: authorization.reason === "unauthenticated" ? 401 : 403 },
    );
  }

  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: selectedOpportunity, error: opportunityError } = await admin
    .from("crm_opportunities")
    .select("*,contact:crm_contacts!crm_opportunities_contact_id_fkey(*)")
    .eq("id", id)
    .maybeSingle();
  if (opportunityError || !selectedOpportunity) {
    const notConfigured = missingCrmCodes.has(opportunityError?.code ?? "");
    if (!notConfigured) {
      if (opportunityError) {
        console.error("[commercial] loading opportunity details failed", opportunityError.code ?? "unknown");
      }
    }
    return NextResponse.json(
      { error: notConfigured ? "commercial_not_configured" : selectedOpportunity ? "commercial_unavailable" : "opportunity_not_found" },
      { status: notConfigured ? 503 : selectedOpportunity ? 500 : 404 },
    );
  }

  const { data: opportunities, error: relatedError } = await admin
    .from("crm_opportunities")
    .select("*")
    .eq("contact_id", selectedOpportunity.contact_id)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (relatedError) {
    const notConfigured = missingCrmCodes.has(relatedError.code ?? "");
    if (!notConfigured) {
      console.error("[commercial] loading contact opportunities failed", relatedError.code ?? "unknown");
    }
    return NextResponse.json(
      { error: notConfigured ? "commercial_not_configured" : "commercial_unavailable" },
      { status: notConfigured ? 503 : 500 },
    );
  }

  const opportunityIds = (opportunities ?? []).map((opportunity) => opportunity.id);
  const references = (opportunities ?? [])
    .map((opportunity) => opportunity.payment_reference)
    .filter((reference): reference is string => typeof reference === "string");
  const [historyResult, paymentResult] = await Promise.all([
    admin
      .from("crm_opportunity_history")
      .select("*")
      .in("opportunity_id", opportunityIds)
      .order("created_at", { ascending: false })
      .limit(2000),
    references.length
      ? admin
      .from("payment_orders")
      .select("reference,status,provider_status,reason,created_at,paid_at,amount_kz,product_title,variant_label,customer_name")
      .in("reference", references)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const error = historyResult.error ?? paymentResult.error;
  if (error) {
    const notConfigured = missingCrmCodes.has(error.code ?? "");
    if (!notConfigured) {
      console.error("[commercial] loading contact history failed", error.code ?? "unknown");
    }
    return NextResponse.json(
      { error: notConfigured ? "commercial_not_configured" : "commercial_unavailable" },
      { status: notConfigured ? 503 : 500 },
    );
  }
  const paymentByReference = new Map(
    (paymentResult.data ?? []).map((payment) => [payment.reference, payment]),
  );

  return NextResponse.json({
    selectedOpportunityId: id,
    opportunities: (opportunities ?? []).map((opportunity) => ({
      ...opportunity,
      payment: opportunity.payment_reference
        ? paymentByReference.get(opportunity.payment_reference) ?? null
        : null,
    })),
    history: historyResult.data ?? [],
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const authorization = await requireAdmin();
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden" },
      { status: authorization.reason === "unauthenticated" ? 401 : 403 },
    );
  }

  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8_192) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body === "object" && body !== null) {
    if ("notes" in body && body.notes === null) body.notes = "";
    if ("followUpAt" in body && typeof body.followUpAt === "string" && body.followUpAt.length <= 40) {
      const parsedFollowUp = Date.parse(body.followUpAt);
      if (!Number.isNaN(parsedFollowUp)) body.followUpAt = new Date(parsedFollowUp).toISOString();
    }
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("contactId" in body) ||
    typeof body.contactId !== "string" ||
    !uuidPattern.test(body.contactId) ||
    !("fromStage" in body) ||
    typeof body.fromStage !== "string" ||
    !stages.has(body.fromStage) ||
    !("toStage" in body) ||
    typeof body.toStage !== "string" ||
    !stages.has(body.toStage) ||
    !("stageChangeReason" in body) ||
    typeof body.stageChangeReason !== "string" ||
    body.stageChangeReason.length > 300 ||
    !("editOpportunityId" in body) ||
    typeof body.editOpportunityId !== "string" ||
    !uuidPattern.test(body.editOpportunityId) ||
    body.editOpportunityId !== id ||
    !("notes" in body) ||
    typeof body.notes !== "string" ||
    body.notes.length > 2000 ||
    !("followUpAt" in body) ||
    (body.followUpAt !== null &&
      (typeof body.followUpAt !== "string" ||
        body.followUpAt.length > 40 ||
        Number.isNaN(Date.parse(body.followUpAt)) ||
        !body.followUpAt.endsWith("Z")))
  ) {
    return NextResponse.json({ error: "invalid_update" }, { status: 400 });
  }

  if (!isValidStageChangeReason(body.fromStage, body.toStage, body.stageChangeReason)) {
    return NextResponse.json({ error: "stage_change_reason_required" }, { status: 400 });
  }

  const lostReason = "lostReason" in body && typeof body.lostReason === "string"
    ? body.lostReason.trim()
    : "";
  const stageChangeReason = body.stageChangeReason.trim();
  if (body.toStage === "lost" && (!lostReason || lostReason.length > 300)) {
    return NextResponse.json({ error: "lost_reason_required" }, { status: 400 });
  }

  const ownerId = "ownerId" in body
    ? body.ownerId === null || body.ownerId === "" ? null : body.ownerId
    : undefined;
  if (ownerId !== undefined && ownerId !== null && (typeof ownerId !== "string" || !uuidPattern.test(ownerId))) {
    return NextResponse.json({ error: "invalid_update" }, { status: 400 });
  }
  if (typeof ownerId === "string") {
    const staff = await listVisibleStaff("admin", authorization.user.id, null);
    if (!staff.some((person) => person.id === ownerId)) {
      return NextResponse.json({ error: "invalid_update" }, { status: 400 });
    }
  }

  const offer = await readManualOfferUpdate(id, body as Record<string, unknown>);
  if (offer === "invalid") {
    return NextResponse.json({ error: "invalid_update" }, { status: 400 });
  }
  if (offer === "unavailable") {
    return NextResponse.json({ error: "commercial_unavailable" }, { status: 503 });
  }

  const { data, error } = await createSupabaseAdminClient().rpc(
    "backoffice_move_crm_contact_stage",
    {
      p_contact_id: body.contactId,
      p_from_stage: body.fromStage,
      p_to_stage: body.toStage,
      p_edit_opportunity_id: body.editOpportunityId,
      p_notes: body.notes,
      p_follow_up_at: body.followUpAt,
      p_actor_id: authorization.user.id,
      p_actor_email: authorization.user.email ?? "",
      p_lost_reason: body.toStage === "lost" ? lostReason : null,
      p_stage_change_reason: body.fromStage === body.toStage ? null : stageChangeReason,
    },
  );
  if (error) {
    const notConfigured = missingCrmCodes.has(error.code ?? "");
    if (!notConfigured) {
      console.error("[commercial] updating opportunity failed", error.code ?? "unknown");
    }
    return NextResponse.json(
      { error: notConfigured ? "commercial_not_configured" : "commercial_update_failed" },
      { status: notConfigured ? 503 : 500 },
    );
  }
  if (typeof data !== "number") {
    return NextResponse.json({ error: "commercial_update_failed" }, { status: 500 });
  }
  if (data === 0) {
    return NextResponse.json({ error: "commercial_stage_locked" }, { status: 409 });
  }

  if (offer) {
    const offerUpdate = await createSupabaseAdminClient()
      .from("crm_opportunities")
      .update(offer)
      .eq("id", id)
      .eq("source", "manual")
      .is("payment_reference", null);
    if (offerUpdate.error) {
      if (missingCrmCodes.has(offerUpdate.error.code ?? "")) {
        return NextResponse.json({ error: "commercial_not_configured" }, { status: 503 });
      }
      console.error("[commercial] saving opportunity offer failed", offerUpdate.error.code ?? "unknown");
      return NextResponse.json({ error: "commercial_update_failed" }, { status: 500 });
    }
  }

  if (ownerId !== undefined) {
    const ownerUpdate = await createSupabaseAdminClient()
      .from("crm_contacts")
      .update({ owner_id: ownerId })
      .eq("id", body.contactId);
    if (ownerUpdate.error) {
      if (missingCrmCodes.has(ownerUpdate.error.code ?? "")) {
        return NextResponse.json({ error: "contact_owner_not_ready" }, { status: 503 });
      }
      console.error("[commercial] saving contact owner failed", ownerUpdate.error.code ?? "unknown");
      return NextResponse.json({ error: "commercial_update_failed" }, { status: 500 });
    }
  }

  touchBackofficeData();
  return NextResponse.json({ updated: true, updatedCount: data });
}
