import SectionContainer from "./section-container";

const contactDetails = [
  {
    label: "Telefone",
    content: (
      <>
        <span aria-hidden="true" className="mx-3">
          ·
        </span>
        <a className="transition-colors hover:text-[#862f3b]" href="tel:+244936250151">
          +244 936 250 151
        </a>
      </>
    ),
  },
  {
    label: "Email",
    content: (
      <a
        className="transition-colors hover:text-[#862f3b]"
        href="mailto:comercial@kitadi.co.ao"
      >
        comercial@kitadi.co.ao
      </a>
    ),
  },
  {
    label: "Morada",
    content: <>Edifício  Vany, Av. 21 de Janeiro nº 101, Luanda</>,
  },
];

export default function Contactos() {
  return (
    <section
      aria-labelledby="contact-title"
      className="flex min-h-svh items-center bg-[#f5f2f1] px-6 py-16 text-[#211d1e] sm:py-20 lg:py-10"
      id="contactos"
    >
      <SectionContainer className="max-w-[1356px]">
        <div className="grid items-start gap-12 xl:grid-cols-[1.2fr_1fr] xl:items-center xl:gap-20">
          <div>
            <p className="section-eyebrow text-[#ae7d32]">Contacto</p>
            <h2
              className="section-heading mt-6 max-w-[580px]"
              id="contact-title"
            >
              Vamos conversar sobre o seu futuro financeiro
            </h2>

            <dl className="mt-10 space-y-6 sm:mt-[50px] sm:space-y-7">
              {contactDetails.map((detail) => (
                <div key={detail.label}>
                  <dt className="text-[14px] font-semibold uppercase tracking-[1px] text-[#9b9292]">
                    {detail.label}
                  </dt>
                  <dd className="mt-2 text-[18px] leading-[1.5] sm:text-[22px]">
                    {detail.content}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-[28px] border border-[#e7e1df] bg-white p-7 sm:p-10 lg:p-12">
            <h3 className="text-[30px] font-bold leading-[1.2] tracking-[-0.04em] sm:text-[38px]">
              Newsletter Kitadi
            </h3>
            <p className="mt-6 max-w-[440px] text-[17px] leading-[1.6] text-[#6d6666] sm:mt-[30px] sm:text-[20px]">
              Receba conteúdos de educação financeira directamente no seu
              email.
            </p>

            <form
              action="mailto:contacto@kitadi.co.ao"
              className="mt-6 flex flex-col gap-3 sm:mt-[30px] xl:flex-row xl:items-center xl:gap-[14px]"
              encType="text/plain"
              method="post"
            >
              <label className="sr-only" htmlFor="newsletter-email">
                O seu email
              </label>
              <input
                autoComplete="email"
                className="h-[64px] min-w-0 flex-1 rounded-full border border-[#e7e1df] bg-[#faf9f8] px-7 text-[16px] text-[#211d1e] outline-none transition focus:border-[#862f3b] sm:h-[72px] sm:px-[30px] sm:text-[18px]"
                id="newsletter-email"
                name="email"
                placeholder="O seu email"
                required
                type="email"
              />
              <button
                className="h-[60px] shrink-0 rounded-full bg-[#781626] px-8 text-[16px] font-medium text-white transition-colors hover:bg-[#5e1020] sm:h-[64px] sm:min-w-[177px] sm:px-7 sm:text-[18px]"
                type="submit"
              >
                Subscrever
              </button>
            </form>
          </div>
        </div>
      </SectionContainer>
    </section>
  );
}
