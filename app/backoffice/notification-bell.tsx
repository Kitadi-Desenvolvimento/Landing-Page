"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { messageForApiError } from "../lib/api-error-messages";
import { BackofficeRequestError, backofficeKeys, queryStaleTime } from "../lib/backoffice-query";
import type { DashboardSection } from "./dashboard-data";

type StaffNotification = {
  id: string;
  kind: "block" | "commercial_step" | "objective" | "payment";
  title: string;
  detail: string;
  section: Extract<DashboardSection, "objectives" | "commercial" | "payments">;
  targetId: string | null;
};

const kindLabel = {
  block: "Bloqueio",
  commercial_step: "Comercial",
  objective: "Objectivo",
  payment: "Pagamento",
} as const;

async function loadNotifications(signal: AbortSignal) {
  const response = await fetch("/api/backoffice/notifications", { cache: "no-store", signal });
  const result: unknown = await response.json();
  if (!response.ok || typeof result !== "object" || result === null || !("notifications" in result) || !Array.isArray(result.notifications)) {
    const code = typeof result === "object" && result !== null && "error" in result ? result.error : null;
    throw new BackofficeRequestError(messageForApiError(code, "Não foi possível carregar as notificações."), response.status);
  }
  return result.notifications as StaffNotification[];
}

async function dismissNotifications(keys: string[]) {
  const response = await fetch("/api/backoffice/notifications", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys }),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = typeof result === "object" && result !== null && "error" in result ? result.error : null;
    throw new BackofficeRequestError(messageForApiError(code, "Não foi possível eliminar a notificação."), response.status);
  }
}

export default function NotificationBell({
  onOpen,
}: {
  onOpen: (section: DashboardSection, targetId: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dismissError, setDismissError] = useState("");
  const [dismissing, setDismissing] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const notificationsQuery = useQuery({
    queryKey: backofficeKeys.notifications,
    queryFn: ({ signal }) => loadNotifications(signal),
    staleTime: queryStaleTime.notifications,
  });
  const items = notificationsQuery.data ?? [];
  const error = notificationsQuery.error instanceof Error ? notificationsQuery.error.message : "";
  const loading = notificationsQuery.isLoading;

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!panel.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const count = items.length;

  async function dismiss(keys: string[]) {
    if (keys.length === 0 || dismissing) return;
    const previous = queryClient.getQueryData<StaffNotification[]>(backofficeKeys.notifications);
    setDismissError("");
    setDismissing(true);
    queryClient.setQueryData<StaffNotification[]>(
      backofficeKeys.notifications,
      (current) => (current ?? []).filter((item) => !keys.includes(item.id)),
    );
    try {
      await dismissNotifications(keys);
    } catch (dismissFailure) {
      queryClient.setQueryData(backofficeKeys.notifications, previous);
      setDismissError(dismissFailure instanceof Error ? dismissFailure.message : "Não foi possível eliminar a notificação.");
    } finally {
      setDismissing(false);
    }
  }

  return (
    <div className="relative" ref={panel}>
      <button
        aria-expanded={open}
        aria-label={count > 0 ? `Notificações, ${count}` : "Notificações"}
        className="relative flex size-10 items-center justify-center rounded-xl border border-[#eee8e5] text-[#510f1d]"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <svg aria-hidden="true" className="size-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-[#510f1d] px-1 text-[9px] font-bold text-white">
            {count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#ece7e3] bg-white shadow-[0_16px_40px_rgba(44,36,36,0.12)]">
          <div className="flex items-start justify-between gap-3 border-b border-[#f3eeea] px-4 py-3">
            <div>
              <p className="text-[14px] font-semibold text-[#2c2424]">Notificações</p>
              <p className="mt-0.5 text-[12px] text-[#8a807c]">{loading ? "A actualizar" : count === 0 ? "Nada a tratar agora" : `${count} ${count === 1 ? "aviso" : "avisos"}`}</p>
            </div>
            {count > 0 ? (
              <button
                className="shrink-0 text-[11px] font-semibold text-[#762838] underline disabled:opacity-50"
                disabled={dismissing}
                onClick={() => { void dismiss(items.map((item) => item.id)); }}
                type="button"
              >
                Limpar todas
              </button>
            ) : null}
          </div>
          <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {error || dismissError ? <p className="px-4 py-3 text-[12px] text-red-800" role="alert">{dismissError || error}</p> : null}
            {items.map((item) => (
              <div className="flex items-stretch border-t border-[#f6f2f0] first:border-t-0" key={item.id}>
                <button
                  className="min-w-0 flex-1 px-4 py-3 text-left hover:bg-[#fbfaf8]"
                  onClick={() => {
                    setOpen(false);
                    onOpen(item.section, item.targetId);
                    void dismiss([item.id]);
                  }}
                  type="button"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a8792f]">{kindLabel[item.kind]}</p>
                  <p className="mt-1 truncate text-[13px] font-medium text-[#2c2424]">{item.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-[#6f6662]">{item.detail}</p>
                </button>
                <button
                  aria-label={`Eliminar aviso de ${item.title}`}
                  className="px-3 text-[16px] text-[#8a807c] hover:bg-[#fbfaf8] hover:text-[#510f1d] disabled:opacity-50"
                  disabled={dismissing}
                  onClick={() => { void dismiss([item.id]); }}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
            {!loading && !error && count === 0 ? (
              <p className="px-4 py-5 text-[12px] leading-5 text-[#8a807c]">Bloqueios, prazos comerciais, objectivos sem check-in e pagamentos por reconciliar aparecem aqui.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
