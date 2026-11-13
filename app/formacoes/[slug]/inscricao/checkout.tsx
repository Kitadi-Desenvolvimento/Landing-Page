"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  getCourseVariant,
  getProductPath,
  type Course,
} from "../../../course-data";
import SectionContainer from "../../../section-container";
import SiteHeader from "../../../site-header";

type EnrollmentDetails = {
  name: string;
  email: string;
  phone: string;
};

type ChargeDetails = {
  customId: string;
  chargeId: string;
  status: PaymentStatus;
  checkoutUrl: string;
  entity: string | null;
  reference: string | null;
  amount: number;
  currency: "AOA";
  expiresAt: string | null;
};

type PaymentStatus = "pending" | "paid" | "failed" | "expired" | "canceled" | "refunded";

type OrderStatusResult = {
  reference: string;
  status: "pending" | "accepted" | "rejected" | "expired" | "canceled" | "refunded";
  amountKz: number;
};

function isChargeDetails(value: unknown): value is ChargeDetails {
  if (typeof value !== "object" || value === null) return false;
  const charge = value as Record<string, unknown>;

  return (
    typeof charge.customId === "string" &&
    typeof charge.chargeId === "string" &&
    isPaymentStatus(charge.status) &&
    typeof charge.checkoutUrl === "string" &&
    (() => {
      try {
        const url = new URL(charge.checkoutUrl);
        return (
          url.protocol === "https:" &&
          (url.hostname === "hosted.wipay.ao" || url.hostname === "pay.wiza.ao")
        );
      } catch {
        return false;
      }
    })() &&
    (typeof charge.entity === "string" || charge.entity === null) &&
    (typeof charge.reference === "string" || charge.reference === null) &&
    typeof charge.amount === "number" &&
    charge.currency === "AOA" &&
    (typeof charge.expiresAt === "string" || charge.expiresAt === null)
  );
}

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return (
    value === "pending" ||
    value === "paid" ||
    value === "failed" ||
    value === "expired" ||
    value === "canceled" ||
    value === "refunded"
  );
}

