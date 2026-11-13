import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCheckoutPath,
  getWhatsAppHref,
  offersCheckout,
  type Course,
} from "../../course-data";
import { getPublishedCourseBySlug } from "../../lib/products";
import SectionContainer from "../../section-container";
import SiteHeader from "../../site-header";

export const dynamic = "force-dynamic";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await getPublishedCourseBySlug(slug);

  return {
    title: course ? `${course.title} | Kitadi` : "Produto não encontrado | Kitadi",
    description: course?.description,
  };
}

const burgundy = {
  background:
    "linear-gradient(110deg, #510f1d 0%, #3b0a15 47%, #28070d 100%)",
} as const;

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

function CheckIcon({ className = "text-[#cda45c]" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`mt-0.5 h-4 w-4 flex-none ${className}`}
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="m3.2 8.1 3.1 3.1 6.5-6.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PrimaryCta({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  const external = href.startsWith("http");

  return (
    <a
      className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#cda45c] px-8 text-[14px] font-medium !text-[#2b160f] transition-colors hover:bg-[#dab76e]"
      href={href}
      {...(external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      {children}
      <ArrowIcon />
    </a>
  );
}

function JoinCta({
  course,
  centered = false,
}: {
  course: Course;
  centered?: boolean;
}) {
  const checkout = offersCheckout(course);

  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row ${centered ? "justify-center" : ""}`}
    >
      {checkout ? (
        <PrimaryCta href={getCheckoutPath(course)}>Ir para o checkout</PrimaryCta>
      ) : (
        <PrimaryCta href={getWhatsAppHref(course)}>{course.ctaLabel}</PrimaryCta>
      )}
    </div>
  );
}

function GhostCta({ href, children }: { href: string; children: string }) {
  return (
    <Link
      className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/85 px-8 text-[14px] font-medium text-white transition-colors hover:bg-white/10"
      href={href}
    >
      {children}
    </Link>
  );
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const course = await getPublishedCourseBySlug(slug);

  if (!course) notFound();

  return (
    <main className="min-h-svh bg-[#f5f2f1] text-[#211d1e]">
      <Hero course={course} />
      <Moment course={course} />
      <About course={course} />
      <Audience course={course} />
      {course.results.length > 0 ? <Results course={course} /> : null}
      <Method course={course} />
      <Investment course={course} />
      <NextSteps course={course} />
      <Closing course={course} />
    </main>
  );
}

function Hero({ course }: { course: Course }) {
  return (
    <section className="relative overflow-hidden text-white" style={burgundy}>
      <SiteHeader />
      <SectionContainer className="px-6 pb-16 pt-28 sm:pb-20 sm:pt-32">
        <nav aria-label="Navegação estrutural" className="text-sm text-white/70">
          <Link className="transition-colors hover:text-white" href="/#inicio">
            Início
          </Link>
          <span aria-hidden="true" className="mx-3 text-[#cda45c]">
            ›
          </span>
          <Link className="transition-colors hover:text-white" href="/produtos">
            Produtos
          </Link>
          <span aria-hidden="true" className="mx-3 text-[#cda45c]">
            ›
          </span>
          <span aria-current="page" className="text-white">
            {course.title}
          </span>
        </nav>

        <div className="mt-10 grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-8">
          <div>
            <p className="section-eyebrow text-[#cda45c]">{course.heroEyebrow}</p>
            <h1 className="section-heading mt-5 max-w-[640px] text-white">
              {course.title}
            </h1>
            <p className="content-card-copy mt-5 max-w-[520px] text-white/80">
              {course.tagline}
            </p>
            <p className="mt-3 text-[15px] font-medium text-[#cda45c]">
              {course.heroSubtitle}
            </p>

            <dl className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ["Conduzida por", course.conductedBy],
                ["Formato", course.format],
                ["Modalidade", course.modality],
              ].map(([label, value]) => (
                <div className="border-t border-white/25 pt-4" key={label}>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#cda45c]">
                    {label}
                  </dt>
                  <dd className="mt-2 text-[14px] leading-[1.45] text-white/90">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-10 flex flex-col gap-3">
              {offersCheckout(course) ? (
                <p className="text-[clamp(1.8rem,3vw,2.4rem)] font-bold leading-none tracking-[0.04em] text-white">
                  {course.price}
                </p>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row">
                <JoinCta course={course} />
                <GhostCta href="#sobre">Saber mais</GhostCta>
              </div>
            </div>
          </div>

          <div
            className={`relative mx-auto w-full max-w-[460px] lg:max-w-none ${
              course.imageMode === "photo"
                ? "aspect-[4/5] overflow-hidden rounded-[24px]"
                : "aspect-[4/5]"
            }`}
          >
            <Image
              alt={course.alt}
              className={
                course.imageMode === "photo"
                  ? "object-cover"
                  : "object-contain object-right drop-shadow-[0_24px_48px_rgba(0,0,0,0.35)]"
              }
              fill
              priority
              sizes="(min-width: 1024px) 480px, 90vw"
              src={course.image}
            />
          </div>
        </div>
      </SectionContainer>
    </section>
  );
}

function Moment({ course }: { course: Course }) {
  return (
    <section className="px-6 py-16 text-white sm:py-20" style={burgundy}>
      <SectionContainer>
        <p className="section-eyebrow text-[#cda45c]">{course.momentEyebrow}</p>
        <h2 className="section-heading mt-5 max-w-[760px]">
          {course.momentTitle}{" "}
          <span className="text-[#cda45c]">{course.momentAccent}</span>
        </h2>
        <p className="content-card-copy mt-5 max-w-[640px] text-white/80">
          {course.momentLead}
        </p>
        {course.momentQuestions.length > 0 ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {course.momentQuestions.map((question) => (
              <p
                className="rounded-[18px] border border-[#cda45c]/45 px-5 py-5 text-[15px] italic leading-[1.55] text-white/90"
                key={question}
              >
                {question}
              </p>
            ))}
          </div>
        ) : null}
      </SectionContainer>
    </section>
  );
}

function About({ course }: { course: Course }) {
  return (
    <section className="bg-white px-6 py-16 sm:py-20" id="sobre">
      <SectionContainer>
        <p className="section-eyebrow text-[#ae7d32]">{course.aboutEyebrow}</p>
        <h2 className="section-heading mt-5 max-w-[720px] text-[#211d1e]">
          {course.aboutHeading}
        </h2>
        <blockquote className="mt-8 max-w-[760px] border-l-4 border-[#cda45c] bg-[#510f1d] px-6 py-6 text-[16px] italic leading-[1.7] text-white sm:px-8">
          {course.aboutHighlight}
        </blockquote>
        {course.aboutBody.length > 0 ? (
          <div className="mt-8 max-w-[720px] space-y-4">
            {course.aboutBody.map((paragraph) => (
              <p className="content-card-copy text-[#625c5c]" key={paragraph}>
                {paragraph}
              </p>
            ))}
          </div>
        ) : null}
      </SectionContainer>
    </section>
  );
}

function Audience({ course }: { course: Course }) {
  return (
    <section className="px-6 py-16 text-white sm:py-20" style={burgundy}>
      <SectionContainer>
        <p className="section-eyebrow text-[#cda45c]">{course.audienceEyebrow}</p>
        <h2 className="section-heading mt-5 max-w-[720px]">
          {course.audienceHeading}
        </h2>
        {course.audienceIntro ? (
          <p className="content-card-copy mt-5 max-w-[680px] text-white/80">
            {course.audienceIntro}
          </p>
        ) : null}
        <div className="mt-10 grid gap-px overflow-hidden rounded-[24px] border border-[#cda45c]/35 bg-[#cda45c]/35 sm:grid-cols-2 lg:grid-cols-3">
          {course.audienceGroups.map((group) => (
            <article className="bg-[#3b0a15] px-6 py-7" key={group.title}>
              <h3 className="text-[17px] font-bold leading-[1.35] tracking-[0.04em] text-[#cda45c]">
                {group.title}
              </h3>
              <p className="mt-3 text-[14px] italic leading-[1.6] text-white/80">
                {group.description}
              </p>
            </article>
          ))}
        </div>
      </SectionContainer>
    </section>
  );
}

function Results({ course }: { course: Course }) {
  return (
    <section className="bg-[#f5f2f1] px-6 py-16 sm:py-20">
      <SectionContainer>
        <p className="section-eyebrow text-[#ae7d32]">Resultados esperados</p>
        <h2 className="section-heading mt-5 max-w-[720px] text-[#211d1e]">
          A transformação que irá experienciar
        </h2>
        <p className="content-card-copy mt-5 max-w-[620px] text-[#625c5c]">
          {course.resultsIntro}
        </p>
        <ol className="mt-10 divide-y divide-[#e7e1df] border-y border-[#e7e1df]">
          {course.results.map((result, index) => (
            <li className="flex gap-5 py-5" key={result}>
              <span className="w-10 flex-none text-[13px] font-bold tracking-[0.08em] text-[#862f3b]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="text-[16px] italic leading-[1.6] text-[#211d1e]">
                {result}
              </p>
            </li>
          ))}
        </ol>
      </SectionContainer>
    </section>
  );
}

function Method({ course }: { course: Course }) {
  return (
    <section className="px-6 py-16 text-white sm:py-20" style={burgundy}>
      <SectionContainer>
        <p className="section-eyebrow text-[#cda45c]">
          {course.methodEyebrow ?? "A metodologia"}
        </p>
        <h2 className="section-heading mt-5 max-w-[640px]">
          {course.methodHeading ?? "Como será executado"}
        </h2>
        <p className="content-card-copy mt-5 max-w-[560px] text-white/80">
          {course.methodIntro}
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-start">
          <ol className="space-y-6">
            {course.methodSteps.map((step) => (
              <li className="flex gap-5" key={step.number}>
                <span className="flex size-12 flex-none items-center justify-center rounded-full border border-[#cda45c] text-[15px] font-bold text-[#cda45c]">
                  {Number(step.number)}
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#cda45c]">
                    {step.phase}
                  </p>
                  <h3 className="mt-1 text-[20px] font-bold tracking-[0.04em]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[15px] italic leading-[1.65] text-white/80">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {course.bonusTitle ? (
            <aside className="rounded-[24px] border border-[#cda45c]/50 px-6 py-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#cda45c]">
                Bónus exclusivo
              </p>
              <h3 className="mt-3 text-[20px] font-bold tracking-[0.04em]">
                {course.bonusTitle}
              </h3>
              <p className="mt-3 text-[15px] italic leading-[1.65] text-white/80">
                {course.bonusDescription}
              </p>
            </aside>
          ) : null}
        </div>
      </SectionContainer>
    </section>
  );
}

function Investment({ course }: { course: Course }) {
  return (
    <section
      className="scroll-mt-24 px-6 py-16 text-white sm:py-20"
      id="investimento"
      style={burgundy}
    >
      <SectionContainer>
        <p className="section-eyebrow text-[#cda45c]">Aderir</p>
        <h2 className="section-heading mt-5 max-w-[640px]">
          {offersCheckout(course) ? "Inscreva-se" : "Fale connosco no WhatsApp"}
        </h2>
        <p className="content-card-copy mt-5 max-w-[620px] text-white/80">
          {course.investmentIntro}
        </p>

        <article className="mt-10 flex max-w-[560px] flex-col rounded-[24px] border border-[#cda45c]/45 bg-black/20 px-6 py-8 sm:px-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#cda45c]">
            {offersCheckout(course) ? "Investimento" : "WhatsApp"}
          </p>
          <p className="mt-4 text-[clamp(1.6rem,3vw,2.2rem)] font-bold leading-none tracking-[0.04em]">
            {offersCheckout(course) ? course.price : "+244 936 250 151"}
          </p>
          <p className="mt-3 text-[14px] text-white/70">
            {course.format} · {course.modality}
          </p>
          <div className="mt-8">
            <JoinCta course={course} />
          </div>
        </article>

        <div className="mt-8 rounded-[24px] border border-white/12 px-6 py-7 sm:px-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#cda45c]">
            Inclui
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {course.includes.map((item) => (
              <li
                className="flex items-start gap-3 text-[15px] text-white/90"
                key={item}
              >
                <CheckIcon />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </SectionContainer>
    </section>
  );
}

function NextSteps({ course }: { course: Course }) {
  return (
    <section className="bg-white px-6 py-16 sm:py-20">
      <SectionContainer>
        <p className="section-eyebrow text-[#ae7d32]">Próximos passos</p>
        <h2 className="section-heading mt-5 max-w-[640px] text-[#211d1e]">
          Como começamos
        </h2>
        <p className="content-card-copy mt-4 max-w-[480px] text-[#625c5c]">
          O processo é simples e inteiramente orientado para si.
        </p>
        <ol
          className={`mt-12 grid gap-8 ${
            course.nextSteps.length === 5
              ? "sm:grid-cols-5"
              : "sm:grid-cols-2 lg:grid-cols-4"
          }`}
        >
          {course.nextSteps.map((step, index) => (
            <li className="text-center" key={step}>
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#510f1d] text-[16px] font-bold text-white">
                {index + 1}
              </span>
              <p className="mt-4 text-[14px] italic leading-[1.5] text-[#211d1e]">
                {step}
              </p>
            </li>
          ))}
        </ol>
      </SectionContainer>
    </section>
  );
}

function Closing({ course }: { course: Course }) {
  return (
    <section className="px-6 py-16 text-white sm:py-24" style={burgundy}>
      <SectionContainer className="max-w-[760px] text-center">
        <p className="section-heading">
          {course.closingLead}
          <span className="mt-3 block text-[#cda45c]">{course.closingAccent}</span>
        </p>
        <p className="content-card-copy mt-6 text-white/80">{course.closingNote}</p>
        <div className="mt-10">
          <JoinCta centered course={course} />
        </div>
      </SectionContainer>
    </section>
  );
}
