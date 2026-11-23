import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import {
  getCourseVariant,
  getProductPath,
  offersPublicCheckout,
} from "../../../course-data";
import { getPublishedProductBySlug } from "../../../lib/products";
import Checkout from "./checkout";
import ProductCheckout from "./product-checkout";
import { studentDiscountEnabled } from "../../../lib/students-server";

type CheckoutPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ variante?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: CheckoutPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { variante } = await searchParams;
  const product = await getPublishedProductBySlug(slug);
  const course = product?.data.course;
  const variant = course ? getCourseVariant(course, variante) : null;

  return {
    title: product
      ? course
        ? `Inscrição — ${product.data.title} (${variant?.label}) | Kitadi`
        : `Compra — ${product.data.title} | Kitadi`
      : "Produto não encontrado | Kitadi",
  };
}

export default async function CheckoutPage({
  params,
  searchParams,
}: CheckoutPageProps) {
  const { slug } = await params;
  const { variante } = await searchParams;
  const product = await getPublishedProductBySlug(slug);

  if (!product) notFound();
  if (!offersPublicCheckout(product.data)) {
    redirect(getProductPath({ slug: product.slug }));
  }

  if (!product.data.course) {
    return <ProductCheckout product={product.data} studentEnabled={studentDiscountEnabled()} />;
  }

  return <Checkout course={product.data.course} initialVariantId={variante} studentEnabled={studentDiscountEnabled()} />;
}
