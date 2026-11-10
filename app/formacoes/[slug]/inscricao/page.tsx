import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import {
  getCourseBySlug,
  getCourseVariant,
  getProductPath,
} from "../../../course-data";
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
  const course = getCourseBySlug(slug);
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
  const course = getCourseBySlug(slug);

  if (!course) notFound();
  if (!course.variants.length) redirect(getProductPath(course));

  return <Checkout course={course} initialVariantId={variante} />;
}
