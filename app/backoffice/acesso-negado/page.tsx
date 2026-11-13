import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Acesso não autorizado | Kitadi",
  robots: { index: false, follow: false },
};

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[#f5f2f1] px-6 py-16">
      <section className="w-full max-w-[480px] rounded-[28px] bg-white p-8 text-center shadow-[0_20px_60px_rgba(43,22,15,0.12)]">
        <h1 className="text-3xl font-bold text-[#211d1e]">Acesso não autorizado</h1>
        <p className="mt-4 text-sm leading-6 text-[#716a69]">
          Esta conta não tem o papel de administrador necessário para aceder ao back office.
        </p>
        <Link
          className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-[#510f1d] px-7 font-semibold text-white"
          href="/"
        >
          Voltar ao site
        </Link>
      </section>
    </main>
  );
}
