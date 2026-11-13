import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import {
  getCourseVariant,
  getProductPath,
  offersCheckout,
} from "../../../course-data";
import { getPublishedCourseBySlug } from "../../../lib/products";
import Checkout from "./checkout";

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
  const course = await getPublishedCourseBySlug(slug);
  const variant = course ? getCourseVariant(course, variante) : null;

  return {
    title: course
      ? `Inscrição — ${course.title} (${variant?.label}) | Kitadi`
      : "Produto não encontrado | Kitadi",
  };
}

export default async function CheckoutPage({
  params,
  searchParams,
}: CheckoutPageProps) {
  const { slug } = await params;
  const { variante } = await searchParams;
  const course = await getPublishedCourseBySlug(slug);

  if (!course) notFound();
  if (!offersCheckout(course)) redirect(getProductPath(course));

  return <Checkout course={course} initialVariantId={variante} />;
}
