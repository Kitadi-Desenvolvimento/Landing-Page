"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Organization =
  | {
      name: string;
      logo: string;
      width: number;
      height: number;
    }
  | {
      name: string;
      logo?: never;
      width?: never;
      height?: never;
    };

const financialOrganizations: Organization[] = [
  { name: "Banco BAI", logo: "/logos/bai.svg", width: 131, height: 45 },
  { name: "Banco BCS", logo: "/logos/bcs.png", width: 524, height: 224 },
  { name: "BODIVA", logo: "/logos/bodiva.png", width: 477, height: 95 },
  {
    name: "Caixa Angola",
    logo: "/logos/caixa-angola.svg",
    width: 195,
    height: 34,
  },
  { name: "BFA", logo: "/logos/bfa.svg", width: 89, height: 34 },
  {
    name: "Comissão do Mercado de Capitais",
    logo: "/logos/cmc.png",
    width: 954,
    height: 466,
  },
  {
    name: "Standard Bank",
    logo: "/logos/standard-bank.svg",
    width: 208,
    height: 53,
  },
  { name: "ENSA", logo: "/logos/ensa.png", width: 97, height: 52 },
  { name: "Sanlam", logo: "/logos/sanlam.png", width: 126, height: 28 },
  { name: "Allianz", logo: "/logos/allianz.svg", width: 300, height: 134 },
];

export const oilAndGasOrganizations: Organization[] = [
  { name: "ExxonMobil", logo: "/logos/exxonmobil.svg", width: 703, height: 129 },
  { name: "SONILS", logo: "/logos/sonils-official.png", width: 120, height: 56 },
  { name: "etu energias", logo: "/logos/etu-energias.png", width: 270, height: 145 },
  { name: "ANPG", logo: "/logos/anpg-white.svg", width: 467, height: 191 },
  { name: "Chevron", logo: "/logos/chevron.svg", width: 340, height: 380 },
];

export const publicSectorOrganizations: Organization[] = [
  {
    name: "Governo de Angola",
    logo: "/logos/angola-government.svg",
    width: 33282,
    height: 3776,
  },
  { name: "MINFIN", logo: "/logos/minfin.png", width: 388, height: 61 },
  { name: "PDAC", logo: "/logos/pdac.png", width: 1024, height: 306 },
  { name: "ANGOTIC", logo: "/logos/angotic.png", width: 1959, height: 871 },
  { name: "IGAPE", logo: "/logos/igape.png", width: 180, height: 54 },
];

export const otherSectorOrganizations: Organization[] = [
  { name: "DStv", logo: "/logos/dstv.svg", width: 204, height: 126 },
  {
    name: "Global Money Week",
    logo: "/logos/global-money-week.png",
    width: 598,
    height: 369,
  },
  { name: "DP World", logo: "/logos/dp-world.svg", width: 182, height: 42 },
  { name: "JTI", logo: "/logos/jti.svg", width: 957, height: 731 },
  { name: "NIVEA", logo: "/logos/nivea.svg", width: 500, height: 500 },
  { name: "NORS", logo: "/logos/nors.svg", width: 160, height: 34 },
  { name: "REDTAG" },
  { name: "REFRIANGO", logo: "/logos/refriango.png", width: 1706, height: 472 },
  { name: "UCALL" },
  { name: "UNITEL", logo: "/logos/unitel.png", width: 5334, height: 1551 },
  {
    name: "Universidade Óscar Ribas",
    logo: "/logos/universidade-oscar-ribas.png",
    width: 276,
    height: 101,
  },
  { name: "Ascending", logo: "/logos/ascending.svg", width: 213, height: 58 },
  { name: "Casais", logo: "/logos/casais.svg", width: 764, height: 104 },
];

const referenceSectors = [
  {
    title: "Finanças & Seguros",
    organizations: financialOrganizations,
  },
  { title: "Oil & Gas", organizations: oilAndGasOrganizations },
  { title: "Sector Público", organizations: publicSectorOrganizations },
  { title: "Outros sectores", organizations: otherSectorOrganizations },
];

const allOrganizations = referenceSectors.flatMap((sector) =>
  sector.organizations.map((organization) => ({
    ...organization,
    sector: sector.title,
  })),
);

const sectorFilters = [
  "Todos",
  ...referenceSectors.map((sector) => sector.title),
] as const;
type SectorFilter = (typeof sectorFilters)[number];

