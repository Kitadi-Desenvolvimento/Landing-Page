"use client";

export const CART_EVENT = "kitadi-cart";
export const CART_LIMIT = 6;

export type StoredCartLine = {
  slug: string;
  variantId: string;
  title: string;
  variantLabel: string;
  amountKz: number;
  image: string;
};

const storageKey = "kitadi-cart";

function isLine(value: unknown): value is StoredCartLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.slug === "string" &&
    typeof line.variantId === "string" &&
    typeof line.title === "string" &&
    typeof line.variantLabel === "string" &&
    typeof line.amountKz === "number" &&
    typeof line.image === "string"
  );
}

export function readCart(): StoredCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLine).slice(0, CART_LIMIT);
  } catch {
    return [];
  }
}

export function writeCart(lines: StoredCartLine[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(lines.slice(0, CART_LIMIT)));
  window.dispatchEvent(new Event(CART_EVENT));
}

export function addCartLine(line: StoredCartLine) {
  const current = readCart();
  const exists = current.some((item) => item.slug === line.slug);
  if (!exists && current.length >= CART_LIMIT) return "full" as const;
  writeCart([...current.filter((item) => item.slug !== line.slug), line]);
  return exists ? "updated" as const : "added" as const;
}

export function removeCartLine(slug: string) {
  writeCart(readCart().filter((item) => item.slug !== slug));
}

export function clearCart() {
  writeCart([]);
}
