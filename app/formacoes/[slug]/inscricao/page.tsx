import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { courses } from "../../../course-data";
import Checkout from "./checkout";

type CheckoutPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: CheckoutPageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = courses.find((item) => item.slug === slug);

  return {
    title: course
      ? `Inscrição — ${course.title} | Kitadi`
      : "Formação não encontrada | Kitadi",
  };
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { slug } = await params;
  const course = courses.find((item) => item.slug === slug);

  if (!course) notFound();

  return <Checkout course={course} />;
}
