import Image from "next/image";
import SectionContainer from "./section-container";

const pillars = [
  { number: "01", label: "Segurança financeira" },
  { number: "02", label: "Realização de sonhos" },
  { number: "03", label: "Renovação e comunidade" },
];

const steps = [
  { number: "01", label: "Consciência" },
  { number: "02", label: "Decisão" },
  { number: "03", label: "Acção" },
];

function Principles({
  heading,
  items,
}: {
  heading: string;
  items: { number: string; label: string }[];
}) {
  return (
    <div>
      <h3 className="section-eyebrow text-[#cda45c]">
        {heading}
      </h3>
      <div className="mt-[18px] grid grid-cols-3 gap-[19px]">
        {items.map((item) => (
          <div
            className="border-t border-white/45 pt-[18px]"
            key={item.number}
          >
            <p className="section-eyebrow text-[#d0ad73]">
              {item.number}
            </p>
            <p className="content-card-copy mt-[11px] text-white/90">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PorqueEscolherKitadi() {
  return (
    <section
      aria-labelledby="why-kitadi-title"
      className="flex min-h-svh items-center px-6 py-16 text-white sm:py-20 lg:py-10"
      id="quem-somos"
      style={{
        background:
          "linear-gradient(110deg, #510f1d 0%, #3b0a15 47%, #28070d 100%)",
      }}
    >
      <SectionContainer className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.14fr)_minmax(0,1fr)] lg:items-start lg:gap-16">
        <div className="w-full max-w-[428px]">
          <p className="section-eyebrow text-[#cda45c]">
            Porquê escolher a Kitadi
          </p>
          <h2
            className="section-heading mt-5 max-w-[430px]"
            id="why-kitadi-title"
          >
            O dinheiro deve sustentar uma vida com propósito
          </h2>
          <p className="content-card-copy mt-[16px] max-w-[410px] text-white/75">
            O dinheiro pode sustentar um estilo de vida, mas deve sustentar
            sobretudo paz, segurança, liberdade e legado.
          </p>

          <div className="mt-[28px]">
            <Principles heading="Os nossos pilares" items={pillars} />
          </div>

          <div className="mt-[32px]">
            <Principles heading="O nosso método" items={steps} />
          </div>
        </div>

        <article className="content-card w-full max-w-[350px] justify-self-end bg-white p-4 text-[#211d1e] sm:p-4 lg:pb-10">
          <div className="relative h-[270px] overflow-hidden rounded-[12px] bg-[#f5f2f1]">
            <Image
              alt="Neuza Pinto, educadora financeira"
              className="object-cover object-[center_35%]"
              fill
              sizes="(min-width: 1024px) 310px, 263px"
              src="/neuza-pinto.jpg"
            />
          </div>
          <h3 className="content-card-title mt-1 text-[#cda45c]">
            Neuza Pinto
          </h3>
          <p className="section-eyebrow text-[#625c5c]">
            Educadora financeira &amp; business designer
          </p>
          <p className="content-card-copy mt-1 text-[14px] leading-[1.3] text-[#625c5c]">
            Com mais de 20 anos de experiência em gestão financeira,
            desenvolvimento humano e orientação estratégica, é uma referência
            consolidada em Angola na intersecção entre finanças pessoais e
            transformação de vida.
          </p>

          <div className="mt-2 grid grid-cols-2 gap-6">
            <div>
              <p className="text-[28px] font-bold leading-none text-[#cda45c]">
                20+
              </p>
              <p className="text-[12px] text-[#625c5c]">
                Anos de experiência
              </p>
            </div>
            <div>
              <p className="text-[28px] font-bold leading-none text-[#cda45c]">
                10K+
              </p>
              <p className="text-[12px] text-[#625c5c]">
                Clientes atendidos
              </p>
            </div>
          </div>
        </article>
      </SectionContainer>
    </section>
  );
}
