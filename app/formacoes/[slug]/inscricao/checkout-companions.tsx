"use client";

import Image from "next/image";
import type { CrossSellOffer } from "../../../lib/cross-sell";

export default function CheckoutCompanions({
  suggestions,
  selectedSlugs,
  onToggle,
  amountLabel,
  className = "",
}: {
  suggestions: CrossSellOffer[];
  selectedSlugs: string[];
  onToggle: (offer: CrossSellOffer) => void;
  amountLabel: (amountKz: number) => string;
  className?: string;
}) {
  const [lead, ...rest] = suggestions;
  if (!lead) return null;

  const leadSelected = selectedSlugs.includes(lead.slug);

  return (
    <div className={className}>
      <article className="rounded-[20px] border border-[#e7d3a8] bg-[#fbf6ec] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Image
            alt=""
            className="h-16 w-16 flex-none rounded-xl bg-[#f5f0ed] object-cover"
            height={64}
            src={lead.image}
            width={64}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#ae7d32]">
              Leve também neste pagamento
            </p>
            <h2 className="mt-1 text-base font-bold">
              {lead.title}
              <span className="ml-2 text-[#510f1d]">{amountLabel(lead.amountKz)}</span>
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#3d3536]">{lead.reason}</p>
          </div>
          <button
            aria-pressed={leadSelected}
            className={
              leadSelected
                ? "min-h-12 shrink-0 rounded-full border border-[#510f1d] bg-white px-5 text-sm font-semibold text-[#510f1d] sm:max-w-[220px]"
                : "min-h-12 shrink-0 rounded-full bg-[#510f1d] px-5 text-sm font-semibold text-white sm:max-w-[220px]"
            }
            onClick={() => onToggle(lead)}
            type="button"
          >
            {leadSelected ? "Incluído · retirar" : "Levar também"}
          </button>
        </div>
      </article>
      {rest.map((offer) => {
        const selected = selectedSlugs.includes(offer.slug);
        return (
          <article
            className="mt-3 flex flex-col gap-3 rounded-2xl border border-[#eee8e5] bg-white px-4 py-3 sm:flex-row sm:items-center"
            key={offer.slug}
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#ae7d32]">
                Também combina
              </p>
              <p className="mt-1 text-sm font-bold">
                {offer.title}
                <span className="ml-2 font-semibold text-[#510f1d]">{amountLabel(offer.amountKz)}</span>
              </p>
              <p className="mt-1 text-sm leading-5 text-[#716a69]">{offer.reason}</p>
            </div>
            <button
              aria-pressed={selected}
              className={
                selected
                  ? "min-h-11 shrink-0 rounded-full border border-[#510f1d] px-4 text-sm font-semibold text-[#510f1d]"
                  : "min-h-11 shrink-0 rounded-full bg-[#510f1d] px-4 text-sm font-semibold text-white"
              }
              onClick={() => onToggle(offer)}
              type="button"
            >
              {selected ? "Incluído · retirar" : "Levar também"}
            </button>
          </article>
        );
      })}
    </div>
  );
}
