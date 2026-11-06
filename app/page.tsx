import Formacoes from "./formacoes";
import Contactos from "./contactos";
import PorqueEscolherKitadi from "./porque";
import Referencias from "./referencias";
import SectionContainer from "./section-container";

const navItems = [
  { label: "Início", href: "#inicio" },
  { label: "Serviços", href: "#servicos" },
  { label: "Quem somos", href: "#quem-somos" },
  { label: "Contactos", href: "#contactos" },
];

const serviceAreas = [
  {
    number: "01",
    title: "Finanças & Investimentos",
    description:
      "Educação financeira e construção de património com método e disciplina.",
  },
  {
    number: "02",
    title: "Kitadi for Business",
    description: "Organização, crescimento e transformação de negócios.",
  },
  {
    number: "03",
    title: "Pessoas & Cultura",
    description: "Formação, liderança e desenvolvimento de equipas.",
  },
  {
    number: "04",
    title: "Marca Neuza Pinto",
    description: "Palestras, mentoria e representação institucional.",
  },
];

const audiences = [
  {
    label: "Particulares",
    title: "Construa uma base sólida",
    description:
      "Aprenda a gerir o seu dinheiro, eliminar dívidas e criar um hábito de investimento que proteja o seu futuro.",
  },
  {
    label: "Empreendedores",
    title: "Do ponto de partida ao crescimento",
    description:
      "Planeie e consolide os seus objectivos com clareza, estrutura e acompanhamento.",
  },
  {
    label: "Empresas",
    title: "Estabilidade para as suas equipas",
    description:
      "Programas corporativos que transformam a relação das pessoas com o dinheiro.",
  },
];

function ContactButton({ className = "" }: { className?: string }) {
  return (
    <a
      className={`inline-flex min-h-[50px] items-center justify-center rounded-full bg-[#cda45c] px-[31px] text-[14px] font-medium text-[#2b160f] transition-colors hover:bg-[#dab76e] ${className}`}
      href="#contactos"
    >
      Contactar
    </a>
  );
}

