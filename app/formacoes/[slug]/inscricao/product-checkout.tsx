"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { getProductPath } from "../../../course-data";
import type { ProductData } from "../../../product-types";
import type { CrossSellOffer } from "../../../lib/cross-sell";
import CheckoutCompanions from "./checkout-companions";
import { getSiteAnalyticsSessionId } from "../../../lib/site-analytics-client";
import SectionContainer from "../../../section-container";
import SiteHeader from "../../../site-header";
import { formatStudentPrice, studentDiscountedAmount, studentDiscountPercent } from "../../../lib/student-discount";
import StudentVerification, { type VerifiedStudent } from "./student-verification";

type ChargeDetails = {
  checkoutUrl: string;
  amount: number;
};

type PurchaseDetails = {
  name: string;
  email: string;
  phone: string;
  companyName: string;
};

function isChargeDetails(value: unknown): value is ChargeDetails {
  if (typeof value !== "object" || value === null) return false;
  const charge = value as Record<string, unknown>;
  if (typeof charge.checkoutUrl !== "string" || typeof charge.amount !== "number") {
    return false;
  }

  try {
    const url = new URL(charge.checkoutUrl);
    return (
      url.protocol === "https:" &&
      (url.hostname === "hosted.wipay.ao" || url.hostname === "pay.wiza.ao")
    );
  } catch {
    return false;
  }
}

