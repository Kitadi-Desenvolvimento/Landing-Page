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

export function parseObjective(value: unknown) {
  if (!isRecord(value)) return null;
  const { title, description, valueType, targetValue, unit, active, areaId, dueDate } = value;
  const normalizedDueDate = dueDate === "" || dueDate === undefined ? null : dueDate;
  if (
    typeof title !== "string" || !title.trim() || title.trim().length > 160 ||
    typeof description !== "string" || description.length > 2000 ||
    typeof areaId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(areaId) ||
    (normalizedDueDate !== null &&
      (typeof normalizedDueDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDueDate) ||
        Number.isNaN(Date.parse(`${normalizedDueDate}T00:00:00.000Z`)) ||
        new Date(`${normalizedDueDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== normalizedDueDate)) ||
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
    area_id: areaId,
    due_date: normalizedDueDate,
    value_type: valueType,
    target_value: targetValue ?? null,
    unit: unit.trim(),
    active,
  };
}
