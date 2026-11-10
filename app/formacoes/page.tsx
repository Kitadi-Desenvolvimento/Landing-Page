import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { courses, getProductPath } from "../course-data";
import SectionContainer from "../section-container";
import SiteHeader from "../site-header";

export const metadata: Metadata = {
  title: "Produtos | Kitadi",
  description:
    "Conheça a Bússola do Kitadi e dê o próximo passo para uma vida financeira com propósito.",
};

export default function FormacoesPage() {
  return (
    <main className="min-h-svh text-[#211d1e]">
      <section
        aria-labelledby="courses-title"
        className="pb-12 text-white sm:pb-16"
        style={{
          background:
            "linear-gradient(110deg, #510f1d 0%, #3b0a15 47%, #28070d 100%)",
        }}
      >
        <SiteHeader />
        <SectionContainer className="px-6 pt-10 sm:pt-14">
          <nav
            aria-label="Navegação estrutural"
            className="text-sm text-white/70"
          >
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

          <p className="section-eyebrow mt-7 text-[#cda45c]">
            Consultoria estratégica
          </p>
          <h1
            className="section-heading mt-4 max-w-[800px]"
            id="courses-title"
          >
            Os nossos produtos
          </h1>
          <p className="content-card-copy mt-4 max-w-[620px] text-white/75">
            O próximo passo para uma vida financeira com propósito começa aqui.
            Conheça a consultoria e adira quando estiver pronto.
          </p>
        </SectionContainer>
      </section>

      <section
        aria-label="Catálogo de formações"
        className="bg-[#f5f2f1] px-6 py-16 sm:py-20 lg:py-16"
      >
        <SectionContainer>
          <div className="mb-7 flex flex-col gap-2 text-[14px] text-[#716a69] sm:flex-row sm:items-center sm:justify-between">
            <p>
              {courses.length}{" "}
              {courses.length === 1 ? "produto disponível" : "produtos disponíveis"}
            </p>
            <p>Consultoria privada · Presencial ou online</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {courses.map((course) => (
              <article
                aria-label={course.title}
                className="content-card flex flex-col overflow-hidden border border-[#ece8e6] bg-white"
                key={course.title}
              >
                <div className="relative h-[180px] flex-none overflow-hidden bg-[#3b0a15] sm:h-[165px]">
                  <Image
                    alt={course.alt}
                    className="object-cover object-left"
                    fill
                    sizes="(min-width: 1024px) 336px, (min-width: 640px) 50vw, 100vw"
                    src={course.image}
                  />
                </div>
                <div className="flex flex-1 flex-col px-6 pb-6 pt-5">
                  <p className="section-eyebrow text-[11px] text-[#ae7d32]">
                    {course.category}
                  </p>
                  <h2 className="content-card-title mt-3">{course.title}</h2>
                  <p className="content-card-copy mt-2 text-[#716a69]">
                    {course.description}
                  </p>
                  <div className="mt-auto flex items-center justify-end gap-3 pt-6">
                    <a
                      className="inline-flex h-[42px] min-w-[92px] items-center justify-center rounded-full bg-[#cda45c] px-5 text-[14px] font-medium text-[#2b160f] transition-colors hover:bg-[#dab76e]"
                      href={getProductPath(course)}
                    >
                      Aderir
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <aside className="mt-6 flex flex-col gap-4 rounded-[28px] border border-[#e7e1df] bg-white px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="flex items-center gap-4">
              <svg
                aria-hidden="true"
                className="h-6 w-6 flex-none text-[#862f3b]"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 3 4.5 6v5.5c0 4.7 3.2 8.1 7.5 9.5 4.3-1.4 7.5-4.8 7.5-9.5V6L12 3Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.2"
                />
                <path
                  d="m9.5 12 1.7 1.7 3.5-3.8"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.2"
                />
              </svg>
              <div>
                <p className="font-medium">
                  Escolha e fale connosco no WhatsApp.
                </p>
                <p className="content-card-copy mt-1 text-[14px] text-[#716a69]">
                  A adesão é combinada directamente connosco, no +244 936 250 151.
                </p>
              </div>
            </div>
            <Link
              className="shrink-0 font-medium text-[#862f3b] transition-colors hover:text-[#5c1f29]"
              href="/#contactos"
            >
              Falar connosco <span aria-hidden="true">→</span>
            </Link>
          </aside>
        </SectionContainer>
      </section>
    </main>
  );
}
