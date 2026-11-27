import { NextResponse, type NextRequest } from "next/server";
import { loadCommercialSteps } from "../../../lib/commercial-steps";
import { personLabel } from "../../../lib/person-label";
import { touchBackofficeData } from "../../../lib/read-cache";
import { listVisibleStaff } from "../../../lib/staff-profiles";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { requireAdmin } from "../../../lib/supabase/require-admin";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const missingCrmCodes = new Set(["42P01", "PGRST202", "PGRST204", "PGRST205"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingCrm(error: { code?: string }) {
  return missingCrmCodes.has(error.code ?? "");
}

function readOptionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maxLength) return undefined;
  return value.trim() || null;
}

export async function GET() {
  const authorization = await requireAdmin();
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden" },
      { status: authorization.reason === "unauthenticated" ? 401 : 403 },
    );
  }

  const admin = createSupabaseAdminClient();
  const contactsQuery = admin
    .from("crm_contacts")
    .select("id,contact_type,name,email,phone,company_id,owner_id")
    .order("name", { ascending: true })
    .limit(1000);
  const [opportunitiesResult, contactsResult, staff] = await Promise.all([
    admin
      .from("crm_opportunities")
      .select("*,contact:crm_contacts!crm_opportunities_contact_id_fkey(*)")
      .order("created_at", { ascending: false })
      .limit(1000),
    contactsQuery,
    listVisibleStaff("admin", authorization.user.id, null).catch(() => []),
  ]);
  let contacts: Record<string, unknown>[] = contactsResult.data ?? [];
  if (contactsResult.error && isMissingCrm(contactsResult.error)) {
    const fallback = await admin
      .from("crm_contacts")
      .select("id,contact_type,name,email,phone,company_id")
      .order("name", { ascending: true })
      .limit(1000);
    if (fallback.error) {
      return NextResponse.json(
        { error: isMissingCrm(fallback.error) ? "commercial_not_configured" : "commercial_unavailable" },
        { status: isMissingCrm(fallback.error) ? 503 : 500 },
      );
    }
    contacts = fallback.data ?? [];
  } else if (contactsResult.error) {
    console.error("[commercial] loading CRM failed", contactsResult.error.code ?? "unknown");
    return NextResponse.json({ error: "commercial_unavailable" }, { status: 500 });
  }

  const error = opportunitiesResult.error;
  if (error) {
    const notConfigured = isMissingCrm(error);
    if (!notConfigured) {
      console.error("[commercial] loading CRM failed", error.code ?? "unknown");
    }
    return NextResponse.json(
      { error: notConfigured ? "commercial_not_configured" : "commercial_unavailable" },
      { status: notConfigured ? 503 : 500 },
    );
  }

  const opportunities = opportunitiesResult.data ?? [];
  const references = opportunities
    .map((opportunity) => opportunity.payment_reference)
    .filter((reference): reference is string => typeof reference === "string");
  let paymentByReference = new Map<string, Record<string, unknown>>();
  if (references.length) {
    const { data, error: paymentError } = await admin
      .from("payment_orders")
      .select("reference,status,provider_status,reason,created_at,paid_at,customer_name")
      .in("reference", references);
    if (paymentError) {
      const notConfigured = isMissingCrm(paymentError);
      if (!notConfigured) {
        console.error("[commercial] loading payment details failed", paymentError.code ?? "unknown");
      }
      return NextResponse.json(
        { error: notConfigured ? "commercial_not_configured" : "commercial_unavailable" },
        { status: notConfigured ? 503 : 500 },
      );
    }
    paymentByReference = new Map(
      (data ?? []).map((payment) => [payment.reference, payment]),
    );
  }

  let steps: Awaited<ReturnType<typeof loadCommercialSteps>> = [];
  try {
    steps = await loadCommercialSteps();
  } catch (noticeError) {
    console.error("[commercial] step notices failed", noticeError instanceof Error ? noticeError.message : "unknown");
  }
  const stepById = new Map(steps.map((step) => [step.id, step]));

  return NextResponse.json(
    {
      opportunities: opportunities.map((opportunity) => {
        const step = stepById.get(opportunity.id);
        return {
          ...opportunity,
          days_in_stage: step?.days ?? null,
          next_step: step?.next ?? null,
          payment: opportunity.payment_reference
            ? paymentByReference.get(opportunity.payment_reference) ?? null
            : null,
        };
      }),
      contacts,
      staff: staff.map((person) => ({ id: person.id, name: personLabel(person.displayName, person.email) })),
      currentUserId: authorization.user.id,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const authorization = await requireAdmin();
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden" },
      { status: authorization.reason === "unauthenticated" ? 401 : 403 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16_384) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isRecord(body) || !isRecord(body.contact) || !isRecord(body.opportunity)) {
    return NextResponse.json({ error: "invalid_contact" }, { status: 400 });
  }

  const contactType = body.contact.contactType;
  const name = readOptionalText(body.contact.name, 160);
  const email = readOptionalText(body.contact.email, 254);
  const phone = readOptionalText(body.contact.phone, 24);
  const companyId = readOptionalText(body.contact.companyId, 36);
  const companyName = readOptionalText(body.contact.companyName, 160);
  const title = readOptionalText(body.opportunity.title, 180);
  const productSlug = readOptionalText(body.opportunity.productSlug, 100);
  const productTitle = readOptionalText(body.opportunity.productTitle, 180);
  const notes = readOptionalText(body.opportunity.notes, 2000);
  const followUpAt = readOptionalText(body.opportunity.followUpAt, 40);
  const rawOwner = body.contact.ownerId;
  const ownerId = rawOwner === undefined
    ? authorization.user.id
    : rawOwner === null || rawOwner === ""
      ? null
      : typeof rawOwner === "string" && uuidPattern.test(rawOwner)
        ? rawOwner
        : undefined;
  const amount = body.opportunity.amountKz;

  if (
    (contactType !== "person" && contactType !== "company") ||
    !name ||
    name.length === 0 ||
    email === undefined ||
    phone === undefined ||
    companyId === undefined ||
    companyName === undefined ||
    title === undefined ||
    productSlug === undefined ||
    productTitle === undefined ||
    notes === undefined ||
    followUpAt === undefined ||
    ownerId === undefined ||
    (email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
    (phone !== null && !/^\+?[0-9 ]{9,24}$/.test(phone)) ||
    (companyId !== null && !uuidPattern.test(companyId)) ||
    (companyName !== null && contactType !== "person") ||
    (companyId !== null && contactType !== "person") ||
    (productSlug !== null && !slugPattern.test(productSlug)) ||
    !title &&
      !(productTitle && productTitle.length > 0) ||
    (amount !== null && amount !== undefined &&
      (!Number.isSafeInteger(amount) || (amount as number) < 0 || (amount as number) > 2_000_000_000)) ||
    (followUpAt !== null && (Number.isNaN(Date.parse(followUpAt)) || !followUpAt.endsWith("Z")))
  ) {
    return NextResponse.json({ error: "invalid_contact" }, { status: 400 });
  }

  if (ownerId) {
    const staff = await listVisibleStaff("admin", authorization.user.id, null);
    if (!staff.some((person) => person.id === ownerId)) {
      return NextResponse.json({ error: "invalid_contact" }, { status: 400 });
    }
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("backoffice_create_crm_opportunity", {
    p_contact: {
      contact_type: contactType,
      name,
      email,
      phone,
      company_id: companyId,
      company_name: companyName,
      owner_id: ownerId,
    },
    p_opportunity: {
      title: title || productTitle,
      product_slug: productSlug,
      product_title: productTitle,
      amount_kz: amount ?? null,
      notes: notes ?? "",
      follow_up_at: followUpAt,
    },
    p_actor_id: authorization.user.id,
    p_actor_email: authorization.user.email ?? "",
  });

  if (error) {
    const notConfigured = isMissingCrm(error);
    if (!notConfigured) {
      console.error("[commercial] creating opportunity failed", error.code ?? "unknown");
    }
    return NextResponse.json(
      { error: notConfigured ? "commercial_not_configured" : "commercial_create_failed" },
      { status: notConfigured ? 503 : 500 },
    );
  }

  if (typeof data === "string" && uuidPattern.test(data)) {
    const created = await supabase.from("crm_opportunities").select("contact_id").eq("id", data).maybeSingle();
    const contactId = created.data?.contact_id;
    if (typeof contactId === "string") {
      const ownerUpdate = await supabase.from("crm_contacts").update({ owner_id: ownerId }).eq("id", contactId);
      if (ownerUpdate.error && !isMissingCrm(ownerUpdate.error)) {
        console.error("[commercial] saving contact owner failed", ownerUpdate.error.code ?? "unknown");
      }
    }
  }

  touchBackofficeData();
  return NextResponse.json({ opportunityId: data }, { status: 201 });
}
