import SectionContainer from "./section-container";

const sectors = [
  {
    title: "Finanças & Seguros",
    organizations: ["FINANZA", "SEGURO", "BANCO"],
  },
  {
    title: "Oil & Gas",
    organizations: ["OILCO", "GASIX", "ENER"],
  },
  {
    title: "Outros sectores",
    organizations: ["RETAIL", "LOGIS", "TECH"],
  },
];

export default function Referencias() {
  return (
    <section
      aria-labelledby="references-title"
      className="flex min-h-svh items-center bg-white px-6 py-16 text-[#211d1e] sm:py-20 lg:py-10"
      id="referencias"
    >
      <SectionContainer className="max-w-[1324px]">
        <p className="section-eyebrow text-[#ae7d32]">
          Experiência &amp; Referências
        </p>
        <h2
          className="section-heading mt-6 max-w-[800px]"
          id="references-title"
        >
          Organizações que confiam na Kitadi
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:mt-[76px] lg:grid-cols-3 lg:gap-7">
          {sectors.map((sector) => (
            <article
              className="min-h-0 min-w-0 rounded-[28px] bg-[#faf9f8] p-6 sm:h-[225px] sm:p-[38px]"
              key={sector.title}
            >
              <h3 className="text-[22px] font-semibold leading-[1.35] tracking-[-0.3px] sm:text-[27px]">
                {sector.title}
              </h3>
              <ul
                aria-label={sector.title}
                className="mt-6 grid grid-cols-3 gap-2 sm:mt-[30px] sm:gap-[14px]"
              >
                {sector.organizations.map((organization) => (
                  <li
                    className="flex h-[72px] min-w-0 items-center justify-center rounded-[10px] border border-[#e7e1df] bg-white px-1 text-center text-[10px] font-semibold tracking-[0.6px] text-[#625c5c] sm:h-[85px] sm:px-3 sm:text-[12px] sm:tracking-[0.8px]"
                    key={organization}
                  >
                    {organization}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </SectionContainer>
    </section>
  );
}
