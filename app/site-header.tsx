import Image from "next/image";
import Link from "next/link";
import CartLink from "./cart-link";
import MarketTicker from "./market-ticker";

const navItems = [
  { label: "Início", href: "/#inicio" },
  { label: "Produtos e Serviços", href: "/#produtos" },
  { label: "Quem somos", href: "/#quem-somos" },
  { label: "Contactos", href: "/#contactos" },
];

function ContactButton({ className = "" }: { className?: string }) {
  return (
    <Link
      className={`min-h-[50px] items-center justify-center rounded-full bg-[#cda45c] px-[31px] text-[14px] font-medium text-[#2b160f] transition-colors hover:bg-[#dab76e] ${className}`}
      href="/#contactos"
    >
      Contactar
    </Link>
  );
}

export default function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 shadow-lg">
      <div className="border-b border-white/10 bg-[#390b15]/95 px-6 py-4 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1058px] items-center justify-between">
        <Link
          aria-label="Kitadi — início"
          className="relative h-10 w-[124px] sm:h-12 sm:w-[146px]"
          href="/#inicio"
        >
          <Image
            alt="Kitadi"
            className="object-contain"
            fill
            priority
            sizes="(min-width: 640px) 146px, 124px"
            src="/kitadi-logo.png"
          />
        </Link>

        <nav
          aria-label="Navegação principal"
          className="hidden items-center gap-4 md:flex lg:gap-[45px]"
        >
          {navItems.map((item) => (
            <Link
              className="whitespace-nowrap text-[14px] font-normal text-white/90 transition-colors hover:text-[#d1aa64]"
              href={item.href}
              key={item.label}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <CartLink />
          <ContactButton className="inline-flex min-w-[128px]" />
        </div>

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
              <Link
                className="text-sm text-white/90"
                href={item.href}
                key={item.label}
              >
                {item.label}
              </Link>
            ))}
            <CartLink className="min-h-11" />
            <ContactButton className="mt-1 inline-flex min-h-11 px-5" />
          </nav>
        </details>
      </div>
      </div>
      <MarketTicker />
    </header>
  );
}
