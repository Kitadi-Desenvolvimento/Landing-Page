"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function BackofficeLoginForm() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/backoffice");
  const [hasConfigError, setHasConfigError] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setHasConfigError(params.get("error") === "config");
    const next = params.get("next");
    if (
      (next === "/backoffice" || next?.startsWith("/backoffice/")) &&
      !next.startsWith("//")
    ) {
      setNextPath(next);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error || !data.user) {
        setErrorMessage("Não foi possível iniciar sessão. Verifique os dados e tente novamente.");
        return;
      }

      if (!["admin", "manager", "collaborator"].includes(data.user.app_metadata.role)) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          setErrorMessage("Esta conta não tem acesso. Não foi possível terminar a sessão; tente novamente.");
          return;
        }
        setErrorMessage("Esta conta não tem permissão para aceder ao back office.");
        return;
      }
      router.replace(nextPath);
    } catch {
      setErrorMessage("Não foi possível iniciar sessão. Verifique os dados e tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <label className="block text-sm font-semibold text-[#211d1e]">
        E-mail
        <input
          autoComplete="username"
          className="mt-2 min-h-12 w-full rounded-xl border border-[#ded7d4] px-4 font-normal outline-none transition focus:border-[#ae7d32] focus:ring-2 focus:ring-[#cda45c]/25"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      <label className="block text-sm font-semibold text-[#211d1e]">
        Palavra-passe
        <input
          autoComplete="current-password"
          className="mt-2 min-h-12 w-full rounded-xl border border-[#ded7d4] px-4 font-normal outline-none transition focus:border-[#ae7d32] focus:ring-2 focus:ring-[#cda45c]/25"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      {hasConfigError ? (
        <p className="text-sm text-red-700" role="alert">
          O serviço de autenticação ainda não está configurado.
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <button
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#510f1d] px-6 font-semibold text-white transition-colors hover:bg-[#3b0a15] disabled:cursor-wait disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "A iniciar sessão…" : "Entrar"}
      </button>
    </form>
  );
}
