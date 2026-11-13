import type { Course, ProductListing } from "./course-data";

export type ProductData = ProductListing & {
  course?: Course | null;
  price?: string;
  priceAmount?: number;
};

export type ProductRecord = {
  slug: string;
  data: ProductData;
  published: boolean;
  sort_order: number;
};
