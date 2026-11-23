export function studentDiscountPercent(amountKz: number) {
  return amountKz >= 50_000 ? 25 : 15;
}

export function studentDiscountedAmount(amountKz: number) {
  return Math.round(amountKz * (100 - studentDiscountPercent(amountKz)) / 100);
}

export function formatStudentPrice(amountKz: number) {
  return `${new Intl.NumberFormat("pt-AO").format(amountKz)} Kz`;
}
