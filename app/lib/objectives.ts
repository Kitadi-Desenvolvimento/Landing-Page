import {
  isDateOnly,
  objectivePeriodStart,
  objectivePeriodTypes,
  type ObjectivePeriodType,
} from "./objective-periods";

export const objectiveValueTypes = [
  "number",
  "percentage",
  "currency",
  "text",
  "boolean",
  "date",
  "custom",
] as const;

export type ObjectiveValueType = (typeof objectiveValueTypes)[number];
export type ObjectiveScopeType = "company" | "department" | "collaborator";

function isObjectiveScopeType(value: unknown): value is ObjectiveScopeType {
  return value === "company" || value === "department" || value === "collaborator";
}

function isObjectivePeriodType(value: unknown): value is ObjectivePeriodType {
  return typeof value === "string" &&
    objectivePeriodTypes.includes(value as ObjectivePeriodType);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isObjectiveValue(value: unknown, type: ObjectiveValueType) {
  if (value === null) return true;
  switch (type) {
    case "number":
    case "currency":
      return typeof value === "number" && Number.isFinite(value);
    case "percentage":
      return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
    case "text":
      return typeof value === "string" && value.length <= 4000;
    case "boolean":
      return typeof value === "boolean";
    case "date": {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }
    case "custom":
      return (typeof value === "string" && value.length <= 4000) ||
        typeof value === "number" || typeof value === "boolean" ||
        Array.isArray(value) || isRecord(value);
  }
}

function isValidProductSlug(slug: unknown): slug is string {
  return typeof slug === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

export function parseObjective(value: unknown) {
  if (!isRecord(value)) return null;
  const {
    title,
    description,
    valueType,
    targetValue,
    unit,
    active,
    scopeType,
    areaId,
    assignedTo,
    periodType,
    periodStart,
    alignedObjectiveId,
    dueDate,
    parentObjectiveId,
    productId,
  } = value;
  const normalizedDueDate = dueDate === "" || dueDate === undefined ? null : dueDate;
  const normalizedParentObjectiveId =
    parentObjectiveId === "" || parentObjectiveId === undefined ? null : parentObjectiveId;
  const normalizedAreaId = areaId === "" || areaId === undefined ? null : areaId;
  const normalizedAssignedTo = assignedTo === "" || assignedTo === undefined ? null : assignedTo;
  const normalizedAlignedObjectiveId =
    alignedObjectiveId === "" || alignedObjectiveId === undefined ? null : alignedObjectiveId;
  const normalizedProductId = productId === "" || productId === undefined ? null : productId;
  const validUuid = (id: unknown): id is string =>
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  if (
    typeof title !== "string" || !title.trim() || title.trim().length > 160 ||
    typeof description !== "string" || description.length > 2000 ||
    !isObjectiveScopeType(scopeType) ||
    (normalizedAreaId !== null && !validUuid(normalizedAreaId)) ||
    (normalizedAssignedTo !== null && !validUuid(normalizedAssignedTo)) ||
    (scopeType === "company" && (normalizedAreaId !== null || normalizedAssignedTo !== null)) ||
    (scopeType === "department" && (normalizedAreaId === null || normalizedAssignedTo !== null)) ||
    (scopeType === "collaborator" && normalizedAssignedTo === null) ||
    !isObjectivePeriodType(periodType) ||
    !isDateOnly(periodStart) ||
    objectivePeriodStart(periodType as ObjectivePeriodType, periodStart) !== periodStart ||
    (normalizedAlignedObjectiveId !== null && !validUuid(normalizedAlignedObjectiveId)) ||
    (normalizedParentObjectiveId !== null &&
      !validUuid(normalizedParentObjectiveId)) ||
    (normalizedDueDate !== null &&
      (typeof normalizedDueDate !== "string" ||
        !isDateOnly(normalizedDueDate))) ||
    (normalizedProductId !== null &&
      !isValidProductSlug(normalizedProductId)) ||
    typeof valueType !== "string" ||
    !objectiveValueTypes.includes(valueType as ObjectiveValueType) ||
    (targetValue !== null && targetValue !== undefined &&
      !isObjectiveValue(targetValue, valueType as ObjectiveValueType)) ||
    typeof unit !== "string" || unit.length > 40 ||
    typeof active !== "boolean"
  ) return null;

  return {
    title: title.trim(),
    description: description.trim(),
    scope_type: scopeType,
    area_id: normalizedAreaId,
    assigned_to: normalizedAssignedTo,
    period_type: periodType,
    period_start: periodStart,
    aligned_objective_id: normalizedAlignedObjectiveId,
    parent_objective_id: normalizedParentObjectiveId,
    due_date: normalizedDueDate,
    value_type: valueType,
    target_value: targetValue ?? null,
    unit: unit.trim(),
    active,
    product_id: normalizedProductId,
  };
}
