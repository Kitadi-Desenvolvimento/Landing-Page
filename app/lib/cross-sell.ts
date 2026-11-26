import { offersPublicCheckout } from "../course-data";
import type { ProductCrossSell, ProductData } from "../product-types";

export type CartVariant = {
  id: string;
  label: string;
  amountKz: number;
};

export type CartCatalogEntry = {
  slug: string;
  title: string;
  tagline: string;
  image: string;
  crossSell?: ProductCrossSell[];
  variants: CartVariant[];
};

export type CrossSellOffer = {
  slug: string;
  title: string;
  tagline: string;
  image: string;
  variantId: string;
  variantLabel: string;
  amountKz: number;
  reason: string;
};

export function toCartCatalog(product: ProductData): CartCatalogEntry | null {
  if (!offersPublicCheckout(product)) return null;
  if (product.course) {
    const variants = product.course.variants.filter(
      (variant) => Number.isSafeInteger(variant.priceAmount) && variant.priceAmount > 0,
    );
    if (variants.length === 0) return null;
    return {
      slug: product.slug,
      title: product.title,
      tagline: product.tagline,
      image: product.coverImage ?? product.image,
      crossSell: product.crossSell,
      variants: variants.map((variant) => ({
        id: variant.id,
        label: variant.label,
        amountKz: variant.priceAmount,
      })),
    };
  }
  if (!product.priceAmount || product.priceAmount <= 0) return null;
  return {
    slug: product.slug,
    title: product.title,
    tagline: product.tagline,
    image: product.coverImage ?? product.image,
    crossSell: product.crossSell,
    variants: [{ id: "default", label: "Compra", amountKz: product.priceAmount }],
  };
}

const pairedReasons: Record<string, string> = {
  "desafio-aprendiz>tea-and-money-talks":
    "Quinze dias põem a casa em ordem. No dia 28 de Novembro, em Morro Bento, o Tea & Money Talks senta-o à mesa para ver em que fase está: ganhar, proteger ou multiplicar, e sair com o plano de 2027. Leve os dois e o hábito vira uma decisão.",
  "tea-and-money-talks>desafio-aprendiz":
    "A mesa mostra a fase e o plano. O Desafio Aprendiz leva isso para a prática: 15 dias no WhatsApp, um exercício por dia, para o plano não ficar na conversa.",
};

function autoReason(sourceTitle: string, suggestion: { title: string; tagline: string }) {
  const about = suggestion.tagline.replace(/\.+$/, "").trim();
  if (about) {
    return `${about}. Entra no mesmo pagamento de ${sourceTitle}.`;
  }
  return `${suggestion.title} entra no mesmo pagamento.`;
}

function offerReason(
  source: { slug: string; title: string },
  suggestion: { slug: string; title: string; tagline: string },
  written: string,
) {
  if (written) return written;
  return pairedReasons[`${source.slug}>${suggestion.slug}`] ?? autoReason(source.title, suggestion);
}

export function resolveCrossSell(
  source: { slug: string; title: string; crossSell?: ProductCrossSell[] },
  catalog: CartCatalogEntry[],
): CrossSellOffer[] {
  const pool = catalog.filter((item) => item.slug !== source.slug && item.variants[0]);
  const chosen: CrossSellOffer[] = [];

  for (const slot of (source.crossSell ?? []).slice(0, 2)) {
    const match = pool.find(
      (item) => item.slug === slot.slug && !chosen.some((picked) => picked.slug === item.slug),
    );
    const variant = match?.variants[0];
    if (!match || !variant) continue;
    chosen.push({
      slug: match.slug,
      title: match.title,
      tagline: match.tagline,
      image: match.image,
      variantId: variant.id,
      variantLabel: variant.label,
      amountKz: variant.amountKz,
      reason: offerReason(source, match, slot.reason.trim()),
    });
  }

  for (const slug of Object.keys(pairedReasons)
    .filter((key) => key.startsWith(`${source.slug}>`))
    .map((key) => key.slice(source.slug.length + 1))) {
    if (chosen.length >= 2) break;
    const match = pool.find(
      (item) => item.slug === slug && !chosen.some((picked) => picked.slug === item.slug),
    );
    const variant = match?.variants[0];
    if (!match || !variant) continue;
    chosen.push({
      slug: match.slug,
      title: match.title,
      tagline: match.tagline,
      image: match.image,
      variantId: variant.id,
      variantLabel: variant.label,
      amountKz: variant.amountKz,
      reason: offerReason(source, match, ""),
    });
  }

  for (const item of pool) {
    if (chosen.length >= 2) break;
    if (chosen.some((picked) => picked.slug === item.slug)) continue;
    const variant = item.variants[0];
    if (!variant) continue;
    chosen.push({
      slug: item.slug,
      title: item.title,
      tagline: item.tagline,
      image: item.image,
      variantId: variant.id,
      variantLabel: variant.label,
      amountKz: variant.amountKz,
      reason: offerReason(source, item, ""),
    });
  }

  return chosen;
}
