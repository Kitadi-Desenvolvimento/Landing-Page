import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import ExecutiveIntelligence from "./executive-intelligence-client";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Executive Intelligence | Kitadi BackOffice",
  robots: { index: false, follow: false },
};

export default async function ExecutiveIntelligencePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  const role = user?.app_metadata.role;
  if (!user || (role !== "admin" && role !== "manager")) {
    redirect("/backoffice/login");
  }

  // Load areas
  const { data: areas } = await supabase
    .from("objective_areas")
    .select("id,name")
    .eq("active", true)
    .order("name");

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#faf9f8] to-[#f0e8e6]">
      {/* Header */}
      <div className="border-b border-[#e7e1df] bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-gradient-to-br from-[#510f1d] to-[#862f3b] p-2">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#510f1d]">Executive Intelligence</h1>
                <p className="text-sm text-[#716a69]">Visão completa das atividades da empresa</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#716a69]">👤 {user.email}</p>
              <p className="text-xs font-semibold text-[#510f1d] capitalize">{role}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ExecutiveIntelligence
          areas={areas || []}
          userRole={role}
          userId={user.id}
        />
      </div>
    </main>
  );
}
