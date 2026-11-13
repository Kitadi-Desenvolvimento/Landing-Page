import type { Metadata } from "next";
import BackofficeLoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Acesso ao back office | Kitadi",
  robots: { index: false, follow: false },
};

export default function BackofficeLoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[#f5f2f1] px-6 py-16">
      <section className="w-full max-w-[440px] rounded-[28px] bg-white p-7 shadow-[0_20px_60px_rgba(43,22,15,0.12)] sm:p-10">
        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#ae7d32]">
          Kitadi · Back office
        </p>
        <h1 className="mt-4 text-3xl font-bold text-[#211d1e]">Iniciar sessão</h1>
        <p className="mt-3 text-sm leading-6 text-[#716a69]">
          O acesso é reservado a contas com o papel de administrador.
        </p>
        <BackofficeLoginForm />
      </section>
    </main>
  );
}
