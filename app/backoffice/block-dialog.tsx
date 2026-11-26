"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { messageFromApiBody } from "../lib/api-error-messages";
import { BackofficeRequestError, backofficeKeys, invalidateBackoffice, queryStaleTime } from "../lib/backoffice-query";
import { personLabel } from "../lib/person-label";

type StaffPerson = { id: string; email: string; displayName: string };
type WorkBlock = { id: string; reason: string; people: StaffPerson[] };

async function loadBlock(subjectType: string, subjectId: string, signal: AbortSignal) {
  const response = await fetch(`/api/backoffice/blocks?subjectType=${subjectType}&subjectId=${encodeURIComponent(subjectId)}`, { cache: "no-store", signal });
  const result: unknown = await response.json();
  if (!response.ok || typeof result !== "object" || result === null) {
    throw new BackofficeRequestError(messageFromApiBody(result, "Não foi possível carregar o bloqueio."), response.status);
  }
  const record = result as { people?: StaffPerson[]; block?: WorkBlock | null };
  return {
    people: Array.isArray(record.people) ? record.people : [],
    selected: record.block?.people.map((person) => person.id) ?? [],
    reason: record.block?.reason ?? "",
  };
}

async function saveBlockRequest(subjectType: string, subjectId: string, reason: string, userIds: string[]) {
  const response = await fetch("/api/backoffice/blocks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subjectType, subjectId, reason, userIds }),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new BackofficeRequestError(messageFromApiBody(result, "Não foi possível guardar o bloqueio."), response.status);
  return typeof result === "object" && result !== null && "emailFailed" in result && result.emailFailed === true;
}

export default function BlockDialog({
  subjectType,
  subjectId,
  title,
  onClose,
}: {
  subjectType: "objective" | "opportunity";
  subjectId: string;
  title: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const blockQuery = useQuery({
    queryKey: backofficeKeys.blocks(subjectType, subjectId),
    queryFn: ({ signal }) => loadBlock(subjectType, subjectId, signal),
    staleTime: queryStaleTime.notifications,
  });
  const people = blockQuery.data?.people ?? [];
  const loading = blockQuery.isLoading;
  const saveBlock = useMutation({
    mutationFn: (userIds: string[]) => saveBlockRequest(subjectType, subjectId, reason, userIds),
    onSuccess: async (emailFailed, userIds) => {
      await invalidateBackoffice("blocks", "command", "notifications", "objectives");
      setNotice(userIds.length === 0
        ? "Bloqueio retirado."
        : emailFailed
          ? "Bloqueio guardado. O email não foi enviado."
          : "Bloqueio guardado. As pessoas marcadas receberam o email.");
      if (userIds.length === 0) onClose();
    },
    onError: (cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Não foi possível guardar o bloqueio.");
    },
  });

  useEffect(() => {
    if (!blockQuery.data) return;
    setSelected(blockQuery.data.selected);
    setReason(blockQuery.data.reason);
  }, [blockQuery.data]);

  function save(userIds: string[]) {
    setError("");
    setNotice("");
    saveBlock.mutate(userIds);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#211d1e]/45 p-4">
      <section aria-labelledby="block-title" aria-modal="true" className="my-auto w-full max-w-[520px] rounded-[24px] bg-white p-5 shadow-2xl" role="dialog">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#a8792f]">Bloqueio</p>
            <h2 className="mt-1 text-lg font-bold text-[#302829]" id="block-title">{title}</h2>
          </div>
          <button aria-label="Fechar" className="flex size-9 items-center justify-center rounded-full bg-[#f6f2f0] text-[#625858]" onClick={onClose} type="button">×</button>
        </div>
        {loading ? <p className="mt-4 text-[12px] text-[#817773]">A carregar…</p> : (
          <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); void save(selected); }}>
            <label className="block text-[10px] font-semibold text-[#817773]">
              Motivo
              <textarea className="mt-1 min-h-20 w-full rounded-xl border border-[#e9e3e0] px-3 py-2 text-[12px] text-[#302829]" maxLength={500} onChange={(event) => setReason(event.target.value)} required={selected.length > 0} value={reason} />
            </label>
            <fieldset>
              <legend className="text-[10px] font-semibold text-[#817773]">Quem está a bloquear</legend>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-[#e9e3e0] px-3 py-2">
                {people.map((person) => (
                  <label className="flex items-center gap-2 py-1 text-[12px] text-[#302829]" key={person.id}>
                    <input
                      checked={selected.includes(person.id)}
                      onChange={(event) => setSelected((current) => event.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id))}
                      type="checkbox"
                    />
                    {personLabel(person.displayName, person.email)}
                  </label>
                ))}
                {people.length === 0 ? <p className="text-[12px] text-[#817773]">Não há pessoas disponíveis.</p> : null}
              </div>
            </fieldset>
            {error || (blockQuery.error instanceof Error ? blockQuery.error.message : "") ? <p className="text-[11px] text-red-700" role="alert">{error || (blockQuery.error instanceof Error ? blockQuery.error.message : "")}</p> : null}
            {notice ? <p className="text-[11px] text-[#52765e]">{notice}</p> : null}
            <div className="flex justify-end gap-2">
              <button className="min-h-10 rounded-full px-4 text-[11px] font-semibold text-[#625858]" disabled={saveBlock.isPending} onClick={() => void save([])} type="button">Retirar bloqueio</button>
              <button className="min-h-10 rounded-full bg-[#510f1d] px-5 text-[11px] font-semibold text-white disabled:opacity-50" disabled={saveBlock.isPending} type="submit">{saveBlock.isPending ? "A guardar…" : "Guardar bloqueio"}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
