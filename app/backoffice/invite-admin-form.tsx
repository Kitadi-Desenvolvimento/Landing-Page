"use client";

import { useState, type FormEvent } from "react";

export default function InviteAdminForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setInviteLink("");
    setCopied(false);
    setIsError(false);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/backoffice/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as {
        error?: string;
        link?: string;
      };

      if (!response.ok) {
        const messages: Record<string, string> = {
          invite_exists: "Não foi possível convidar esse endereço. Verifique se já tem conta.",
          invite_unavailable: "Não foi possível gerar o link. Verifique a configuração do Supabase e tente novamente.",
          invite_link_missing: "O Supabase não devolveu o link. Tente novamente.",
          supabase_not_configured: "O serviço de convites não está configurado no servidor.",
          invite_role_update_failed:
            "Não foi possível atribuir acesso de administrador. Contacte o suporte antes de gerar outro link.",
        };
        setIsError(true);
        setMessage(
          result.error
            ? messages[result.error] ?? "Não foi possível enviar o convite."
            : "Não foi possível enviar o convite.",
        );
        return;
      }

      if (!result.link) {
        setIsError(true);
        setMessage("O servidor não devolveu o link de convite. Tente novamente.");
        return;
      }

      setEmail("");
      setInviteLink(result.link);
      setMessage(
        "Link gerado. Partilhe-o diretamente com a pessoa convidada; não foi enviado nenhum e-mail. O link só pode ser usado uma vez.",
      );
    } catch {
      setIsError(true);
      setMessage("Não foi possível gerar o link. Verifique a ligação e tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyInviteLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch {
      setCopied(false);
      setIsError(true);
      setMessage("Não foi possível copiar automaticamente. Selecione e copie o link.");
    }
  }

  return (
    <div className="mt-7">
      <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={handleSubmit}>
        <label className="block flex-1 text-sm font-semibold">
          E-mail a convidar
          <input
            autoComplete="email"
            className="mt-2 min-h-12 w-full rounded-xl border border-[#ded7d4] px-4 font-normal outline-none transition focus:border-[#ae7d32] focus:ring-2 focus:ring-[#cda45c]/25"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <button
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#510f1d] px-7 font-semibold text-white transition-colors hover:bg-[#3b0a15] disabled:cursor-wait disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "A gerar link…" : "Gerar link de convite"}
        </button>
      </form>
      {message ? (
        <p
          className={`mt-4 text-sm ${isError ? "text-red-700" : "text-green-800"}`}
          role={isError ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
      {inviteLink ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            aria-label="Link de convite de uso único"
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#ded7d4] bg-[#faf9f8] px-4 text-sm text-[#211d1e] outline-none focus:border-[#ae7d32] focus:ring-2 focus:ring-[#cda45c]/25"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={inviteLink}
          />
          <button
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#ded7d4] px-6 text-sm font-semibold transition-colors hover:bg-[#f5f2f1]"
            onClick={copyInviteLink}
            type="button"
          >
            {copied ? "Link copiado" : "Copiar link"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
