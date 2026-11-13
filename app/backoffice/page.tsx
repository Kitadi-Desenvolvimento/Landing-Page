import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../lib/supabase/server";
import InviteAdminForm from "./invite-admin-form";
import SignOutButton from "./sign-out-button";

export const metadata: Metadata = {
  title: "Back office | Kitadi",
  robots: { index: false, follow: false },
};

export default async function BackofficePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user || user.app_metadata.role !== "admin") {
    redirect("/backoffice/login");
  }

  return (
    <main className="min-h-svh bg-[#f5f2f1] px-6 py-12 text-[#211d1e] sm:py-16">
      <div className="mx-auto max-w-[960px]">
        <header className="flex flex-col gap-5 border-b border-[#ded7d4] pb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#ae7d32]">
              Kitadi · Administração
            </p>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Back office</h1>
            <p className="mt-2 text-sm text-[#716a69]">{user.email}</p>
          </div>
          <SignOutButton />
        </header>

        <section className="mt-10 rounded-[28px] bg-white p-6 shadow-[0_16px_44px_rgba(43,22,15,0.08)] sm:p-9">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#ae7d32]">
            Acesso da equipa
          </p>
          <h2 className="mt-3 text-2xl font-bold">Convidar administrador</h2>
          <p className="mt-3 max-w-[620px] text-sm leading-6 text-[#716a69]">
            Envia um convite para o e-mail da pessoa. Depois de confirmar o
            endereço, poderá definir a própria palavra-passe e iniciar sessão.
            Só contas com o papel de administrador entram neste back office.
          </p>
          <InviteAdminForm />
        </section>
      </div>
    </main>
  );
}
