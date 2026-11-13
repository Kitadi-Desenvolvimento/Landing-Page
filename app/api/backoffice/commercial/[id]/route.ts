import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { requireAdmin } from "../../../../lib/supabase/require-admin";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const stages = new Set(["new_contact", "in_conversation", "proposal_sent", "converted"]);
const missingCrmCodes = new Set(["42P01", "PGRST202", "PGRST204", "PGRST205"]);

type RouteContext = { params: Promise<{ id: string }> };

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
      .select("reference,status,provider_status,reason,created_at,paid_at,amount_kz,product_title,variant_label")
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

  return NextResponse.json({ updated: true, updatedCount: data });
}
