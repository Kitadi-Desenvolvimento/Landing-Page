import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedProducts } from "../lib/products";
import SectionContainer from "../section-container";
import SiteHeader from "../site-header";
import ProductCatalog from "./catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Produtos | Kitadi",
  description:
    "Veja todos os produtos da Kitadi e filtre por categoria e modalidade.",
};

export default async function ProductsPage() {
  const products = await getPublishedProducts();

  return (
    <main className="min-h-svh text-[#211d1e]">
      <section
        aria-labelledby="all-products-title"
        className="pb-12 text-white sm:pb-16"
        style={{
          background:
            "linear-gradient(110deg, #510f1d 0%, #3b0a15 47%, #28070d 100%)",
        }}
      >
        <SiteHeader />
        <SectionContainer className="px-6 pb-4 pt-28 sm:pt-32">
          <nav aria-label="Navegação estrutural" className="text-sm text-white/70">
            <Link className="transition-colors hover:text-white" href="/#inicio">
              Início
            </Link>
            <span aria-hidden="true" className="mx-3 text-[#cda45c]">
              ›
            </span>
            <span aria-current="page" className="text-white">
              Produtos
            </span>
          </nav>

          <p className="section-eyebrow mt-7 text-[#cda45c]">Catálogo</p>
          <h1
            className="section-heading mt-4 max-w-[800px]"
            id="all-products-title"
          >
            Todos os produtos
          </h1>
          <p className="content-card-copy mt-4 max-w-[620px] text-white/75">
            Escolha um produto para ver o detalhe. A adesão combina-se connosco
            no WhatsApp.
          </p>
        </SectionContainer>
      </section>

      <section
        aria-label="Filtros e lista de produtos"
        className="bg-[#f5f2f1] px-6 py-16 sm:py-20"
      >
        <SectionContainer>
          <ProductCatalog courses={products.map((product) => product.data)} />
        </SectionContainer>
      </section>
    </main>
  );
}
