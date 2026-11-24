export const objectivePeriodTypes = ["annual", "monthly", "weekly", "daily"] as const;
export type ObjectivePeriodType = (typeof objectivePeriodTypes)[number];
export type ReportPeriod = "day" | "week" | "month";

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function objectivePeriodStart(type: ObjectivePeriodType, anchor: string) {
  if (!isDateOnly(anchor)) return null;
  const date = toDate(anchor);

  if (type === "annual") {
    date.setUTCMonth(0, 1);
  } else if (type === "monthly") {
    date.setUTCDate(1);
  } else if (type === "weekly") {
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  }

  return dateString(date);
}

export function objectivePeriodEnd(type: ObjectivePeriodType, start: string) {
  if (!isDateOnly(start) || objectivePeriodStart(type, start) !== start) return null;
  const date = toDate(start);
  if (type === "annual") date.setUTCFullYear(date.getUTCFullYear() + 1);
  else if (type === "monthly") date.setUTCMonth(date.getUTCMonth() + 1);
  else if (type === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  else date.setUTCDate(date.getUTCDate() + 1);
  return dateString(date);
}

export function reportDateRange(period: ReportPeriod, anchor: string) {
  if (!isDateOnly(anchor)) return null;
  const type: ObjectivePeriodType =
    period === "day" ? "daily" : period === "week" ? "weekly" : "monthly";
  const fromDate = objectivePeriodStart(type, anchor);
  if (!fromDate) return null;
  const toDate = objectivePeriodEnd(type, fromDate);
  if (!toDate) return null;
  const from = new Date(`${fromDate}T00:00:00+01:00`).toISOString();
  const to = new Date(`${toDate}T00:00:00+01:00`).toISOString();
  return { fromDate, toDate, from, to };
}

export function canAlignObjective(
  childType: ObjectivePeriodType,
  parentType: ObjectivePeriodType,
) {
  return (
    (childType === "daily" && parentType === "weekly") ||
    (childType === "weekly" && parentType === "monthly") ||
    (childType === "monthly" && parentType === "annual")
  );
}
