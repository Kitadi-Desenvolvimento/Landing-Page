export function isValidStageChangeReason(
  fromStage: string,
  toStage: string,
  reason: unknown,
): reason is string {
  return typeof reason === "string" &&
    reason.length <= 300 &&
    (fromStage === toStage || Boolean(reason.trim()));
}

function followUpMinute(value: string | null) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : Math.floor(time / 60_000);
}

/** A due follow-up closes when the stage changes, unless a different next contact was chosen. */
export function followUpAfterStageChange(
  previousFollowUpAt: string | null,
  nextFollowUpAt: string | null,
  stageChanged: boolean,
  due: boolean,
): string | null {
  if (!stageChanged || !due) return nextFollowUpAt;
  if (followUpMinute(previousFollowUpAt) === followUpMinute(nextFollowUpAt)) return null;
  return nextFollowUpAt;
}
