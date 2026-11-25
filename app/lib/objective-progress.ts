export type ObjectiveProgressMeasure = {
  percent: number | null;
  inherited: boolean;
  keyResultCount: number;
  keyResultsWithValue: number;
};

type ProgressObjective = {
  id: string;
  value_type: string;
  target_value: unknown;
};

function numeric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function sameValue(current: unknown, target: unknown) {
  if (current === target) return true;
  return typeof target === "object" && target !== null && JSON.stringify(current) === JSON.stringify(target);
}

export function subjectProgressPercent(valueType: string, target: unknown, current: unknown) {
  const goal = numeric(target);
  if ((valueType === "number" || valueType === "percentage" || valueType === "currency") && goal !== null && goal > 0) {
    const actual = numeric(current);
    return actual === null ? 0 : (actual / goal) * 100;
  }
  if (target === null || target === undefined) return null;
  if (current === undefined || current === null) return 0;
  return sameValue(current, target) ? 100 : 0;
}

export function measureObjectiveProgress(
  objective: ProgressObjective,
  keyResults: ProgressObjective[],
  latestValue: (id: string) => unknown,
): ObjectiveProgressMeasure {
  const measurable = keyResults
    .map((item) => subjectProgressPercent(item.value_type, item.target_value, latestValue(item.id)))
    .filter((percent): percent is number => percent !== null);
  if (keyResults.length > 0) {
    return {
      percent: measurable.length === 0 ? null : measurable.reduce((sum, percent) => sum + percent, 0) / measurable.length,
      inherited: true,
      keyResultCount: keyResults.length,
      keyResultsWithValue: keyResults.filter((item) => latestValue(item.id) !== undefined && latestValue(item.id) !== null).length,
    };
  }
  return {
    percent: subjectProgressPercent(objective.value_type, objective.target_value, latestValue(objective.id)),
    inherited: false,
    keyResultCount: 0,
    keyResultsWithValue: 0,
  };
}

export function formatProgressPercent(percent: number) {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 }).format(percent);
}

export function inheritedProgressLabel(measure: ObjectiveProgressMeasure) {
  if (!measure.inherited || measure.percent === null) return "Os resultados ainda não têm um alvo para comparar.";
  const count = `${measure.keyResultCount} ${measure.keyResultCount === 1 ? "KR" : "KRs"}`;
  const percent = `${formatProgressPercent(measure.percent)}%`;
  if (measure.keyResultsWithValue === 0) return `${percent} · média de ${count}, ainda sem registo.`;
  return `${percent} · média de ${count}.`;
}
