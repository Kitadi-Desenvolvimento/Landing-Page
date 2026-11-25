export function personLabel(name: string | null | undefined, email: string) {
  const trimmed = name?.trim() ?? "";
  return trimmed || email || "Sem nome";
}

export function personInitials(name: string | null | undefined, email: string) {
  const source = personLabel(name, email);
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "K";
}
