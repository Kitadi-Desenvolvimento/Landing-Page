"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

export default function SignOutButton() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");

  async function signOut() {
    const { error } = await createSupabaseBrowserClient().auth.signOut();
    if (error) {
      setErrorMessage("Não foi possível terminar a sessão. Tente novamente.");
      return;
    }
    router.replace("/backoffice/login");
    router.refresh();
  }

  return (
    <div>
      <button
        className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ded7d4] px-5 text-sm font-semibold transition-colors hover:bg-white"
        onClick={signOut}
        type="button"
      >
        Terminar sessão
      </button>
      {errorMessage ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
