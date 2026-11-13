import type { ProductData } from "../product-types";

export type ProductVariantInput = {
  id: string;
  priceAmount: number;
};

export type ProductInput = {
  title: string;
  category: string;
  shortName: string;
  tagline: string;
  image: string;
  statusLabel: string;
  modality: string;
  published: boolean;
  priceAmount: number | null;
  variants: ProductVariantInput[];
};

export function parseProductInput(value: unknown): ProductInput | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const input = value as Record<string, unknown>;
  const priceAmount =
    input.priceAmount === null || input.priceAmount === ""
      ? null
      : typeof input.priceAmount === "number"
        ? input.priceAmount
        : typeof input.priceAmount === "string" && /^\d+$/.test(input.priceAmount)
          ? Number(input.priceAmount)
          : Number.NaN;
  const variants = input.variants;
  const stringKeys = [
    "title",
    "category",
    "shortName",
    "tagline",
    "image",
    "statusLabel",
    "modality",
  ] as const;
  if (
    stringKeys.some(
      (key) =>
        typeof input[key] !== "string" ||
        !input[key].trim() ||
        input[key].trim().length > (key === "tagline" ? 300 : 160),
    ) ||
    typeof input.published !== "boolean"
    || !(
      priceAmount === null ||
      (Number.isSafeInteger(priceAmount) &&
        priceAmount >= 0 &&
        priceAmount <= 2_000_000_000)
    )
    || !Array.isArray(variants)
  ) {
    return null;
  }

  const parsedVariants = variants.map((variant) => {
    if (
      typeof variant !== "object" ||
      variant === null ||
      !("id" in variant) ||
      typeof variant.id !== "string" ||
      !/^[a-z0-9][a-z0-9_-]{0,39}$/.test(variant.id) ||
      !("priceAmount" in variant) ||
      typeof variant.priceAmount !== "number" ||
      !Number.isSafeInteger(variant.priceAmount) ||
      variant.priceAmount < 0 ||
      variant.priceAmount > 2_000_000_000
    ) {
      return null;
    }
    return { id: variant.id, priceAmount: variant.priceAmount };
  });
  const validVariants = parsedVariants.filter(
    (variant): variant is ProductVariantInput => variant !== null,
  );
  if (
    validVariants.length !== parsedVariants.length ||
    new Set(validVariants.map((variant) => variant.id)).size !==
      validVariants.length
  ) {
    return null;
  }

  const image = (input.image as string).trim();
  if (!image.startsWith("/") || image.startsWith("//")) return null;

  return {
    title: (input.title as string).trim(),
    category: (input.category as string).trim(),
    shortName: (input.shortName as string).trim(),
    tagline: (input.tagline as string).trim(),
    image,
    statusLabel: (input.statusLabel as string).trim(),
    modality: (input.modality as string).trim(),
    published: input.published,
    priceAmount,
    variants: validVariants,
  };
}

export function productSlug(title: string) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function makeProductData(
  input: ProductInput,
  existing?: ProductData,
  slug?: string,
): ProductData {
  const next: ProductData = {
    ...existing,
    slug: slug ?? existing?.slug ?? productSlug(input.title),
    category: input.category,
    title: input.title,
    shortName: input.shortName,
    tagline: input.tagline,
    image: input.image,
    coverImage: existing?.coverImage ?? input.image,
    alt: input.title,
    statusLabel: input.statusLabel,
    imageMode: existing?.imageMode ?? "object",
    modality: input.modality,
    whatsappCta: existing?.whatsappCta ?? true,
    whatsappOnly: existing?.whatsappOnly ?? !existing?.course,
  };

  if (input.priceAmount !== null) {
    next.priceAmount = input.priceAmount;
    next.price = formatProductPrice(input.priceAmount);
  } else {
    delete next.priceAmount;
    delete next.price;
  }

  if (existing?.course) {
    const variantPrices = new Map(
      input.variants.map((variant) => [variant.id, variant.priceAmount]),
    );
    const updatedVariants = existing.course.variants.map((variant) => {
      const priceAmount = variantPrices.get(variant.id) ?? variant.priceAmount;
      return {
        ...variant,
        priceAmount,
        price: formatProductPrice(priceAmount),
      };
    });
    const basePriceAmount =
      input.priceAmount ??
      updatedVariants[0]?.priceAmount ??
      existing.course.priceAmount;
    next.course = {
      ...existing.course,
      slug: next.slug,
      category: input.category,
      title: input.title,
      shortName: input.shortName,
      tagline: input.tagline,
      image: input.image,
      coverImage: existing.course.coverImage ?? input.image,
      alt: input.title,
      statusLabel: input.statusLabel,
      modality: input.modality,
      priceAmount: basePriceAmount,
      price: formatProductPrice(basePriceAmount),
      variants: updatedVariants,
    };
    next.priceAmount = basePriceAmount;
    next.price = formatProductPrice(basePriceAmount);
  } else if (input.variants.length > 0) {
    throw new Error("Um produto sem detalhes de formação não pode ter variantes.");
  }

  return next;
}

export function formatProductPrice(amount: number) {
  return `${new Intl.NumberFormat("pt-PT", {
    maximumFractionDigits: 0,
  }).format(amount)} Kz`;
}