export default function Home() {
  return (
    <main className="min-h-svh overflow-x-hidden">
      <section
        aria-labelledby="hero-title"
        className="flex min-h-svh flex-col"
        id="inicio"
      >
        <header className="mx-auto flex w-[calc(100%-48px)] max-w-[1058px] items-center justify-between pt-[30px]">
          <a
            aria-label="Kitadi — início"
            className="text-[27px] font-bold leading-none tracking-[-1.2px]"
            href="#inicio"
          >
            Kitadi
          </a>

          <nav
            aria-label="Navegação principal"
            className="hidden items-center gap-[45px] md:flex"
          >
            {navItems.map((item) => (
              <a
                className="text-[14px] font-normal text-white/90 transition-colors hover:text-[#d1aa64]"
                href={item.href}
                key={item.label}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <ContactButton className="hidden min-w-[128px] md:inline-flex" />

          <details className="group relative md:hidden">
            <summary
              aria-label="Abrir menu"
              className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full border border-white/50"
            >
              <span className="flex w-[18px] flex-col gap-[5px]">
                <span className="h-px w-full bg-white" />
                <span className="h-px w-full bg-white" />
                <span className="h-px w-full bg-white" />
              </span>
            </summary>
            <nav
              aria-label="Navegação principal"
              className="absolute right-0 top-[52px] z-10 flex min-w-[190px] flex-col gap-5 rounded-2xl border border-white/15 bg-[#390b15] p-5 shadow-xl"
            >
              {navItems.map((item) => (
                <a
                  className="text-sm text-white/90"
                  href={item.href}
                  key={item.label}
                >
                  {item.label}
                </a>
              ))}
              <ContactButton className="mt-1 min-h-11 px-5" />
            </nav>
          </details>
        </header>

        <div className="mx-auto flex w-[calc(100%-48px)] max-w-[1058px] flex-1 flex-col justify-center py-12 md:py-16">
          <p className="text-[12px] font-bold uppercase tracking-[0.7px] text-[#cda45c]">
            Escola de Finanças &amp; Negócios&nbsp; · &nbsp;Desde 2020
          </p>

          <h1
            className="mt-[30px] max-w-[850px] text-[clamp(2.5rem,5vw,3.75rem)] font-bold leading-[1.13] tracking-[-1.8px] text-white"
            id="hero-title"
          >
            Transformamos a relação
            <br className="hidden md:block" /> dos angolanos com{" "}
            <span className="text-[#cda45c]">o</span>
            <br className="hidden md:block" />{" "}
            <span className="text-[#cda45c]">dinheiro</span>
          </h1>

          <p className="mt-[31px] max-w-[620px] text-[16px] leading-[1.75] text-white/80 md:text-[17px]">
            Educação financeira, programas corporativos e iniciativas de impacto
            <br className="hidden md:block" /> social concebidos para a realidade angolana.
          </p>

          <div className="mt-[30px] flex flex-col gap-[14px] sm:flex-row">
            <a
              className="inline-flex min-h-[50px] items-center justify-center rounded-full bg-[#cda45c] px-[31px] text-[14px] font-medium text-[#2b160f] transition-colors hover:bg-[#dab76e]"
              href="#servicos"
            >
              Conhecer os serviços
            </a>
            <a
              className="inline-flex min-h-[50px] items-center justify-center rounded-full border border-white/85 px-[31px] text-[14px] font-medium text-white transition-colors hover:bg-white/10"
              href="#contactos"
            >
              Falar connosco
            </a>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="services-title"
        className="flex min-h-svh items-center bg-white px-6 py-16 text-[#1f1b1c] sm:py-20 lg:py-10"
        id="servicos"
      >
        <SectionContainer>
          <p className="section-eyebrow text-[#ae7d32]">
            O que fazemos
          </p>
          <h2
            className="section-heading mt-[20px] max-w-[820px]"
            id="services-title"
          >
            Quatro áreas, um objectivo: a sua estabilidade financeira
          </h2>

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-[26px]">
            {serviceAreas.map((area) => (
              <article
                className="content-card bg-[#faf9f8] px-8 py-8"
                key={area.number}
              >
                <p className="text-[13px] font-semibold tracking-[0.5px] text-[#ae7d32]">
                  {area.number}
                </p>
                <h3 className="content-card-title mt-[20px]">
                  {area.title}
                </h3>
                <p className="content-card-copy mt-[18px] text-[#625c5c]">
                  {area.description}
                </p>
              </article>
            ))}
          </div>
        </SectionContainer>
      </section>

      <section
        aria-labelledby="audiences-title"
        className="flex min-h-svh items-center bg-[#f5f2f1] px-6 py-16 text-[#1f1b1c] sm:py-20 lg:py-10"
        id="publico"
      >
        <SectionContainer>
          <p className="section-eyebrow text-[#ae7d32]">
            Para quem trabalhamos
          </p>
          <h2
            className="section-heading mt-[20px] max-w-[760px]"
            id="audiences-title"
          >
            Soluções para cada fase da sua vida financeira
          </h2>

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {audiences.map((audience) => (
              <article
                className="content-card flex flex-col border border-[#ece8e6] bg-white p-8"
                key={audience.label}
              >
                <p className="section-eyebrow text-[#ae7d32]">
                  {audience.label}
                </p>
                <h3 className="content-card-title mt-[18px]">
                  {audience.title}
                </h3>
                <p className="content-card-copy mt-[17px] text-[#716a69]">
                  {audience.description}
                </p>
                <a
                  className="mt-auto inline-flex items-center gap-2 pt-4 text-[15px] font-medium text-[#862f3b] transition-colors hover:text-[#5c1f29]"
                  href="#contactos"
                >
                  Saber mais <span aria-hidden="true">→</span>
                </a>
              </article>
            ))}
          </div>
        </SectionContainer>
      </section>

      <Formacoes />

      <PorqueEscolherKitadi />

      <Referencias />

      <Contactos />
    </main>
  );
}
