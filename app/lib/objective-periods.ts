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

const periodRank: Record<ObjectivePeriodType, number> = {
  annual: 0,
  monthly: 1,
  weekly: 2,
  daily: 3,
};

export function objectivePeriodRank(period: ObjectivePeriodType | null | undefined) {
  if (!period) return 4;
  return periodRank[period];
}

export function compareObjectivesByPeriod<T extends { period_type: ObjectivePeriodType | null; title: string }>(left: T, right: T) {
  return objectivePeriodRank(left.period_type) - objectivePeriodRank(right.period_type)
    || left.title.localeCompare(right.title, "pt");
}

export function objectivePeriodGroupLabel(period: ObjectivePeriodType | null) {
  if (period === "annual") return "Anuais";
  if (period === "monthly") return "Mensais";
  if (period === "weekly") return "Semanais";
  if (period === "daily") return "Diários";
  return "Sem período";
}

export function objectivePeriodPresence(period: ObjectivePeriodType | null) {
  if (period === "annual") {
    return {
      borderWidth: "border-l-4",
      borderColor: "border-l-[#8d3d4a]",
      wash: "bg-[#fdf8f8]",
      pad: "py-5",
      title: "text-[15px] font-bold text-[#2c2424]",
      detailTitle: "text-[18px]",
      bar: "h-2",
      badge: "bg-[#f6ecee] px-2.5 py-1 text-[10px] font-bold text-[#8d3d4a]",
      group: "text-[11px] font-bold tracking-[0.08em] text-[#8d3d4a]",
    };
  }
  if (period === "monthly") {
    return {
      borderWidth: "border-l-[3px]",
      borderColor: "border-l-[#c4923a]",
      wash: "bg-[#fffaf6]",
      pad: "py-4",
      title: "text-[13px] font-bold text-[#352d2e]",
      detailTitle: "text-[16px]",
      bar: "h-1.5",
      badge: "bg-[#f8f1e4] px-2 py-0.5 text-[9px] font-bold text-[#8a6232]",
      group: "text-[10px] font-bold tracking-[0.08em] text-[#8a6232]",
    };
  }
  if (period === "weekly") {
    return {
      borderWidth: "border-l-2",
      borderColor: "border-l-[#7a4e86]",
      wash: "",
      pad: "py-3.5",
      title: "text-[12px] font-semibold text-[#352d2e]",
      detailTitle: "text-[15px]",
      bar: "h-1.5",
      badge: "bg-[#f0e9f1] px-2 py-0.5 text-[9px] font-bold text-[#6e4b71]",
      group: "text-[10px] font-semibold tracking-[0.08em] text-[#6e4b71]",
    };
  }
  return {
    borderWidth: "border-l-2",
    borderColor: "border-l-[#d9d1cd]",
    wash: "",
    pad: "py-3",
    title: "text-[12px] font-medium text-[#5c534f]",
    detailTitle: "text-[14px]",
    bar: "h-1",
    badge: "bg-[#f4f1ef] px-2 py-0.5 text-[9px] font-semibold text-[#6a615e]",
    group: "text-[10px] font-semibold tracking-[0.08em] text-[#8a807c]",
  };
}