function isOrderStatusResult(value: unknown): value is OrderStatusResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;

  return (
    typeof result.reference === "string" &&
    (result.status === "pending" ||
      result.status === "accepted" ||
      result.status === "rejected" ||
      result.status === "expired" ||
      result.status === "canceled" ||
      result.status === "refunded") &&
    typeof result.amountKz === "number"
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-[14px] w-[14px]"
      fill="none"
      viewBox="0 0 24 24"
    >
      <rect
        height="11"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        width="15"
        x="4.5"
        y="10"
      />
      <path
        d="M8 10V7a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="15.5" r="1" fill="currentColor" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3 w-3 flex-none text-[#862f3b]"
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="m3.5 8 3 3 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function PaymentInstructions({
  charge,
  email,
  statusError,
}: {
  charge: ChargeDetails;
  email: string;
  statusError: string | null;
}) {
  const isPaid = charge.status === "paid";
  const isPending = charge.status === "pending";
  const instructions = [
    {
      title: "Abra o checkout seguro da WiPay",
      description:
        "No checkout da WiPay, confirme o pagamento com o método disponível.",
    },
    {
      title: "Confirme o valor",
      description:
        "Verifique o valor e os dados da inscrição antes de autorizar o pagamento.",
    },
    {
      title: "Aguarde a confirmação",
      description:
        "Depois do pagamento, a WiPay devolve-o à Kitadi com a confirmação.",
    },
  ];

  return (
    <div className="rounded-[28px] border border-[#e7e1df] bg-white p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#f7efe0] px-3 py-1.5 text-xs font-medium text-[#862f3b]">
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 20 20"
            >
              <circle
                cx="10"
                cy="10"
                r="7"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path
                d="M10 6v4l2.5 1.5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.3"
              />
            </svg>
            {isPaid
              ? "Pagamento confirmado"
              : isPending
                ? "Cobrança criada"
                : "Pagamento não concluído"}
          </span>
          <h2 aria-live="polite" className="mt-5 text-[20px] font-bold">
            {isPaid
              ? "Pagamento confirmado"
              : isPending
                ? "Continue para o checkout"
                : "Verifique o estado do pagamento"}
          </h2>
        </div>
      </div>

      <p className="content-card-copy mt-3 text-sm text-[#716a69]">
        {isPaid
          ? "A WiPay confirmou o pagamento desta inscrição."
          : isPending
            ? "A cobrança foi criada. Continue para o checkout seguro da WiPay."
            : `O estado atual do pagamento é: ${charge.status}.`}
      </p>

      <p className="mt-3 text-sm text-[#716a69]">
        Confirmação da inscrição:{" "}
        <span className="font-medium text-[#211d1e]">{email}</span>
      </p>

      <div className="mt-5 rounded-2xl bg-[#f7efe0] p-5">
        <dl className="divide-y divide-[#e7e1df]">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-sm text-[#716a69]">Valor</dt>
            <dd className="text-right text-base font-semibold text-[#862f3b]">
              {new Intl.NumberFormat("pt-AO").format(charge.amount)} Kz
            </dd>
          </div>
          {charge.expiresAt && (
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-sm text-[#716a69]">Válida até</dt>
              <dd className="text-right text-sm font-medium">
                {new Date(charge.expiresAt).toLocaleString("pt-AO")}
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-sm text-[#716a69]">Número da cobrança</dt>
            <dd className="max-w-[65%] break-all text-right text-xs font-medium">
              {charge.chargeId}
            </dd>
          </div>
        </dl>
      </div>

      {isPending && (
        <a
          className="mt-5 inline-flex min-h-[46px] w-full items-center justify-center rounded-full bg-[#cda45c] px-6 text-sm font-medium text-[#2b160f] transition-colors hover:bg-[#dab76e]"
          href={charge.checkoutUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Continuar para o checkout seguro
        </a>
      )}

      {statusError && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {statusError}
        </p>
      )}

      <div className="my-5 border-t border-[#e7e1df]" />

      <h3 className="text-[18px] font-bold">Próximos passos</h3>
      <ol className="mt-4 space-y-4">
        {instructions.map((instruction, index) => (
          <li className="flex items-start gap-3" key={instruction.title}>
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#f7efe0] text-xs font-medium text-[#862f3b]">
              {index + 1}
            </span>
            <span>
              <span className="block text-sm font-medium">
                {instruction.title}
              </span>
              <span className="mt-1 block text-sm leading-[1.5] text-[#716a69]">
                {instruction.description}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-5 rounded-2xl border border-[#e7e1df] bg-[#faf9f8] p-4 text-sm leading-[1.5] text-[#716a69]">
        <span className="font-medium text-[#862f3b]">Importante:</span> a
        Kitadi nunca pede o seu PIN, códigos de acesso ou credenciais bancárias.
      </p>

    </div>
  );
}

export default function Checkout({
  course,
  initialVariantId,
}: {
  course: Course;
  initialVariantId?: string;
}) {
  const [paymentCharge, setPaymentCharge] = useState<ChargeDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [variantId, setVariantId] = useState(
    getCourseVariant(course, initialVariantId)?.id ?? course.variants[0]?.id ?? "",
  );
  const variant =
    getCourseVariant(course, variantId) ?? course.variants[0];
  const [enrollment, setEnrollment] = useState<EnrollmentDetails>({
    name: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    if (!paymentCharge || paymentCharge.status !== "pending") return;

    let active = true;
    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/payments/orders/${encodeURIComponent(paymentCharge.chargeId)}`,
          { cache: "no-store" },
        );
        const result: unknown = await response.json();

        if (
          !response.ok ||
          !isOrderStatusResult(result) ||
          result.reference !== paymentCharge.chargeId ||
          result.amountKz !== paymentCharge.amount
        ) {
          throw new Error("Não foi possível consultar o estado do pagamento.");
        }

        if (active) {
          setPaymentCharge((current) =>
            current
              ? {
                  ...current,
                  status:
                    result.status === "accepted"
                      ? "paid"
                      : result.status === "rejected"
                        ? "failed"
                        : result.status,
                  expiresAt: null,
                }
              : current,
          );
          setPaymentError(null);
        }
      } catch {
        if (active) {
          setPaymentError(
            "Não foi possível atualizar o estado do pagamento. Vamos tentar novamente.",
          );
        }
      }
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [paymentCharge]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setPaymentError(null);

    try {
      const response = await fetch("/api/payments/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: course.slug,
          variantId: variant.id,
          name: enrollment.name,
          email: enrollment.email,
          phone: enrollment.phone,
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

      if (!isChargeDetails(result)) {
        throw new Error("O serviço de pagamentos devolveu dados inválidos.");
      }

      if (result.amount !== variant.priceAmount) {
        throw new Error("O valor devolvido não corresponde a esta inscrição.");
      }

      window.location.assign(result.checkoutUrl);
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a cobrança. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!variant) return null;

  const paymentHeading = paymentCharge
    ? "Pagamento seguro"
    : "Inscrição da consultoria";
  const checkoutHeading =
    paymentCharge?.status === "paid"
      ? "Pagamento confirmado"
      : paymentCharge && paymentCharge.status !== "pending"
        ? "Pagamento não concluído"
      : paymentCharge
        ? "Continue para o checkout"
        : "Está a um passo de começar";
  const checkoutDescription =
    paymentCharge?.status === "paid"
      ? "A WiPay confirmou o pagamento desta inscrição."
      : paymentCharge && paymentCharge.status !== "pending"
        ? `O estado atual do pagamento é: ${paymentCharge.status}.`
      : paymentCharge
        ? "A cobrança foi criada. Continue para o checkout seguro da WiPay."
        : "Preencha os seus dados e escolha como pagar. Sem carrinho, sem complicações.";

  return (
    <main className="min-h-svh text-[#211d1e]">
      <section
        aria-labelledby="checkout-title"
        className="pb-10 text-white sm:pb-12"
        style={{
          background:
            "linear-gradient(110deg, #510f1d 0%, #3b0a15 47%, #28070d 100%)",
        }}
      >
        <SiteHeader />
        <SectionContainer className="px-6 pt-8 sm:pt-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <Link
              className="text-sm font-medium text-white/80 transition-colors hover:text-[#cda45c]"
              href={getProductPath(course)}
            >
              <span aria-hidden="true">←</span> Voltar ao produto
            </Link>

            <ol
              aria-label="Etapas da inscrição"
              className="flex items-center gap-3 text-xs font-medium"
            >
              <li aria-current="step" className="whitespace-nowrap text-[#d0ad73]">
                1. Dados e pagamento
              </li>
              <li aria-hidden="true" className="h-px w-8 bg-white/40" />
              <li className="whitespace-nowrap text-white/60">
                2. Confirmação da sessão
              </li>
            </ol>
          </div>

          <p className="section-eyebrow mt-7 text-[#cda45c]">{paymentHeading}</p>
          <h1 className="section-heading mt-3 max-w-[800px]" id="checkout-title">
            {checkoutHeading}
          </h1>
          <p className="content-card-copy mt-3 max-w-[620px] text-white/75">
            {checkoutDescription}
          </p>
        </SectionContainer>
      </section>

      <section
        aria-label={
          paymentCharge
            ? "Instruções de pagamento e resumo da consultoria"
            : "Dados de inscrição e resumo da consultoria"
        }
        className="bg-[#f5f2f1] px-6 py-10 sm:py-14"
      >
        <SectionContainer className="max-w-[920px]">
          <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.9fr)] lg:gap-7">
            {paymentCharge ? (
              <PaymentInstructions
                charge={paymentCharge}
                email={enrollment.email}
                statusError={paymentError}
              />
            ) : (
            <form
              className="rounded-[28px] border border-[#e7e1df] bg-white p-6 sm:p-8"
              onSubmit={handleSubmit}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[20px] font-bold">Os seus dados</h2>
                <p className="text-sm text-[#716a69]">
                  Não precisa de criar conta
                </p>
              </div>

              <fieldset className="mt-6">
                <legend className="mb-3 text-sm font-medium">
                  Formato da sessão
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {course.variants.map((option) => {
                    const selected = option.id === variant.id;
                    return (
                      <label
                        className={`flex cursor-pointer flex-col rounded-[18px] border px-4 py-4 transition-colors ${
                          selected
                            ? "border-[#862f3b] bg-[#f7efe0]"
                            : "border-[#e7e1df] bg-[#faf9f8] hover:border-[#cda45c]"
                        }`}
                        key={option.id}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            checked={selected}
                            className="accent-[#862f3b]"
                            name="variante"
                            onChange={() => setVariantId(option.id)}
                            type="radio"
                            value={option.id}
                          />
                          <span className="text-sm font-medium">
                            {option.label}
                          </span>
                        </span>
                        <span className="mt-2 pl-6 text-xs text-[#716a69]">
                          {option.detail}
                        </span>
                        <span className="mt-1 pl-6 text-sm font-semibold text-[#862f3b]">
                          {option.price}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mt-6 space-y-5">
                <div>
                  <label
                    className="mb-2 block text-sm font-medium"
                    htmlFor="full-name"
                  >
                    Nome completo
                  </label>
                  <input
                    autoComplete="name"
                    className="h-[50px] w-full rounded-full border border-[#e7e1df] bg-[#faf9f8] px-5 text-base outline-none transition focus:border-[#862f3b]"
                    id="full-name"
                    name="name"
                    onChange={(event) =>
                      setEnrollment({ ...enrollment, name: event.target.value })
                    }
                    placeholder="O seu nome completo"
                    required
                    value={enrollment.name}
                  />
                </div>

                <div>
                  <label
                    className="mb-2 block text-sm font-medium"
                    htmlFor="email"
                  >
                    Email
                  </label>
                  <input
                    autoComplete="email"
                    className="h-[50px] w-full rounded-full border border-[#e7e1df] bg-[#faf9f8] px-5 text-base outline-none transition focus:border-[#862f3b]"
                    id="email"
                    name="email"
                    onChange={(event) =>
                      setEnrollment({ ...enrollment, email: event.target.value })
                    }
                    placeholder="nome@exemplo.com"
                    required
                    type="email"
                    value={enrollment.email}
                  />
                  <p className="mt-2 text-sm leading-[1.5] text-[#716a69]">
                    Este email identifica a inscrição e fica associado à cobrança.
                  </p>
                </div>
              </div>

              <div className="my-6 border-t border-[#e7e1df]" />

              <div className="mt-6 rounded-2xl bg-[#f7efe0] p-4">
                <p className="text-sm font-medium text-[#862f3b]">
                  Métodos disponíveis
                </p>
                <p className="mt-1 text-sm leading-[1.5] text-[#716a69]">
                  No checkout seguro da WiPay confirma o pagamento do valor
                  indicado nesta inscrição.
                </p>
              </div>

              <div className="mt-5">
                <label
                  className="mb-2 block text-sm font-medium"
                  htmlFor="phone"
                >
                  Telemóvel de contacto
                </label>
                <input
                  autoComplete="tel"
                  className="h-[50px] w-full rounded-full border border-[#e7e1df] bg-[#faf9f8] px-5 text-base outline-none transition focus:border-[#862f3b]"
                  id="phone"
                  name="phone"
                  onChange={(event) =>
                    setEnrollment({ ...enrollment, phone: event.target.value })
                  }
                  pattern="^\+?[0-9 ]{9,17}$"
                  placeholder="+244 923 000 000"
                  required
                  type="tel"
                  value={enrollment.phone}
                />
              </div>

              {paymentError && !paymentCharge && (
                <p
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                  role="alert"
                >
                  {paymentError}
                </p>
              )}

              <button
                className="mt-6 inline-flex min-h-[50px] w-full items-center justify-center rounded-full bg-[#cda45c] px-5 text-sm font-medium text-[#2b160f] transition-colors hover:bg-[#dab76e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#862f3b] disabled:cursor-wait disabled:opacity-70"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? "A criar cobrança…"
                  : `Continuar para pagamento · ${variant.price}`}
              </button>

              <p className="mt-4 text-xs leading-[1.6] text-[#716a69]">
                Ao continuar, aceita os Termos de inscrição e a Política de
                privacidade da Kitadi.
              </p>
            </form>
            )}

            <aside className="overflow-hidden rounded-[28px] border border-[#e7e1df] bg-white">
              <div className="relative h-[210px] bg-[#3b0a15] sm:h-[190px]">
                <Image
                  alt={course.alt}
                  className="object-contain object-center"
                  fill
                  priority
                  sizes="(min-width: 768px) 300px, (min-width: 640px) 100vw, 100vw"
                  src={course.image}
                />
              </div>
              <div className="p-6 sm:p-7">
                <p className="section-eyebrow text-[11px] text-[#ae7d32]">
                  {course.category}
                </p>
                <h2 className="content-card-title mt-3">{course.title}</h2>
                <p className="content-card-copy mt-3 text-[#716a69]">
                  {course.description}
                </p>

                <div className="my-5 border-t border-[#e7e1df]" />

                <div className="flex items-center justify-between text-sm text-[#716a69]">
                  <span>
                    {variant.label} · {variant.detail}
                  </span>
                  <span className="text-[#211d1e]">{variant.price}</span>
                </div>

                <div className="mt-4 rounded-[16px] bg-[#f7efe0] p-5">
                  <p className="text-sm text-[#862f3b]">Total a pagar</p>
                  <p className="mt-1 text-[28px] font-bold leading-none text-[#862f3b]">
                    {variant.price}
                  </p>
                  <p className="mt-3 text-xs text-[#716a69]">
                    Pagamento único · Sem custos adicionais
                  </p>
                </div>

                <ul className="mt-6 space-y-4">
                  {course.includes.map((benefit) => (
                    <li
                      className="flex items-start gap-2 text-sm leading-[1.5] text-[#716a69]"
                      key={benefit}
                    >
                      <CheckIcon />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>

          <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#716a69]">
            <span className="text-[#862f3b]">
              <LockIcon />
            </span>
            <span className="font-medium text-[#211d1e]">
              Precisa de ajuda?
            </span>
            <a className="hover:text-[#862f3b]" href="tel:+244927313220">
              +244 927 313 220
            </a>
            <span aria-hidden="true">·</span>
            <a
              className="hover:text-[#862f3b]"
              href="mailto:contacto@kitadi.co.ao"
            >
              contacto@kitadi.co.ao
            </a>
          </p>
        </SectionContainer>
      </section>
    </main>
  );
}
