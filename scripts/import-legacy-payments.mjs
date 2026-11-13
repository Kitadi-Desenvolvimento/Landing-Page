import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { courses } from "../app/course-data.ts";

const source = process.env.VERCEL
  ? "/tmp/payments.json"
  : new URL("../.data/payments.json", import.meta.url);

let legacyOrders;
try {
  legacyOrders = JSON.parse(await readFile(source, "utf8"));
} catch (error) {
  if (error?.code === "ENOENT") {
    console.log("Não há ficheiro local de pagamentos para importar.");
    process.exit(0);
  }
  throw error;
}

if (!Array.isArray(legacyOrders)) {
  throw new Error("O ficheiro local de pagamentos tem um formato inválido.");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceRoleKey) {
  throw new Error("Configure o Supabase no .env.local antes da importação.");
}

const rows = legacyOrders.map((order) => {
  if (
    !order ||
    typeof order.reference !== "string" ||
    typeof order.amountKz !== "number" ||
    typeof order.courseSlug !== "string" ||
    typeof order.variantId !== "string" ||
    typeof order.name !== "string" ||
    typeof order.email !== "string" ||
    typeof order.phone !== "string" ||
    !["pending", "accepted", "rejected"].includes(order.status) ||
    typeof order.createdAt !== "string" ||
    typeof order.updatedAt !== "string"
  ) {
    throw new Error("O ficheiro local contém um pagamento com formato inválido.");
  }

  const course = courses.find((item) => item.slug === order.courseSlug);
  const variant = course?.variants.find((item) => item.id === order.variantId);
  return {
    reference: order.reference,
    amount_kz: order.amountKz,
    currency: "AOA",
    course_slug: order.courseSlug,
    product_title: course?.title ?? order.courseSlug,
    variant_id: order.variantId,
    variant_label: variant?.label ?? order.variantId,
    customer_name: order.name,
    customer_email: order.email,
    customer_phone: order.phone,
    status: order.status,
    payment_provider: "wipay",
    payment_method: null,
    provider_status: null,
    provider_transaction_id: null,
    reason: typeof order.reason === "string" ? order.reason : null,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    paid_at: order.status === "accepted" ? order.updatedAt : null,
  };
});

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

const { error } = await supabase
  .from("payment_orders")
  .upsert(rows, { onConflict: "reference", ignoreDuplicates: true });

if (error) {
  throw new Error(
    `Importação de pagamentos falhou (${error.code ?? "erro_supabase"}). Aplique primeiro a migração de pagamentos.`,
  );
}

console.log(`Importação verificada: ${rows.length} registos locais processados.`);
