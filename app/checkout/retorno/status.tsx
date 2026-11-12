"use client";

import { useEffect, useState } from "react";

type PaymentPhase = "pending" | "accepted" | "rejected";

const copy: Record<PaymentPhase, { title: string; description: string }> = {
  accepted: {
    title: "Pagamento confirmado",
    description:
      "A WiPay confirmou este pagamento. A inscrição fica associada ao email indicado no checkout.",
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
}: {
  reference: string;
  initialStatus: PaymentPhase;
}) {
  const [status, setStatus] = useState<PaymentPhase>(initialStatus);

  useEffect(() => {
    if (!reference || status !== "pending") return;

    let stopped = false;
    const check = async () => {
      try {
        const response = await fetch(`/api/payments/orders/${encodeURIComponent(reference)}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const body = (await response.json()) as { status?: string };
        if (stopped) return;
        if (body.status === "accepted" || body.status === "rejected") {
          setStatus(body.status);
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
    </>
  );
}
