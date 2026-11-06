"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { courses } from "./course-data";
import SectionContainer from "./section-container";

export default function Formacoes() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);

  function scrollToPage(page: number) {
    const track = trackRef.current;
    if (!track) return;

    track.scrollTo({
      left: page * (track.clientWidth + 15),
      behavior: "smooth",
    });
    setCurrentPage(page);
  }

  function updateCurrentPage() {
    const track = trackRef.current;
    if (!track) return;

    setCurrentPage(
      Math.min(
        courses.length - 1,
        Math.round(track.scrollLeft / (track.clientWidth + 15)),
      ),
    );
  }

  return (
    <section
      aria-labelledby="courses-title"
      className="flex min-h-svh items-center bg-white px-6 py-16 text-[#211d1e] sm:py-20 lg:py-10"
      id="formacoes"
    >
      <SectionContainer>
        <p className="section-eyebrow text-[#ae7d32]">
          Formações
        </p>
        <h2
          className="section-heading mt-5 max-w-[640px]"
          id="courses-title"
        >
          Aprenda com ritmo e com preço acessível
        </h2>
        <p className="content-card-copy mt-3 max-w-[490px] text-[#716a69]">
          Escolha um curso, adira em poucos passos e comece a transformar a sua
          relação com o dinheiro.
        </p>

        <div
          aria-label="Formações em destaque"
          className="mt-12 flex snap-x snap-mandatory gap-[15px] overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-3 lg:overflow-visible"
          onScroll={updateCurrentPage}
          ref={trackRef}
          role="region"
        >
          {courses.map((course, index) => (
            <article
              aria-label={`${course.title}, ${course.price}`}
              className="content-card flex h-[350px] w-full flex-none snap-start flex-col overflow-hidden border border-[#eeeae8] bg-white lg:min-w-0"
              key={course.title}
            >
              <div className="relative h-[146px] flex-none overflow-hidden">
                <Image
                  alt={course.alt}
                  className="object-cover object-left"
                  fill
                  priority={index === 0}
                  sizes="(min-width: 1024px) 353px, 280px"
                  src={course.image}
                />
              </div>
              <div className="flex min-h-0 flex-1 flex-col px-5 pt-[20px] pb-[18px]">
                <h3 className="content-card-title">
                  {course.title}
                </h3>
                <p className="content-card-copy mt-[8px] text-[#716a69]">
                  {course.description}
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                  <p className="text-[15px] font-medium text-[#862f3b]">
                    {course.price}
                  </p>
                  <a
                    className="inline-flex h-[35px] min-w-[72px] items-center justify-center rounded-full bg-[#cda45c] px-4 text-[11px] font-medium text-[#2b160f] transition-colors hover:bg-[#dab76e]"
                    href={`/formacoes/${course.slug}/inscricao`}
                  >
                    Aderir
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>

        <nav
          aria-label="Páginas das formações"
          className="mt-[15px] flex gap-[7px] lg:hidden"
        >
          {courses.map((course, index) => (
            <button
              aria-current={currentPage === index ? "page" : undefined}
              aria-label={`Mostrar formação ${index + 1}: ${course.title}`}
              className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border text-[9px] transition-colors ${
                currentPage === index
                  ? "border-[#76202e] bg-[#76202e] text-white"
                  : "border-[#eeeae8] bg-white text-[#716a69] hover:border-[#cda45c]"
              }`}
              key={course.title}
              onClick={() => scrollToPage(index)}
              type="button"
            >
              {index + 1}
            </button>
          ))}
        </nav>

        <div className="mt-[56px] flex items-center justify-between pr-6 text-[13px] text-[#716a69]">
          <p>3 formações em destaque</p>
          <a className="text-[#2b2627] hover:text-[#862f3b]" href="/formacoes">
            Ver todos
          </a>
        </div>
      </SectionContainer>
    </section>
  );
}
