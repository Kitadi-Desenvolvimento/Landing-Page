"use client";

import { useEffect, useRef, useState } from "react";
import { productListings } from "./course-data";
import ProductCoverCard from "./product-cover-card";
import SectionContainer from "./section-container";

const AUTO_PLAY_MS = 5 * 1000;

export default function Produtos() {
  const trackRef = useRef<HTMLUListElement>(null);
  const [paused, setPaused] = useState(false);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const update = () => {
      setCanScroll(track.scrollWidth - track.clientWidth > 8);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const intervalId = window.setInterval(() => {
      if (paused || document.hidden) return;
      advance(track, 1);
    }, AUTO_PLAY_MS);

    return () => window.clearInterval(intervalId);
  }, [paused]);

  function move(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    advance(track, direction);
  }

  return (
    <section
      aria-labelledby="products-title"
      aria-roledescription="carrossel"
      className="scroll-mt-24 px-6 py-16 text-white sm:py-20 lg:py-16"
      id="produtos"
      onBlurCapture={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
          setPaused(false);
        }
      }}
      onFocusCapture={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        background:
          "linear-gradient(110deg, #510f1d 0%, #3b0a15 47%, #28070d 100%)",
      }}
    >
      <SectionContainer>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-eyebrow text-[#cda45c]">Os nossos produtos</p>
            <h2
              className="section-heading mt-5 max-w-[720px]"
              id="products-title"
            >
              Programas para transformar a sua relação com o dinheiro
            </h2>
          </div>
          <a
            className="inline-flex min-h-[52px] shrink-0 items-center justify-center rounded-full bg-[#cda45c] px-7 text-[15px] font-medium !text-[#2b160f] shadow-[0_8px_20px_rgba(0,0,0,0.22)] transition-colors hover:bg-[#dab76e]"
            href="/produtos"
          >
            Ver todos os produtos
          </a>
        </div>

        <ul
          className="product-carousel-track mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth"
          ref={trackRef}
        >
          {productListings.map((course, index) => (
            <li
              className="w-[86%] shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]"
              key={course.slug}
            >
              <ProductCoverCard course={course} priority={index < 3} />
            </li>
          ))}
        </ul>

        {canScroll ? (
          <div className="mt-6 flex justify-end gap-3">
            <button
              aria-label="Produtos anteriores"
              className="flex size-12 items-center justify-center rounded-full bg-[#cda45c] text-[#2b160f] shadow-[0_8px_20px_rgba(0,0,0,0.22)] transition-colors hover:bg-[#dab76e]"
              onClick={() => move(-1)}
              type="button"
            >
              <Chevron direction="left" />
            </button>
            <button
              aria-label="Produtos seguintes"
              className="flex size-12 items-center justify-center rounded-full bg-[#cda45c] text-[#2b160f] shadow-[0_8px_20px_rgba(0,0,0,0.22)] transition-colors hover:bg-[#dab76e]"
              onClick={() => move(1)}
              type="button"
            >
              <Chevron direction="right" />
            </button>
          </div>
        ) : null}
      </SectionContainer>
    </section>
  );
}

function advance(track: HTMLElement, direction: 1 | -1) {
  const max = track.scrollWidth - track.clientWidth;
  if (max <= 8) return;

  const step = cardStep(track);
  if (step <= 0) return;

  if (direction > 0 && track.scrollLeft >= max - 8) {
    track.scrollTo({ left: 0, behavior: "smooth" });
    return;
  }

  if (direction < 0 && track.scrollLeft <= 8) {
    track.scrollTo({ left: max, behavior: "smooth" });
    return;
  }

  track.scrollBy({ left: direction * step, behavior: "smooth" });
}

function cardStep(track: HTMLElement) {
  const cards = track.querySelectorAll("li");
  if (cards.length >= 2) {
    return (
      cards[1].getBoundingClientRect().left -
      cards[0].getBoundingClientRect().left
    );
  }

  const card = cards[0];
  return card ? card.getBoundingClientRect().width + 16 : 0;
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22">
      <path
        d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
