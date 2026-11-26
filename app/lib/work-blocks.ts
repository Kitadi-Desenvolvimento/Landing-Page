import "server-only";

import { sendBlockEmail } from "./block-email";
import { canManageObjective, loadObjectiveAccess } from "./objective-access";
import { isStaffSchemaMissing, listVisibleStaff, loadDisplayNames, type StaffPerson } from "./staff-profiles";
import { touchBackofficeData } from "./read-cache";
import { createSupabaseAdminClient } from "./supabase/admin";
import type { BackofficeRole } from "./supabase/require-admin";

export type BlockSubjectType = "objective" | "opportunity";

export type WorkBlockView = {
  id: string;
  subjectType: BlockSubjectType;
  subjectId: string;
  reason: string;
  title: string;
  createdAt: string;
  people: StaffPerson[];
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isBlockSubjectType(value: unknown): value is BlockSubjectType {
  return value === "objective" || value === "opportunity";
}

async function subjectTitle(subjectType: BlockSubjectType, subjectId: string) {
  const admin = createSupabaseAdminClient();
  if (subjectType === "objective") {
    const { data, error } = await admin.from("objectives").select("title").eq("id", subjectId).maybeSingle();
    if (error) throw error;
    return typeof data?.title === "string" ? data.title : "";
  }
  const { data, error } = await admin.from("crm_opportunities").select("title").eq("id", subjectId).maybeSingle();
  if (error) throw error;
  return typeof data?.title === "string" ? data.title : "";
}

async function assertCanBlock(
  role: BackofficeRole,
  userId: string,
  managerAreaIds: string[] | null,
  subjectType: BlockSubjectType,
  subjectId: string,
) {
  if (!uuidPattern.test(subjectId)) return "invalid_id" as const;
  const admin = createSupabaseAdminClient();
  if (subjectType === "opportunity") {
    if (role !== "admin") return "forbidden" as const;
    const { data, error } = await admin.from("crm_opportunities").select("id").eq("id", subjectId).maybeSingle();
    if (error) throw error;
    return data ? null : "block_subject_not_found" as const;
  }
  const { data, error } = await admin
    .from("objectives")
    .select("id,scope_type,area_id,assigned_to,archived")
    .eq("id", subjectId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.archived) return "block_subject_not_found" as const;
  const access = await loadObjectiveAccess(role, userId, role === "manager" ? managerAreaIds : null);
  return canManageObjective(access, data) ? null : "forbidden" as const;
}

function toView(
  row: { id: string; subject_type: string; subject_id: string; reason: string; created_at?: string },
  title: string,
  people: StaffPerson[],
): WorkBlockView {
  return {
    id: row.id,
    subjectType: row.subject_type === "opportunity" ? "opportunity" : "objective",
    subjectId: row.subject_id,
    reason: row.reason,
    title,
    createdAt: row.created_at ?? "",
    people,
  };
}

async function peopleForBlocks(rows: { id: string }[]) {
  if (rows.length === 0) return new Map<string, StaffPerson[]>();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("work_block_people")
    .select("block_id,user_id,email_sent_at")
    .in("block_id", rows.map((row) => row.id));
  if (error) throw error;
  const userIds = [...new Set((data ?? []).map((row) => row.user_id as string))];
  const users = new Map<string, string>();
  await Promise.all(userIds.map(async (userId) => {
    const lookup = await admin.auth.admin.getUserById(userId);
    if (lookup.data.user?.email) users.set(userId, lookup.data.user.email);
  }));
  const names = await loadDisplayNames(userIds);
  const grouped = new Map<string, StaffPerson[]>();
  for (const row of data ?? []) {
    const email = users.get(row.user_id) ?? "";
    const person = { id: row.user_id as string, email, displayName: names.get(row.user_id) ?? "" };
    grouped.set(row.block_id, [...(grouped.get(row.block_id) ?? []), person]);
  }
  return grouped;
}

export async function listOpenBlocks(subjectType?: BlockSubjectType, subjectId?: string) {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("work_blocks")
    .select("id,subject_type,subject_id,reason,created_at")
    .is("lifted_at", null)
    .order("created_at", { ascending: false });
  if (subjectType) query = query.eq("subject_type", subjectType);
  if (subjectId) query = query.eq("subject_id", subjectId);
  const { data, error } = await query;
  if (error) {
    if (isStaffSchemaMissing(error.code)) return [] as WorkBlockView[];
    throw error;
  }
  const rows = data ?? [];
  const [people, titles] = await Promise.all([peopleForBlocks(rows), subjectTitles(rows)]);
  return rows.map((row) => {
    const subjectType = row.subject_type === "opportunity" ? "opportunity" : "objective";
    return toView(row, titles.get(`${subjectType}:${row.subject_id}`) ?? "", people.get(row.id) ?? []);
  });
}

async function subjectTitles(rows: { subject_type: string; subject_id: string }[]) {
  const admin = createSupabaseAdminClient();
  const titles = new Map<string, string>();
  async function fill(subjectType: BlockSubjectType, ids: string[]) {
    const table = subjectType === "objective" ? "objectives" : "crm_opportunities";
    for (let index = 0; index < ids.length; index += 150) {
      const slice = ids.slice(index, index + 150);
      if (slice.length === 0) continue;
      const { data, error } = await admin.from(table).select("id,title").in("id", slice);
      if (error) throw error;
      for (const row of data ?? []) titles.set(`${subjectType}:${row.id}`, typeof row.title === "string" ? row.title : "");
    }
  }
  const objectiveIds = [...new Set(rows.filter((row) => row.subject_type !== "opportunity").map((row) => row.subject_id))];
  const opportunityIds = [...new Set(rows.filter((row) => row.subject_type === "opportunity").map((row) => row.subject_id))];
  await Promise.all([fill("objective", objectiveIds), fill("opportunity", opportunityIds)]);
  return titles;
}

export async function saveWorkBlock(input: {
  role: BackofficeRole;
  userId: string;
  managerAreaIds: string[] | null;
  subjectType: BlockSubjectType;
  subjectId: string;
  reason: string;
  userIds: string[];
}) {
  const permission = await assertCanBlock(
    input.role,
    input.userId,
    input.managerAreaIds,
    input.subjectType,
    input.subjectId,
  );
  if (permission) return { error: permission };

  const staff = await listVisibleStaff(input.role, input.userId, input.managerAreaIds);
  const allowed = new Set(staff.map((person) => person.id));
  const userIds = [...new Set(input.userIds)];
  if (userIds.some((id) => !allowed.has(id))) return { error: "invalid_block_person" as const };
  const reason = input.reason.trim();
  if (userIds.length > 0 && (reason.length < 1 || reason.length > 500)) return { error: "invalid_block" as const };
  if (userIds.length > 12) return { error: "invalid_block" as const };

  const admin = createSupabaseAdminClient();
  const existing = await admin
    .from("work_blocks")
    .select("id")
    .eq("subject_type", input.subjectType)
    .eq("subject_id", input.subjectId)
    .is("lifted_at", null)
    .maybeSingle();
  if (existing.error) throw existing.error;

  if (userIds.length === 0) {
    if (!existing.data) return { block: null, emailFailed: false };
    const lifted = await admin
      .from("work_blocks")
      .update({ lifted_at: new Date().toISOString(), lifted_by: input.userId })
      .eq("id", existing.data.id);
    if (lifted.error) throw lifted.error;
    touchBackofficeData();
    return { block: null, emailFailed: false };
  }

  let blockId = existing.data?.id ?? "";
  if (existing.data) {
    const updated = await admin.from("work_blocks").update({ reason }).eq("id", existing.data.id);
    if (updated.error) throw updated.error;
  } else {
    const inserted = await admin
      .from("work_blocks")
      .insert({
        subject_type: input.subjectType,
        subject_id: input.subjectId,
        reason,
        created_by: input.userId,
      })
      .select("id")
      .single();
    if (inserted.error) throw inserted.error;
    blockId = inserted.data.id;
  }

  const current = await admin.from("work_block_people").select("user_id,email_sent_at").eq("block_id", blockId);
  if (current.error) throw current.error;
  const currentIds = new Set((current.data ?? []).map((row) => row.user_id as string));
  const remove = [...currentIds].filter((id) => !userIds.includes(id));
  if (remove.length > 0) {
    const deleted = await admin.from("work_block_people").delete().eq("block_id", blockId).in("user_id", remove);
    if (deleted.error) throw deleted.error;
  }
  const additions = userIds.filter((id) => !currentIds.has(id));
  if (additions.length > 0) {
    const insertedPeople = await admin.from("work_block_people").insert(
      additions.map((id) => ({ block_id: blockId, user_id: id })),
    );
    if (insertedPeople.error) throw insertedPeople.error;
  }

  touchBackofficeData();
  const title = await subjectTitle(input.subjectType, input.subjectId);
  const kind = input.subjectType === "objective" ? "objectivo" : "oportunidade";
  let emailFailed = false;
  for (const personId of additions) {
    const person = staff.find((item) => item.id === personId);
    if (!person) continue;
    const sent = await sendBlockEmail({
      blockId,
      userId: person.id,
      email: person.email,
      displayName: person.displayName,
      subjectTitle: title,
      subjectKind: kind,
      reason,
    });
    if (!sent.ok) {
      emailFailed = true;
      continue;
    }
    await admin
      .from("work_block_people")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("block_id", blockId)
      .eq("user_id", person.id);
  }

  const [block] = await listOpenBlocks(input.subjectType, input.subjectId);
  return { block: block ?? null, emailFailed };
}
