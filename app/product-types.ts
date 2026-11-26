import type { Course, ProductListing } from "./course-data";

export type EbookFile = {
  /** Caminho do PDF original no bucket privado "ebooks". */
  path: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
};

export type ProductCrossSell = {
  slug: string;
  reason: string;
};

export type ProductData = ProductListing & {
  course?: Course | null;
  price?: string;
  priceAmount?: number;
  edition?: string;
  crossSell?: ProductCrossSell[];
  ebook?: EbookFile;
};

export type ProductRecord = {
  slug: string;
  data: ProductData;
  published: boolean;
  sort_order: number;
};
