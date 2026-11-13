"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function SetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password.length < 12) {
      setMessage("A palavra-passe deve ter pelo menos 12 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setMessage("As palavras-passe não coincidem.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await createSupabaseBrowserClient().auth.updateUser({
        password,
      });
      if (error) {
        setMessage("Não foi possível definir a palavra-passe. Volte a abrir o link de convite.");
        return;
      }
      router.replace("/backoffice");
      router.replace("/backoffice");
    } catch {
      setMessage("Não foi possível definir a palavra-passe. Volte a abrir o link de convite.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <label className="block text-sm font-semibold text-[#211d1e]">
        Nova palavra-passe
        <input
          autoComplete="new-password"
          className="mt-2 min-h-12 w-full rounded-xl border border-[#ded7d4] px-4 font-normal outline-none transition focus:border-[#ae7d32] focus:ring-2 focus:ring-[#cda45c]/25"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      <label className="block text-sm font-semibold text-[#211d1e]">
        Confirmar palavra-passe
        <input
          autoComplete="new-password"
          className="mt-2 min-h-12 w-full rounded-xl border border-[#ded7d4] px-4 font-normal outline-none transition focus:border-[#ae7d32] focus:ring-2 focus:ring-[#cda45c]/25"
          onChange={(event) => setConfirmation(event.target.value)}
          required
          type="password"
          value={confirmation}
        />
      </label>
      {message ? (
        <p className="text-sm text-red-700" role="alert">
          {message}
        </p>
      ) : null}
      <button
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#510f1d] px-6 font-semibold text-white transition-colors hover:bg-[#3b0a15] disabled:cursor-wait disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "A guardar…" : "Guardar palavra-passe"}
      </button>
    </form>
  );
}
