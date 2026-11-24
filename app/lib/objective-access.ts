import "server-only";

import {
  canAlignObjective,
  objectivePeriodEnd,
  type ObjectivePeriodType,
} from "./objective-periods";
import { createSupabaseAdminClient } from "./supabase/admin";

export type ObjectiveAccess = {
  role: "admin" | "manager" | "collaborator";
  userId: string;
  areaIds: string[] | null;
  memberIds: string[] | null;
  collaborators: { id: string; email: string; areaIds: string[] }[];
};

type ObjectiveScope = {
  scope_type: "company" | "department" | "collaborator";
  area_id: string | null;
  assigned_to: string | null;
};

export async function loadObjectiveAccess(
  role: ObjectiveAccess["role"],
  userId: string,
  managerAreaIds: string[] | null,
): Promise<ObjectiveAccess> {
  const admin = createSupabaseAdminClient();
  if (role === "admin") {
    const membershipsResult = await admin.from("objective_area_members").select("area_id,user_id");
    if (membershipsResult.error) throw new Error("Objective member lookup failed");
    const memberships = membershipsResult.data ?? [];
    const areaIdsByUser = new Map<string, string[]>();
    for (const membership of memberships) {
      areaIdsByUser.set(membership.user_id, [
        ...(areaIdsByUser.get(membership.user_id) ?? []),
        membership.area_id,
      ]);
    }

    const collaborators: ObjectiveAccess["collaborators"] = [];
    for (let page = 1; ; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error("Objective collaborator lookup failed");
      collaborators.push(
        ...data.users
          .filter((user) => user.app_metadata.role === "collaborator")
          .map((user) => ({
            id: user.id,
            email: user.email ?? "",
            areaIds: areaIdsByUser.get(user.id) ?? [],
          })),
      );
      if (data.users.length < 1000) break;
    }

    return { role, userId, areaIds: null, memberIds: null, collaborators };
  }

  let areaIds = managerAreaIds ?? [];
  if (role === "collaborator") {
    const { data, error } = await admin
      .from("objective_area_members")
      .select("area_id")
      .eq("user_id", userId);
    if (error) throw new Error("Objective area lookup failed");
    areaIds = [...new Set((data ?? []).map((membership) => membership.area_id))];
    return {
      role,
      userId,
      areaIds,
      memberIds: [userId],
      collaborators: [],
    };
  }

  if (areaIds.length === 0) {
    return { role, userId, areaIds, memberIds: [userId], collaborators: [] };
  }

  const { data: memberships, error: membershipsError } = await admin
    .from("objective_area_members")
    .select("area_id,user_id")
    .in("area_id", areaIds);
  if (membershipsError) throw new Error("Objective member lookup failed");
  const memberIds = [...new Set([
    userId,
    ...(memberships ?? []).map((membership) => membership.user_id),
  ])];
  const areaIdsByUser = new Map<string, string[]>();
  for (const membership of memberships ?? []) {
    areaIdsByUser.set(membership.user_id, [
      ...(areaIdsByUser.get(membership.user_id) ?? []),
      membership.area_id,
    ]);
  }

  const collaborators: ObjectiveAccess["collaborators"] = [];
  for (const memberId of memberIds) {
    const { data, error } = await admin.auth.admin.getUserById(memberId);
    if (error) throw new Error("Objective collaborator lookup failed");
    if (data.user?.app_metadata.role === "collaborator") {
      collaborators.push({
        id: memberId,
        email: data.user.email ?? "",
        areaIds: areaIdsByUser.get(memberId) ?? [],
      });
    }
  }

  return { role, userId, areaIds, memberIds, collaborators };
}

export function canReadObjective(access: ObjectiveAccess, objective: ObjectiveScope) {
  if (access.role === "admin") return true;
  if (objective.scope_type === "company") return true;
  if (objective.scope_type === "collaborator" && objective.assigned_to === access.userId) {
    return true;
  }
  return Boolean(objective.area_id && access.areaIds?.includes(objective.area_id));
}

export function canManageObjective(access: ObjectiveAccess, objective: ObjectiveScope) {
  if (access.role === "admin") return true;
  if (access.role === "collaborator") {
    return objective.scope_type === "collaborator" &&
      objective.assigned_to === access.userId;
  }
  if (objective.scope_type === "company" || !objective.area_id ||
      !access.areaIds?.includes(objective.area_id)) {
    return false;
  }
  if (objective.scope_type === "collaborator") {
    return Boolean(access.memberIds?.includes(objective.assigned_to ?? ""));
  }
  return true;
}