const darkLogoCardNames = new Set(["BODIVA", "ANPG", "DP World", "NORS", "Ascending"]);

export default function ReferencesCarousel() {
  const [activeSector, setActiveSector] = useState<SectorFilter>("Todos");
  const carouselRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const organizations =
    activeSector === "Todos"
      ? allOrganizations
      : allOrganizations.filter(
          (organization) => organization.sector === activeSector,
        );
  const pages = Array.from(
    { length: Math.ceil(organizations.length / 10) },
    (_, pageIndex) => organizations.slice(pageIndex * 10, pageIndex * 10 + 10),
  );

  useEffect(() => {
    trackRef.current?.scrollTo({ left: 0 });
  }, [activeSector]);

  useEffect(() => {
    const carousel = carouselRef.current;
    const track = trackRef.current;
    if (
      !carousel ||
      !track ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let isVisible = false;
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(carousel);

    const intervalId = window.setInterval(() => {
      if (
        !isVisible ||
        document.hidden ||
        carousel.matches(":hover") ||
        carousel.contains(document.activeElement)
      ) {
        return;
      }

      const gap = Number.parseFloat(window.getComputedStyle(track).columnGap);
      const step = track.clientWidth + (Number.isNaN(gap) ? 0 : gap);
      const isAtEnd =
        track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;

      track.scrollTo({
        left: isAtEnd ? 0 : track.scrollLeft + step,
        behavior: "smooth",
      });
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
      observer.disconnect();
    };
  }, []);

  function scroll(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;

    track.scrollBy({
      left: direction * track.clientWidth,
      behavior: "smooth",
    });
  }

  return (
    <article
      className="min-h-0 min-w-0 rounded-[28px] bg-[#faf9f8] p-6 sm:p-[38px]"
      ref={carouselRef}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[22px] font-semibold leading-[1.35] tracking-[-0.3px] sm:text-[27px]">
          Organizações
        </h3>
        <div className="flex shrink-0 gap-2">
          <button
            aria-label="Ver organizações anteriores"
            className="flex size-9 items-center justify-center rounded-full border border-[#e7e1df] bg-white text-[#625c5c] transition-colors hover:border-[#ae7d32] hover:text-[#ae7d32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ae7d32]"
            onClick={() => scroll(-1)}
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
            aria-label="Ver mais organizações"
            className="flex size-9 items-center justify-center rounded-full border border-[#e7e1df] bg-white text-[#625c5c] transition-colors hover:border-[#ae7d32] hover:text-[#ae7d32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ae7d32]"
            onClick={() => scroll(1)}
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

      <div
        aria-label="Filtrar organizações por sector"
        className="mt-5 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
      >
        {sectorFilters.map((sector) => (
          <button
            aria-pressed={activeSector === sector}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ae7d32] ${
              activeSector === sector
                ? "border-[#76202e] bg-[#76202e] text-white"
                : "border-[#e7e1df] bg-white text-[#625c5c] hover:border-[#ae7d32]"
            }`}
            key={sector}
            onClick={() => setActiveSector(sector)}
            type="button"
          >
            {sector}
          </button>
        ))}
      </div>

      <div
        aria-label={`Organizações: ${activeSector}`}
        className="references-carousel-track mt-4 flex snap-x snap-mandatory gap-[14px] overflow-x-auto scroll-smooth sm:mt-5"
        role="region"
        ref={trackRef}
        tabIndex={0}
      >
        {pages.map((page, pageIndex) => (
          <ul
            aria-label={`Página ${pageIndex + 1} de ${pages.length}`}
            className="grid w-full shrink-0 snap-start grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
            key={pageIndex}
          >
            {page.map((organization) => (
              <li
                className={`flex h-[82px] items-center justify-center rounded-[12px] border px-3 ${
                  organization.name === "BODIVA"
                    ? "border-[#004969] bg-[#004969]"
                    : darkLogoCardNames.has(organization.name)
                      ? "border-[#123d63] bg-[#123d63]"
                      : "border-[#e7e1df] bg-white"
                }`}
                key={`${organization.sector}-${organization.name}`}
              >
                {organization.logo ? (
                  <Image
                    alt={organization.name}
                    className="h-auto max-h-[42px] w-auto max-w-[140px] object-contain"
                    height={organization.height}
                    src={organization.logo}
                    width={organization.width}
                  />
                ) : (
                  <span className="text-center text-xs font-semibold tracking-[0.06em] text-[#625c5c]">
                    {organization.name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </article>
  );
}
