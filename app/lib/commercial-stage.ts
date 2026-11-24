export function isValidStageChangeReason(
  fromStage: string,
  toStage: string,
  reason: unknown,
): reason is string {
  return typeof reason === "string" &&
    reason.length <= 300 &&
    (fromStage === toStage || Boolean(reason.trim()));
}