export function canAssignCollaborator(
  access: ObjectiveAccess,
  areaId: string | null,
  assignedTo: string | null,
) {
  if (!assignedTo) return false;
  if (access.role === "collaborator") {
    return assignedTo === access.userId &&
      (!areaId || access.areaIds?.includes(areaId) === true);
  }
  const collaborator = access.collaborators.find((item) => item.id === assignedTo);
  if (!collaborator) return false;
  if (access.role === "admin") {
    return !areaId || collaborator.areaIds.includes(areaId);
  }
  return Boolean(
    areaId &&
    access.areaIds?.includes(areaId) &&
    collaborator.areaIds.includes(areaId),
  );
}

export async function validateObjectiveScope(
  access: ObjectiveAccess,
  objective: ObjectiveScope,
  existingAreaId?: string | null,
) {
  if (!canManageObjective(access, objective)) return "objective_scope_forbidden";
  if (
    objective.scope_type === "collaborator" &&
    !canAssignCollaborator(access, objective.area_id, objective.assigned_to)
  ) {
    return "invalid_objective_assignee";
  }
  if (!objective.area_id || objective.area_id === existingAreaId) return null;

  const { data: area, error } = await createSupabaseAdminClient()
    .from("objective_areas")
    .select("id")
    .eq("id", objective.area_id)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(`Objective area lookup failed: ${error.code}`);
  return area ? null : "invalid_objective_area";
}

export async function validateObjectiveRelations(
  access: ObjectiveAccess,
  objective: {
    id?: string;
    scope_type: "company" | "department" | "collaborator";
    area_id: string | null;
    assigned_to: string | null;
    parent_objective_id: string | null;
    aligned_objective_id: string | null;
    period_type: ObjectivePeriodType;
    period_start: string;
  },
) {
  const admin = createSupabaseAdminClient();
  if (objective.parent_objective_id) {
    const { data: parent, error } = await admin.from("objectives")
      .select("id,scope_type,area_id,assigned_to,parent_objective_id,period_type,period_start,active,archived")
      .eq("id", objective.parent_objective_id)
      .maybeSingle();
    if (error) throw new Error(`Objective parent lookup failed: ${error.code}`);
    if (
      !parent ||
      parent.id === objective.id ||
      parent.parent_objective_id ||
      parent.scope_type !== objective.scope_type ||
      parent.area_id !== objective.area_id ||
      parent.assigned_to !== objective.assigned_to ||
      (parent.period_type !== null && parent.period_type !== objective.period_type) ||
      (parent.period_start !== null && parent.period_start !== objective.period_start) ||
      !parent.active ||
      parent.archived ||
      !canManageObjective(access, parent)
    ) {
      return "invalid_parent_objective";
    }
  }

  if (!objective.aligned_objective_id) return null;
  if (objective.parent_objective_id) return "invalid_objective_alignment";
  const { data: aligned, error } = await admin.from("objectives")
    .select("id,scope_type,area_id,assigned_to,parent_objective_id,period_type,period_start,active,archived")
    .eq("id", objective.aligned_objective_id)
    .maybeSingle();
  if (error) throw new Error(`Objective alignment lookup failed: ${error.code}`);
  if (
    !aligned ||
    aligned.id === objective.id ||
    aligned.parent_objective_id ||
    aligned.scope_type !== objective.scope_type ||
    aligned.area_id !== objective.area_id ||
    aligned.assigned_to !== objective.assigned_to ||
    !aligned.period_type ||
    !canAlignObjective(
      objective.period_type,
      aligned.period_type as ObjectivePeriodType,
    ) ||
    !aligned.period_start ||
    !canManageObjective(access, aligned) ||
    !aligned.active ||
    aligned.archived
  ) {
    return "invalid_objective_alignment";
  }

  const alignedEnd = objectivePeriodEnd(
    aligned.period_type as ObjectivePeriodType,
    aligned.period_start,
  );
  if (
    !alignedEnd ||
    objective.period_start < aligned.period_start ||
    objective.period_start >= alignedEnd
  ) {
    return "invalid_objective_alignment";
  }
  return null;
}
