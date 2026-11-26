"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { messageFromApiBody } from "../lib/api-error-messages";
import { BackofficeRequestError, backofficeKeys, invalidateBackoffice, queryStaleTime } from "../lib/backoffice-query";
import { personInitials, personLabel } from "../lib/person-label";

async function loadProfile(signal: AbortSignal) {
  const response = await fetch("/api/backoffice/profile", { cache: "no-store", signal });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof result !== "object" || result === null || !("displayName" in result) || typeof result.displayName !== "string") {
    return "";
  }
  return result.displayName;
}

async function saveProfile(displayName: string) {
  const response = await fetch("/api/backoffice/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new BackofficeRequestError(messageFromApiBody(result, "Não foi possível guardar o nome."), response.status);
  return typeof result === "object" && result !== null && "displayName" in result && typeof result.displayName === "string"
    ? result.displayName
    : displayName.trim();
}

export default function NameButton({ email }: { email: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const profileQuery = useQuery({
    queryKey: backofficeKeys.profile,
    queryFn: ({ signal }) => loadProfile(signal),
    staleTime: queryStaleTime.static,
  });
  const displayName = profileQuery.data ?? "";
  const saveName = useMutation({
    mutationFn: (nextName: string) => saveProfile(nextName),
    onSuccess: (saved) => {
      queryClient.setQueryData(backofficeKeys.profile, saved);
      void invalidateBackoffice("command", "team");
      setDraft(saved);
      setOpen(false);
    },
    onError: (cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Não foi possível guardar o nome.");
    },
  });

  function save() {
    setError("");
    saveName.mutate(draft);
  }

  const label = personLabel(displayName, email);

  return (
    <>
      <button
        className="flex items-center gap-2 rounded-full border border-[#eee8e5] py-1 pl-1 pr-3 text-[11px] font-semibold text-[#5c534f]"
        onClick={() => { setDraft(displayName); setError(""); setOpen(true); }}
        type="button"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-[#f1e8e4] text-[11px] font-bold text-[#652636]">
          {personInitials(displayName, email)}
        </span>
        <span className="hidden max-w-[140px] truncate sm:inline">{label}</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#211d1e]/45 p-4">
          <section aria-labelledby="name-title" aria-modal="true" className="w-full max-w-[420px] rounded-[24px] bg-white p-5 shadow-2xl" role="dialog">
            <h2 className="text-lg font-bold text-[#302829]" id="name-title">O meu nome</h2>
            <p className="mt-2 text-[12px] text-[#817773]">Este nome substitui o email na equipa, nos objectivos e nos bloqueios. O email da conta mantém-se {email}.</p>
            <label className="mt-4 block text-[10px] font-semibold text-[#817773]">
              Nome
              <input className="mt-1 min-h-10 w-full rounded-xl border border-[#e9e3e0] px-3 text-[12px] text-[#302829]" maxLength={80} onChange={(event) => setDraft(event.target.value)} value={draft} />
            </label>
            {error ? <p className="mt-2 text-[11px] text-red-700" role="alert">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button className="min-h-10 rounded-full px-4 text-[11px] font-semibold text-[#625858]" onClick={() => setOpen(false)} type="button">Cancelar</button>
              <button className="min-h-10 rounded-full bg-[#510f1d] px-5 text-[11px] font-semibold text-white disabled:opacity-50" disabled={saveName.isPending} onClick={() => void save()} type="button">{saveName.isPending ? "A guardar…" : "Guardar"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
