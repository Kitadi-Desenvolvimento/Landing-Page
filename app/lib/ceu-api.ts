export type CeuStudent = {
  cardNumber: string;
  name: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseCeuStudentResponse(value: unknown): CeuStudent | null {
  if (!isRecord(value) || value.success !== true || !isRecord(value.data)) {
    return null;
  }

  const { card_number: cardNumber, name } = value.data;
  if (
    typeof cardNumber !== "string" ||
    !cardNumber.trim() ||
    typeof name !== "string" ||
    !name.trim()
  ) {
    return null;
  }

  return { cardNumber: cardNumber.trim(), name: name.trim() };
}