export default function ProductCheckout({
  product,
  studentEnabled,
  suggestions,
}: {
  product: ProductData;
  studentEnabled: boolean;
  suggestions: CrossSellOffer[];
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [reviewingDetails, setReviewingDetails] = useState(false);
  const [verifiedStudent, setVerifiedStudent] = useState<VerifiedStudent | null>(null);
  const [details, setDetails] = useState<PurchaseDetails>({
    name: "",
    email: "",
    phone: "",
    companyName: "",
  });
  const [extraSlugs, setExtraSlugs] = useState<string[]>([]);
  const extras = suggestions.filter((item) => extraSlugs.includes(item.slug));
  const priceOf = (amountKz: number) =>
    verifiedStudent ? studentDiscountedAmount(amountKz) : amountKz;
  const total = product.priceAmount === undefined
    ? undefined
    : priceOf(product.priceAmount) + extras.reduce((sum, item) => sum + priceOf(item.amountKz), 0);

  function toggleExtra(offer: CrossSellOffer) {
    setExtraSlugs((current) =>
      current.includes(offer.slug)
        ? current.filter((slug) => slug !== offer.slug)
        : [...current, offer.slug],
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setDetails({
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      companyName: String(form.get("companyName") ?? "").trim(),
    });
    setError("");
    setReviewingDetails(true);
  }

  async function confirmPayment() {
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/payments/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(extras.length > 0
            ? {
                items: [
                  { courseSlug: product.slug, variantId: "default" },
                  ...extras.map((item) => ({
                    courseSlug: item.slug,
                    variantId: item.variantId,
                  })),
                ],
              }
            : { courseSlug: product.slug }),
          name: details.name,
          email: details.email,
          phone: details.phone,
          companyName: details.companyName,
          analyticsSessionId: getSiteAnalyticsSessionId(),
          ...(verifiedStudent ? { studentToken: verifiedStudent.token } : {}),
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Não foi possível criar a cobrança. Tente novamente.";
        throw new Error(message);
      }
      if (!isChargeDetails(result) || result.amount !== total) {
        throw new Error("O serviço de pagamentos devolveu dados inválidos.");
      }
      window.location.assign(result.checkoutUrl);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível criar a cobrança. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-svh bg-[#f5f2f1] text-[#211d1e]">
      <section
        className="pb-10 text-white sm:pb-12"
        style={{
          background:
            "linear-gradient(110deg, #510f1d 0%, #3b0a15 47%, #28070d 100%)",
        }}
      >
        <SiteHeader />
        <SectionContainer className="px-6 pt-28 sm:pt-32">
          <Link
            className="text-sm font-medium text-white/80 transition-colors hover:text-[#cda45c]"
            href={getProductPath(product)}
          >
            <span aria-hidden="true">←</span> Voltar ao produto
          </Link>
          <p className="section-eyebrow mt-7 text-[#cda45c]">Pagamento seguro</p>
          <h1 className="section-heading mt-3 max-w-[800px]">
            Finalizar compra
          </h1>
          <p className="content-card-copy mt-3 max-w-[620px] text-white/75">
            {reviewingDetails
              ? "Confira os seus dados e o resumo da compra antes de avançar."
              : "Preencha os seus dados para continuar para o checkout seguro da WiPay."}
          </p>
        </SectionContainer>
      </section>

      <section className="px-6 py-10 sm:py-14">
        <SectionContainer className="max-w-[920px]">
          <CheckoutCompanions
            className="mb-6"
            amountLabel={(amount) => formatStudentPrice(priceOf(amount))}
            selectedSlugs={extraSlugs}
            suggestions={suggestions}
            onToggle={toggleExtra}
          />
          <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.9fr)] lg:gap-7">
            {reviewingDetails ? (
              <section
                aria-labelledby="purchase-review-title"
                className="rounded-[28px] border border-[#e7e1df] bg-white p-6 sm:p-8"
              >
                <h2 className="text-[20px] font-bold" id="purchase-review-title">
                  Confirme os seus dados
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#716a69]">
                  Verifique os dados e o produto. A cobrança só será criada
                  depois de confirmar.
                </p>
                <dl className="mt-6 divide-y divide-[#eee8e5] rounded-2xl border border-[#eee8e5] px-4">
                  {[
                    ["Nome completo", details.name],
                    ["Email", details.email],
                    ["Telemóvel", details.phone],
                    ...(details.companyName ? [["Empresa", details.companyName]] : []),
                    ["Produto", product.title],
                    ...extras.map((item) => [item.title, formatStudentPrice(priceOf(item.amountKz))]),
                    ...(verifiedStudent && product.priceAmount !== undefined
                      ? [["Desconto de aluno", `${studentDiscountPercent(product.priceAmount)}%`]]
                      : []),
                    ["Total a pagar", total !== undefined ? formatStudentPrice(total) : ""],
                  ].map(([label, value]) => (
                    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between sm:gap-4" key={label}>
                      <dt className="text-sm text-[#716a69]">{label}</dt>
                      <dd className="break-all text-sm font-semibold text-[#211d1e] sm:text-right">{value}</dd>
                    </div>
                  ))}
                </dl>
                {error ? (
                  <p className="mt-5 rounded-xl bg-[#fff1f0] px-3 py-2 text-sm text-[#a43832]" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
                  <button
                    className="min-h-12 flex-1 rounded-full border border-[#e7e1df] px-5 text-sm font-medium text-[#51484a] hover:bg-[#faf9f8]"
                    disabled={isSubmitting}
                    onClick={() => setReviewingDetails(false)}
                    type="button"
                  >
                    Editar dados
                  </button>
                  <button
                    className="min-h-12 flex-1 rounded-full bg-[#510f1d] px-5 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={isSubmitting}
                    onClick={() => void confirmPayment()}
                    type="button"
                  >
                    {isSubmitting ? "A preparar pagamento…" : "Confirmar e pagar"}
                  </button>
                </div>
              </section>
            ) : (
            <form
              className="rounded-[28px] border border-[#e7e1df] bg-white p-6 sm:p-8"
              onSubmit={submit}
            >
              <h2 className="text-[20px] font-bold">Os seus dados</h2>
              <p className="mt-2 text-sm text-[#716a69]">
                Não precisa de criar conta.
              </p>
              {studentEnabled ? (
                <StudentVerification value={verifiedStudent} onChange={setVerifiedStudent} />
              ) : null}
              <div className="mt-6 grid gap-4">
                <label className="text-sm font-medium">
                  Nome completo
                  <input
                    autoComplete="name"
                    className="mt-1.5 min-h-12 w-full rounded-xl border border-[#e7e1df] px-4 text-sm outline-none focus:border-[#ae7d32]"
                    maxLength={120}
                    name="name"
                    required
                    value={details.name}
                    onChange={(event) => setDetails({ ...details, name: event.target.value })}
                  />
                </label>
                <label className="text-sm font-medium">
                  Email
                  <input
                    autoComplete="email"
                    className="mt-1.5 min-h-12 w-full rounded-xl border border-[#e7e1df] px-4 text-sm outline-none focus:border-[#ae7d32]"
                    maxLength={254}
                    name="email"
                    required
                    type="email"
                    value={details.email}
                    onChange={(event) => setDetails({ ...details, email: event.target.value })}
                  />
                </label>
                <label className="text-sm font-medium">
                  Telefone
                  <input
                    autoComplete="tel"
                    className="mt-1.5 min-h-12 w-full rounded-xl border border-[#e7e1df] px-4 text-sm outline-none focus:border-[#ae7d32]"
                    maxLength={24}
                    name="phone"
                    required
                    type="tel"
                    value={details.phone}
                    onChange={(event) => setDetails({ ...details, phone: event.target.value })}
                  />
                </label>
                <label className="text-sm font-medium">
                  Empresa (opcional)
                  <input
                    autoComplete="organization"
                    className="mt-1.5 min-h-12 w-full rounded-xl border border-[#e7e1df] px-4 text-sm outline-none focus:border-[#ae7d32]"
                    maxLength={160}
                    name="companyName"
                    value={details.companyName}
                    onChange={(event) => setDetails({ ...details, companyName: event.target.value })}
                  />
                </label>
              </div>
              {error ? (
                <p className="mt-5 rounded-xl bg-[#fff1f0] px-3 py-2 text-sm text-[#a43832]" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                className="mt-6 min-h-12 w-full rounded-full bg-[#510f1d] px-5 text-sm font-semibold text-white disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? "A preparar pagamento…"
                  : `Continuar para pagamento${total !== undefined ? ` · ${formatStudentPrice(total)}` : ""}`}
              </button>
              <p className="mt-4 text-xs leading-5 text-[#716a69]">
                A Kitadi nunca pede o seu PIN, códigos de acesso ou credenciais bancárias.
              </p>
            </form>
            )}

            <aside className="rounded-[28px] border border-[#e7e1df] bg-white p-6 sm:p-8 md:sticky md:top-6 md:self-start">
              <div className="flex gap-3">
                <Image
                  alt=""
                  className="h-16 w-16 flex-none rounded-xl bg-[#f5f0ed] object-cover"
                  height={64}
                  src={product.coverImage ?? product.image}
                  width={64}
                />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#ae7d32]">
                    Resumo da compra
                  </p>
                  <h2 className="mt-1 text-lg font-bold">{product.title}</h2>
                </div>
              </div>
              {extras.map((item) => (
                <p className="mt-3 text-sm text-[#716a69]" key={item.slug}>
                  + {item.title} · {formatStudentPrice(priceOf(item.amountKz))}
                </p>
              ))}
              <p className="mt-4 border-t border-[#eee8e5] pt-4 text-xl font-bold text-[#510f1d]">
                {total !== undefined ? formatStudentPrice(total) : product.price}
              </p>
              {verifiedStudent && product.priceAmount !== undefined ? (
                <p className="mt-2 text-sm text-[#716a69]">Desconto de aluno: {studentDiscountPercent(product.priceAmount)}% sobre {formatStudentPrice(product.priceAmount)}</p>
              ) : null}
            </aside>
          </div>
        </SectionContainer>
      </section>
    </main>
  );
}
