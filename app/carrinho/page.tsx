import type { Metadata } from "next";
import { toCartCatalog } from "../lib/cross-sell";
import { getPublishedProducts } from "../lib/products";
import { studentDiscountEnabled } from "../lib/students-server";
import CartView from "./cart-view";

export const metadata: Metadata = {
  title: "Carrinho | Kitadi",
};

export default async function CartPage() {
  const products = await getPublishedProducts();
  const catalog = products.flatMap((product) => {
    const entry = toCartCatalog(product.data);
    return entry ? [entry] : [];
  });

  return <CartView catalog={catalog} studentEnabled={studentDiscountEnabled()} />;
}
