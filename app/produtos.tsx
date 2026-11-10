"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { courses, getProductPath } from "./course-data";
import SectionContainer from "./section-container";

const AUTO_PLAY_MS = 5000;

function CheckBadge() {
  return (
    <span className="mt-0.5 flex size-6 flex-none items-center justify-center rounded-full bg-[#cda45c] text-[#2b160f]">
      <svg
        aria-hidden="true"
        fill="none"
        height="13"
        viewBox="0 0 16 16"
        width="13"
      >
        <path
          d="m3.2 8.1 3.1 3.1 6.5-6.6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function Produtos() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const carouselRef = useRef<HTMLElement>(null);
  const headingId = useId();
  const product = courses[currentIndex];

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    let isVisible = false;
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(carousel);

    if (
      paused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return () => observer.disconnect();
    }

    if (courses.length < 2) {
      return () => observer.disconnect();
    }

    const intervalId = window.setInterval(() => {
      if (!isVisible || document.hidden) return;

      setCurrentIndex((index) => (index + 1) % courses.length);
    }, AUTO_PLAY_MS);

    return () => {
      window.clearInterval(intervalId);
      observer.disconnect();
    };
  }, [paused, currentIndex]);

  function goTo(index: number) {
    setCurrentIndex((index + courses.length) % courses.length);
  }

  const [programLead, programAccent] = splitProgramTitle(product.programTitle);

  return (
    <section
      aria-labelledby="products-title"
      className="flex min-h-svh scroll-mt-24 items-center px-6 py-16 text-white sm:py-20 lg:py-10"
      id="produtos"
      style={{
        background:
          "linear-gradient(110deg, #510f1d 0%, #3b0a15 47%, #28070d 100%)",
      }}
    >
      <SectionContainer>
        <p className="section-eyebrow text-[#cda45c]">Os nossos produtos</p>
        <h2
          className="section-heading mt-5 max-w-[720px]"
          id="products-title"
        >
          Programas para transformar a sua relação com o dinheiro
        </h2>

        <article
          aria-labelledby={headingId}
          aria-roledescription="carrossel"
          className="product-showcase mt-12 overflow-hidden rounded-[24px] border border-white/10 lg:mt-14"
          onBlurCapture={(event) => {
            const next = event.relatedTarget;
            if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
              setPaused(false);
            }
          }}
          onFocusCapture={() => setPaused(true)}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          ref={carouselRef}
        >
          <div className="grid min-h-[560px] lg:grid-cols-[minmax(280px,0.68fr)_minmax(0,1.32fr)]">
            <div className="relative isolate aspect-[3/4] overflow-hidden bg-[#140308] sm:aspect-[4/5] lg:aspect-auto lg:min-h-[560px]">
              <Image
                alt={
                  product.imageMode === "object"
                    ? product.alt
                    : "Neuza Pinto, educadora financeira da Kitadi"
                }
                className={
                  product.imageMode === "object"
                    ? "object-cover object-center"
                    : "object-cover object-[center_30%] grayscale contrast-[1.45] brightness-[1.08]"
                }
                fill
                key={product.slug}
                priority={product.imageMode === "object"}
                sizes="(min-width: 1024px) 380px, 100vw"
                src={
                  product.imageMode === "object"
                    ? product.image
                    : "/neuza-pinto.jpg"
                }
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(20,3,8,0.9)_0%,rgba(20,3,8,0.35)_18%,rgba(20,3,8,0.08)_36%,transparent_52%)]"
              />
              <div className="product-slide" key={`${product.slug}-cover`}>
                <p
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-[8%] text-center text-[clamp(5.5rem,16vw,8rem)] font-bold leading-none tracking-[-0.08em] text-white/22"
                >
                  {product.shortName}
                </p>
                <p className="product-ribbon">{product.statusLabel}</p>
                <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-5 sm:px-8 sm:pb-8">
                  <p className="text-[clamp(1.85rem,4vw,2.75rem)] font-bold leading-[0.95] tracking-[0.06em] text-white">
                    {product.shortName}
                  </p>
                  <p className="mt-1 max-w-[240px] text-[12px] font-semibold uppercase leading-[1.25] tracking-[0.12em] text-white sm:text-[13px]">
                    {product.title}
                  </p>
                  <p className="mt-2 hidden max-w-[280px] text-[12px] italic leading-[1.5] text-white/80 sm:block">
                    {product.tagline}
                  </p>
                  <div className="relative mt-4 h-7 w-[92px]">
                    <Image
                      alt="Kitadi"
                      className="object-contain object-left"
                      fill
                      sizes="92px"
                      src="/kitadi-logo.png"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="product-showcase-copy flex min-w-0 flex-col justify-center px-6 py-10 sm:px-10 lg:px-12 lg:py-12">
              <div className="product-slide" key={`${product.slug}-copy`}>
                <p className="section-eyebrow text-[#cda45c]">
                  {product.category}
                </p>
                <h3
                  className="mt-4 text-[clamp(1.85rem,3vw,2.7rem)] font-bold leading-[1.15] tracking-[0.06em] text-white"
                  id={headingId}
                >
                  {programLead}{" "}
                  <span className="mt-1 block text-[#cda45c]">{programAccent}</span>
                </h3>
                <p className="mt-5 max-w-[520px] text-[16px] italic leading-[1.7] text-white/80">
                  {product.longDescription}
                </p>
                <p className="mt-6 max-w-[520px] text-[15px] italic leading-[1.6]">
                  <span className="font-semibold not-italic uppercase tracking-[0.04em] text-[#cda45c]">
                    Para quem é:{" "}
                  </span>
                  <span className="text-white">{product.audience}</span>
                </p>

                <div className="mt-7 flex max-w-[520px] gap-3 rounded-[14px] border border-white/18 px-4 py-4 sm:px-5">
                  <CheckBadge />
                  <p className="text-[13px] font-semibold uppercase leading-[1.5] tracking-[0.04em] text-white">
                    {product.highlight}
                  </p>
                </div>

                <div className="mt-8">
                  <a
                    className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#cda45c] px-8 text-[14px] font-medium text-[#2b160f] transition-colors hover:bg-[#dab76e]"
                    href={getProductPath(product)}
                  >
                    Aderir agora
                    <ArrowIcon />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </article>

        {courses.length > 1 ? (
        <div className="mt-6 flex items-center justify-between gap-4">
          <nav aria-label="Produtos em destaque" className="flex items-center gap-2">
            {courses.map((course, index) => (
              <button
                aria-current={currentIndex === index ? "true" : undefined}
                aria-label={`Mostrar ${course.title}`}
                className="group relative flex h-8 items-center"
                key={course.slug}
                onClick={() => goTo(index)}
                type="button"
              >
                <span
                  className={`block h-[6px] overflow-hidden rounded-full transition-[width,background-color] ${
                    currentIndex === index
                      ? "w-11 bg-white/20"
                      : "w-2.5 bg-white/30 hover:bg-[#cda45c]"
                  }`}
                >
                  {currentIndex === index ? (
                    <span
                      className={`product-progress-fill block h-full origin-left bg-[#cda45c] ${
                        paused ? "is-paused" : ""
                      }`}
                      key={`${course.slug}-${currentIndex}`}
                    />
                  ) : null}
                </span>
              </button>
            ))}
          </nav>

          <div className="flex shrink-0 gap-2">
            <button
              aria-label="Produto anterior"
              className="flex size-9 items-center justify-center rounded-full border border-white/25 text-white/80 transition-colors hover:border-[#cda45c] hover:text-[#cda45c]"
              onClick={() => goTo(currentIndex - 1)}
              type="button"
            >
              <svg
                aria-hidden="true"
                fill="none"
                height="18"
                viewBox="0 0 24 24"
                width="18"
              >
                <path
                  d="m15 18-6-6 6-6"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
            <button
              aria-label="Produto seguinte"
              className="flex size-9 items-center justify-center rounded-full border border-white/25 text-white/80 transition-colors hover:border-[#cda45c] hover:text-[#cda45c]"
              onClick={() => goTo(currentIndex + 1)}
              type="button"
            >
              <svg
                aria-hidden="true"
                fill="none"
                height="18"
                viewBox="0 0 24 24"
                width="18"
              >
                <path
                  d="m9 18 6-6-6-6"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
          </div>
        </div>
        ) : null}
      </SectionContainer>
    </section>
  );
}

function splitProgramTitle(title: string) {
  const parts = title.trim().split(" ");
  const accent = parts.pop() ?? "";
  return [parts.join(" "), accent] as const;
}
