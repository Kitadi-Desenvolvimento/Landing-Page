"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type PaymentPhase = "pending" | "accepted" | "rejected";

export type PaymentTicket = {
  customerName: string;
  productTitle: string;
  edition: string | null;
  variantLabel: string;
  paidAt: string | null;
  amountKz: number;
};

type PaymentStatusResult = {
  status?: string;
  ticket?: PaymentTicket;
};

const copy: Record<PaymentPhase, { title: string; description: string }> = {
  accepted: {
    title: "Pagamento confirmado",
    description:
      "A sua inscrição foi confirmada. Apresente o bilhete abaixo à entrada.",
  },
  rejected: {
    title: "Pagamento não concluído",
    description: "O pagamento não foi concluído. Pode voltar ao produto e tentar novamente.",
  },
  pending: {
    title: "Pagamento em confirmação",
    description:
      "A WiPay ainda está a confirmar este pagamento. Esta página actualiza-se quando a confirmação chegar.",
  },
};

export default function PaymentStatus({
  reference,
  initialStatus,
  ticket: initialTicket,
}: {
  reference: string;
  initialStatus: PaymentPhase;
  ticket: PaymentTicket | null;
}) {
  const [status, setStatus] = useState<PaymentPhase>(initialStatus);
  const [ticket, setTicket] = useState<PaymentTicket | null>(initialTicket);

  useEffect(() => {
    if (!reference || status !== "pending") return;

    let stopped = false;
    const check = async () => {
      try {
        const response = await fetch(`/api/payments/orders/${encodeURIComponent(reference)}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const body = (await response.json()) as PaymentStatusResult;
        if (stopped) return;
        if (
          body.status === "accepted" ||
          body.status === "rejected" ||
          body.status === "expired" ||
          body.status === "canceled"
        ) {
          const nextStatus = body.status === "accepted" ? "accepted" : "rejected";
          setStatus(nextStatus);
          if (nextStatus === "accepted" && isTicket(body.ticket)) setTicket(body.ticket);
        }
      } catch {
        // A próxima tentativa volta a consultar o estado.
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), 3000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [reference, status]);

  const current = copy[status];

  return (
    <>
      <h1 className="mt-3 text-4xl font-bold">{current.title}</h1>
      <p className="mt-4 max-w-[560px] text-base leading-7 text-white/80">
        {current.description}
      </p>
      {status === "accepted" && ticket ? <PaymentTicketCard reference={reference} ticket={ticket} /> : null}
    </>
  );
}

function isTicket(value: unknown): value is PaymentTicket {
  if (typeof value !== "object" || value === null) return false;
  const ticket = value as Record<string, unknown>;
  return (
    typeof ticket.customerName === "string" &&
    typeof ticket.productTitle === "string" &&
    (typeof ticket.edition === "string" || ticket.edition === null) &&
    typeof ticket.variantLabel === "string" &&
    (typeof ticket.paidAt === "string" || ticket.paidAt === null) &&
    typeof ticket.amountKz === "number"
  );
}

function PaymentTicketCard({
  reference,
  ticket,
}: {
  reference: string;
  ticket: PaymentTicket;
}) {
  return (
    <article className="ticket-print-area mt-8 overflow-hidden rounded-[24px] border border-[#d8bd83] bg-[#fffdf8] text-[#292123] shadow-xl">
      <div className="flex items-center justify-between gap-4 bg-[#510f1d] px-5 py-4 sm:px-7">
        <Image alt="Kitadi" height={40} src="/kitadi-logo.png" width={104} />
        <span className="rounded-full border border-[#d8bd83]/50 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#e4c77f]">
          Bilhete de entrada
        </span>
      </div>
      <div className="grid gap-6 p-5 sm:grid-cols-[1fr_auto] sm:p-7">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9b742d]">
            Pagamento confirmado
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#3a101a]">{ticket.productTitle}</h2>
          {ticket.edition ? <p className="mt-1 text-sm font-semibold text-[#7b5d2d]">{ticket.edition}</p> : null}
          <div className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <TicketField label="Participante" value={ticket.customerName} />
            <TicketField label="Variante" value={ticket.variantLabel} />
            <TicketField label="Referência" value={reference} />
            <TicketField label="Valor" value={`${new Intl.NumberFormat("pt-AO").format(ticket.amountKz)} Kz`} />
            <TicketField
              label="Data de confirmação"
              value={ticket.paidAt ? new Date(ticket.paidAt).toLocaleString("pt-AO") : "Confirmado"}
            />
          </div>
        </div>
        <div className="flex min-w-[110px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#d8bd83] bg-[#faf5e8] px-4 py-5 text-center">
          <span className="text-3xl font-bold text-[#510f1d]">K</span>
          <span className="mt-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[#766044]">Acesso Kitadi</span>
          <span className="mt-3 break-all font-mono text-[10px] font-bold text-[#510f1d]">{reference}</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t border-[#eee5d4] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p className="text-[10px] leading-5 text-[#756d67]">Apresente este bilhete à equipa Kitadi à entrada. A referência identifica a sua inscrição.</p>
        <button
          className="ticket-print-actions min-h-10 shrink-0 rounded-full bg-[#cda45c] px-5 text-[11px] font-bold text-[#2b160f]"
          onClick={() => window.print()}
          type="button"
        >
          Imprimir / guardar PDF
        </button>
      </div>
    </article>
  );
}

function TicketField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#9a8f88]">{label}</p>
      <p className="mt-1 break-all text-[12px] font-semibold text-[#3f3636]">{value}</p>
    </div>
  );
}
