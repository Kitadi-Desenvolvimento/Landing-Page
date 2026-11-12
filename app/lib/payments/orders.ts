import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type KitadiOrder = {
  reference: string;
  amountKz: number;
  courseSlug: string;
  variantId: string;
  name: string;
  email: string;
  phone: string;
  status: "pending" | "accepted" | "rejected";
  reason?: string;
  createdAt: string;
  updatedAt: string;
};

const filePath = path.join(process.cwd(), ".data", "payments.json");

async function readAll(): Promise<KitadiOrder[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as KitadiOrder[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(orders: KitadiOrder[]) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(orders, null, 2));
}

export function newKitadiReference() {
  return `KT${randomUUID().replace(/-/g, "").slice(0, 13).toUpperCase()}`;
}

export function isKitadiReference(reference: string) {
  return /^KT[A-Z0-9]{13}$/i.test(reference.trim());
}

export async function saveOrder(order: KitadiOrder) {
  const orders = await readAll();
  orders.push(order);
  await writeAll(orders);
}

export async function getOrder(reference: string) {
  const orders = await readAll();
  return (
    orders.find((item) => item.reference.toLowerCase() === reference.toLowerCase()) ?? null
  );
}

export async function updateOrder(reference: string, patch: Partial<KitadiOrder>) {
  const orders = await readAll();
  const index = orders.findIndex(
    (item) => item.reference.toLowerCase() === reference.toLowerCase(),
  );
  if (index < 0) return null;
  orders[index] = {
    ...orders[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await writeAll(orders);
  return orders[index];
}
