"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  addCartLine,
  CART_EVENT,
  clearCart,
  readCart,
  removeCartLine,
  type StoredCartLine,
} from "../cart-storage";
import { resolveCrossSell, type CartCatalogEntry, type CrossSellOffer } from "../lib/cross-sell";
import CheckoutCompanions from "../formacoes/[slug]/inscricao/checkout-companions";
import { getSiteAnalyticsSessionId } from "../lib/site-analytics-client";
import {
  formatStudentPrice,
  studentDiscountedAmount,
  studentDiscountPercent,
} from "../lib/student-discount";
import SectionContainer from "../section-container";
import SiteHeader from "../site-header";
import StudentVerification, {
  type VerifiedStudent,
} from "../formacoes/[slug]/inscricao/student-verification";

function subscribe(callback: () => void) {
  window.addEventListener(CART_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CART_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

const emptyCart: StoredCartLine[] = [];
let cartSnapshot: StoredCartLine[] = emptyCart;
let cartKey = "";

function currentCart() {
  const lines = readCart();
  const nextKey = JSON.stringify(lines);
  if (nextKey !== cartKey) {
    cartKey = nextKey;
    cartSnapshot = lines;
  }
  return cartSnapshot;
}

function isCheckoutUrl(value: unknown): value is { checkoutUrl: string; amount: number } {
  if (typeof value !== "object" || value === null) return false;
  const charge = value as Record<string, unknown>;
  if (typeof charge.checkoutUrl !== "string" || typeof charge.amount !== "number") return false;
  try {
    const url = new URL(charge.checkoutUrl);
    return url.protocol === "https:" && (url.hostname === "hosted.wipay.ao" || url.hostname === "pay.wiza.ao");
  } catch {
    return false;
  }
}

export default function CartView({
  catalog,
  studentEnabled,
}: {
  catalog: CartCatalogEntry[];
  studentEnabled: boolean;
}) {
  const stored = useSyncExternalStore(subscribe, currentCart, () => emptyCart);
  const [verifiedStudent, setVerifiedStudent] = useState<VerifiedStudent | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [details, setDetails] = useState({ name: "", email: "", phone: "", companyName: "" });

  useEffect(() => {
    if (verifiedStudent?.student.name && !details.name) {
      setDetails((current) => ({ ...current, name: verifiedStudent.student.name }));
    }
  }, [details.name, verifiedStudent]);

  const lines = useMemo(() => stored.map((line) => {
    const product = catalog.find((item) => item.slug === line.slug);
    const variant = product?.variants.find((item) => item.id === line.variantId) ?? product?.variants[0];
    if (!product || !variant) {
      return { ...line, available: false as const };
    }
    return {
      slug: product.slug,
      variantId: variant.id,
      title: product.title,
      variantLabel: variant.label,
      amountKz: variant.amountKz,
      image: product.image,
      available: true as const,
    };
  }), [catalog, stored]);

  const payable = lines.filter((line) => line.available);
  const total = payable.reduce(
    (sum, line) => sum + (verifiedStudent ? studentDiscountedAmount(line.amountKz) : line.amountKz),
    0,
  );
  const source = catalog.find((item) => item.slug === payable[0]?.slug);
  const suggestions = (source ? resolveCrossSell(source, catalog) : [])
    .filter((item) => item.slug !== payable[0]?.slug);
  const selectedSlugs = lines.map((line) => line.slug);

  function toggleSuggestion(offer: CrossSellOffer) {
    if (selectedSlugs.includes(offer.slug)) {
      removeCartLine(offer.slug);
      setOfferNote("");
      return;
    }
    const result = addCartLine({
      slug: offer.slug,
      variantId: offer.variantId,
      title: offer.title,
      variantLabel: offer.variantLabel,
      amountKz: offer.amountKz,
      image: offer.image,
    });
    setOfferNote(
      result === "full"
        ? "O carrinho já tem 6 produtos. Retire um para acrescentar outro."
        : "",
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
    setReviewing(true);
  }

  async function pay() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/payments/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: payable.map((line) => ({ courseSlug: line.slug, variantId: line.variantId })),
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
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error
          : "Não foi possível criar a cobrança. Tente novamente.";
        throw new Error(message);
      }
      if (!isCheckoutUrl(result) || result.amount !== total) {
        throw new Error("O serviço de pagamentos devolveu dados inválidos.");
      }
      clearCart();
      window.location.assign(result.checkoutUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível criar a cobrança. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-svh bg-[#f5f2f1] text-[#211d1e]">
      <section
        className="pb-10 text-white sm:pb-12"
        style={{ background: "linear-gradient(110deg, #510f1d 0%, #3b0a15 47%, #28070d 100%)" }}
      >
        <SiteHeader />
        <SectionContainer className="px-6 pt-28 sm:pt-32">
          <p className="section-eyebrow mt-7 text-[#cda45c]">Pagamento único</p>
          <h1 className="section-heading mt-3 max-w-[800px]">Carrinho</h1>
          <p className="mt-3 text-[15px] font-medium text-white/80">
            {lines.length === 0
              ? "Nenhum produto"
              : lines.length === 1
                ? "1 produto"
                : `${lines.length} produtos`}
          </p>
          <p className="content-card-copy mt-3 max-w-[620px] text-white/75">
            Junte os produtos e pague o total numa só cobrança.
          </p>
        </SectionContainer>
      </section>

      <section className="px-6 py-10 sm:py-14">
        <SectionContainer className="max-w-[920px]">
          {lines.length === 0 ? (
            <div className="rounded-[28px] border border-[#e7e1df] bg-white p-8">
              <h2 className="text-[20px] font-bold">O carrinho está vazio</h2>
              <p className="mt-2 text-sm leading-6 text-[#716a69]">
                Escolha um produto e acrescente o que quiser levar junto.
              </p>
              <Link
                className="mt-6 inline-flex min-h-12 items-center rounded-full bg-[#510f1d] px-5 text-sm font-semibold text-white"
                href="/#produtos"
              >
                Ver produtos
              </Link>
            </div>
          ) : (
            <>
            <CheckoutCompanions
              className="mb-6"
              amountLabel={(amount) => formatStudentPrice(verifiedStudent ? studentDiscountedAmount(amount) : amount)}
              selectedSlugs={selectedSlugs}
              suggestions={suggestions}
              onToggle={toggleSuggestion}
            />
            {offerNote ? <p className="mb-6 text-sm text-[#a43832]">{offerNote}</p> : null}
            <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.9fr)]">
              {reviewing ? (
                <section className="rounded-[28px] border border-[#e7e1df] bg-white p-6 sm:p-8">
                  <h2 className="text-[20px] font-bold">Confirme os seus dados</h2>
                  <dl className="mt-6 divide-y divide-[#eee8e5] rounded-2xl border border-[#eee8e5] px-4">
                    {[
                      ["Nome completo", details.name],
                      ["Email", details.email],
                      ["Telemóvel", details.phone],
                      ...(details.companyName ? [["Empresa", details.companyName]] : []),
                      ["Produtos", payable.map((line) => line.title).join(", ")],
                      ["Total a pagar", formatStudentPrice(total)],
                    ].map(([label, value]) => (
                      <div className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between" key={label}>
                        <dt className="text-sm text-[#716a69]">{label}</dt>
                        <dd className="text-sm font-semibold sm:text-right">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {error ? <p className="mt-5 rounded-xl bg-[#fff1f0] px-3 py-2 text-sm text-[#a43832]" role="alert">{error}</p> : null}
                  <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
                    <button
                      className="min-h-12 flex-1 rounded-full border border-[#e7e1df] px-5 text-sm font-medium"
                      disabled={submitting}
                      onClick={() => setReviewing(false)}
                      type="button"
                    >
                      Editar dados
                    </button>
                    <button
                      className="min-h-12 flex-1 rounded-full bg-[#510f1d] px-5 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={submitting || payable.length === 0}
                      onClick={() => void pay()}
                      type="button"
                    >
                      {submitting ? "A preparar pagamento…" : "Confirmar e pagar"}
                    </button>
                  </div>
                </section>
              ) : (
                <form className="rounded-[28px] border border-[#e7e1df] bg-white p-6 sm:p-8" onSubmit={submit}>
                  <h2 className="text-[20px] font-bold">Os seus dados</h2>
                  <p className="mt-2 text-sm text-[#716a69]">Um pagamento para todos os produtos do carrinho.</p>
                  {studentEnabled ? <StudentVerification onChange={setVerifiedStudent} value={verifiedStudent} /> : null}
                  <div className="mt-6 grid gap-4">
                    <label className="text-sm font-medium">
                      Nome completo
                      <input className="mt-1.5 min-h-12 w-full rounded-xl border border-[#e7e1df] px-4 text-sm outline-none focus:border-[#ae7d32]" maxLength={120} name="name" required value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} />
                    </label>
                    <label className="text-sm font-medium">
                      Email
                      <input className="mt-1.5 min-h-12 w-full rounded-xl border border-[#e7e1df] px-4 text-sm outline-none focus:border-[#ae7d32]" maxLength={254} name="email" required type="email" value={details.email} onChange={(event) => setDetails({ ...details, email: event.target.value })} />
                    </label>
                    <label className="text-sm font-medium">
                      Telefone
                      <input className="mt-1.5 min-h-12 w-full rounded-xl border border-[#e7e1df] px-4 text-sm outline-none focus:border-[#ae7d32]" maxLength={24} name="phone" required type="tel" value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })} />
                    </label>
                    <label className="text-sm font-medium">
                      Empresa (opcional)
                      <input className="mt-1.5 min-h-12 w-full rounded-xl border border-[#e7e1df] px-4 text-sm outline-none focus:border-[#ae7d32]" maxLength={160} name="companyName" value={details.companyName} onChange={(event) => setDetails({ ...details, companyName: event.target.value })} />
                    </label>
                  </div>
                  {error ? <p className="mt-5 rounded-xl bg-[#fff1f0] px-3 py-2 text-sm text-[#a43832]" role="alert">{error}</p> : null}
                  <button className="mt-6 min-h-12 w-full rounded-full bg-[#510f1d] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={payable.length === 0} type="submit">
                    Continuar para pagamento
                  </button>
                </form>
              )}

              <aside className="rounded-[28px] border border-[#e7e1df] bg-white p-6 sm:p-8 md:sticky md:top-6 md:self-start">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#ae7d32]">Resumo</p>
                  <p className="text-xs font-semibold text-[#510f1d]">
                    {payable.length === 1 ? "1 produto" : `${payable.length} produtos`}
                  </p>
                </div>
                <ul className="mt-4 space-y-4">
                  {lines.map((line) => (
                    <li className="flex gap-3" key={line.slug}>
                      <Image alt="" className="h-14 w-14 flex-none rounded-xl bg-[#f5f0ed] object-cover" height={56} src={line.image} width={56} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{line.title}</p>
                        <p className="mt-1 text-xs text-[#716a69]">
                          {line.available ? `${line.variantLabel} · ${formatStudentPrice(verifiedStudent ? studentDiscountedAmount(line.amountKz) : line.amountKz)}` : "Já não está disponível"}
                        </p>
                        {verifiedStudent && line.available ? (
                          <p className="mt-1 text-xs text-[#716a69]">Desconto de aluno: {studentDiscountPercent(line.amountKz)}%</p>
                        ) : null}
                        <button className="mt-2 text-xs font-semibold text-[#862f3b]" onClick={() => removeCartLine(line.slug)} type="button">
                          Retirar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 border-t border-[#eee8e5] pt-4 text-xl font-bold text-[#510f1d]">
                  {formatStudentPrice(total)}
                </p>
              </aside>
            </div>
            </>
          )}
        </SectionContainer>
      </section>
    </main>
  );
}
