import ReferencesCarousel from "./references-carousel";
import SectionContainer from "./section-container";

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

        <div className="mt-12 lg:mt-[76px]">
          <ReferencesCarousel />
        </div>
      </SectionContainer>
    </section>
  );
}
