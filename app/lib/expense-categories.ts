export const expenseCategories = [
  { id: "trainers", label: "Formadores" },
  { id: "venue", label: "Espaço e logística" },
  { id: "marketing", label: "Marketing" },
  { id: "platforms", label: "Plataformas" },
  { id: "commissions", label: "Comissões" },
  { id: "other", label: "Outros" },
] as const;

export type ExpenseCategory = (typeof expenseCategories)[number]["id"];

export function expenseCategoryLabel(id: string) {
  return expenseCategories.find((category) => category.id === id)?.label ?? id;
}
