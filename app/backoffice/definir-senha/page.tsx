import type { Metadata } from "next";
import SetPasswordForm from "./set-password-form";

export const metadata: Metadata = {
  title: "Definir palavra-passe | Kitadi",
  robots: { index: false, follow: false },
};

export default function SetPasswordPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[#f5f2f1] px-6 py-16">
      <section className="w-full max-w-[480px] rounded-[28px] bg-white p-7 shadow-[0_20px_60px_rgba(43,22,15,0.12)] sm:p-10">
        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#ae7d32]">
          Kitadi · Back office
        </p>
        <h1 className="mt-4 text-3xl font-bold text-[#211d1e]">
          Definir palavra-passe
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#716a69]">
          Escolha uma palavra-passe nova com pelo menos 12 caracteres.
        </p>
        <SetPasswordForm />
      </section>
    </main>
  );
}
