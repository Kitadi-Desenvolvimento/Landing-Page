"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { kitadiWhatsAppNumber } from "../../course-data";

type PaymentPhase = "pending" | "accepted" | "rejected";

export type PaymentTicket = {
  customerName: string;
  customerEmail: string;
  productTitle: string;
  edition: string | null;
  variantLabel: string;
  paidAt: string | null;
  amountKz: number;
};

export type EbookState = { downloaded: boolean };

type PaymentStatusResult = {
  status?: string;
  ticket?: PaymentTicket;
  ebook?: EbookState | null;
};

const copy: Record<PaymentPhase, { title: string; description: string }> = {
  accepted: {
    title: "Pagamento confirmado",
    description:
      "A sua inscrição foi confirmada. Verifique a caixa de entrada e a pasta de spam ou lixo electrónico. Apresente o bilhete abaixo à entrada.",
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
  ebook: initialEbook,
}: {
  reference: string;
  initialStatus: PaymentPhase;
  ticket: PaymentTicket | null;
  ebook: EbookState | null;
}) {
  const [status, setStatus] = useState<PaymentPhase>(initialStatus);
  const [ticket, setTicket] = useState<PaymentTicket | null>(initialTicket);
  const [ebook, setEbook] = useState<EbookState | null>(initialEbook);

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
          if (nextStatus === "accepted" && isEbookState(body.ebook)) setEbook(body.ebook);
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

  if (status === "accepted" && ticket && ebook) {
    return (
      <>
        <h1 className="mt-3 text-4xl font-bold">{current.title}</h1>
        <p className="mt-4 max-w-[560px] text-base leading-7 text-white/80">
          O seu pagamento foi confirmado. O seu e-book está pronto para descarregar abaixo.
        </p>
        <EbookDownloadCard
          customerEmail={ticket.customerEmail}
          initialDownloaded={ebook.downloaded}
          productTitle={ticket.productTitle}
          reference={reference}
        />
      </>
    );
  }

  return (
    <>
      <h1 className="mt-3 text-4xl font-bold">{current.title}</h1>
      <p className="mt-4 max-w-[560px] text-base leading-7 text-white/80">
        {status === "accepted" && ticket
          ? `A sua inscrição foi confirmada. Enviámos um email de confirmação para ${ticket.customerEmail}. Se não o encontrar na caixa de entrada, verifique também a pasta de spam ou lixo electrónico. Apresente o bilhete abaixo à entrada.`
          : current.description}
      </p>
      {status === "accepted" && ticket ? <PaymentTicketCard reference={reference} ticket={ticket} /> : null}
    </>
  );
}

function isEbookState(value: unknown): value is EbookState {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).downloaded === "boolean"
  );
}

function EbookDownloadCard({
  reference,
  productTitle,
  customerEmail,
  initialDownloaded,
}: {
  reference: string;
  productTitle: string;
  customerEmail: string;
  initialDownloaded: boolean;
}) {
  const [downloaded, setDownloaded] = useState(initialDownloaded);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setDownloading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/payments/orders/${encodeURIComponent(reference)}/ebook`,
        { method: "POST", cache: "no-store" },
      );
      const body: unknown = await response.json().catch(() => null);
      if (response.status === 410) {
        setDownloaded(true);
        return;
      }
      const url =
        typeof body === "object" && body !== null && "url" in body && typeof body.url === "string"
          ? body.url
          : "";
      if (!response.ok || !url.startsWith("https://")) {
        throw new Error("download_failed");
      }
      setDownloaded(true);
      window.location.assign(url);
    } catch {
      setError("Não foi possível preparar o seu e-book. Tente novamente dentro de alguns instantes.");
    } finally {
      setDownloading(false);
    }
  }

  const whatsappHref = `https://wa.me/${kitadiWhatsAppNumber}?text=${encodeURIComponent(
    `Olá, comprei o e-book "${productTitle}" com a referência ${reference} e não consegui baixar o ficheiro.`,
  )}`;

  return (
    <article className="mt-8 overflow-hidden rounded-[24px] border border-[#d8bd83] bg-[#fffdf8] text-[#292123] shadow-xl">
      <div className="flex items-center justify-between gap-4 bg-[#510f1d] px-5 py-4 sm:px-7">
        <Image alt="Kitadi" height={40} src="/kitadi-logo.png" width={104} />
        <span className="rounded-full border border-[#d8bd83]/50 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#e4c77f]">
          E-book
        </span>
      </div>
      <div className="p-5 sm:p-7">
        <h2 className="text-2xl font-bold text-[#3a101a]">{productTitle}</h2>
        <p className="mt-1 text-[12px] font-semibold text-[#8b5b39]">Referência {reference}</p>
        <section
          aria-labelledby="ebook-unlock-title"
          className="mt-5 rounded-2xl border border-[#eadcbc] bg-[#faf5e8] px-4 py-4 text-[13px] leading-6 text-[#4a3b2c] sm:px-5"
        >
          <h3 className="text-[15px] font-bold text-[#510f1d]" id="ebook-unlock-title">
            Como desbloquear o seu e-book
          </h3>
          <p className="mt-1">
            Para proteger a sua compra, o e-book está protegido por uma palavra-passe.{" "}
            <strong>A palavra-passe é o email que usou na compra.</strong>
          </p>
          <div className="mt-3 rounded-xl border border-[#d8bd83] bg-white px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9b742d]">
              A sua palavra-passe
            </p>
            <p className="mt-0.5 break-all font-mono text-[15px] font-bold text-[#3a101a]">
              {customerEmail.trim().toLowerCase()}
            </p>
          </div>
          <ol className="mt-4 list-decimal space-y-2 pl-5">
            <li>Descarregue o ficheiro e guarde-o no seu telemóvel ou computador.</li>
            <li>
              Abra o ficheiro. Vai aparecer um pedido de palavra-passe. Conforme a aplicação, pode
              aparecer como <strong>&quot;Palavra-passe&quot;</strong>, <strong>&quot;Senha&quot;</strong> ou{" "}
              <strong>&quot;Password&quot;</strong>.
            </li>
            <li>
              Escreva o seu email exactamente como aparece acima: <strong>tudo em letras minúsculas</strong> e{" "}
              <strong>sem espaços</strong> antes ou depois.
            </li>
            <li>Confirme. O e-book abre normalmente.</li>
            <li>Sempre que voltar a abrir o e-book, use o mesmo email como palavra-passe.</li>
          </ol>
          <div className="mt-4 border-t border-[#eadcbc] pt-3">
            <p className="font-bold text-[#510f1d]">Onde abrir o e-book</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><strong>iPhone ou iPad:</strong> aplicação Ficheiros ou Livros.</li>
              <li><strong>Android:</strong> Google Drive ou Adobe Acrobat Reader.</li>
              <li><strong>Computador:</strong> Adobe Acrobat Reader, Google Chrome ou Microsoft Edge.</li>
            </ul>
          </div>
          <div className="mt-4 border-t border-[#eadcbc] pt-3">
            <p className="font-bold text-[#510f1d]">O e-book não abre?</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Confirme que escreveu o email sem letras maiúsculas e sem espaços.</li>
              <li>Confirme que usou o email desta compra, e não outro email.</li>
              <li>
                Se mesmo assim não abrir, fale connosco no WhatsApp e indique a referência{" "}
                <strong>{reference}</strong>.
              </li>
            </ul>
          </div>
        </section>
        {downloaded ? (
          <div className="mt-6">
            <p className="text-[14px] font-semibold text-[#3a101a]">O seu e-book já foi descarregado.</p>
            <p className="mt-2 text-[13px] leading-6 text-[#716a69]">
              Por segurança, o download só pode ser feito uma vez. Não conseguiu baixar o ficheiro?
              Fale connosco no WhatsApp e indique a referência da compra. Enviamos-lhe o e-book.
            </p>
            <a
              className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#25D366] px-6 text-[14px] font-semibold !text-[#12321d] transition-colors hover:bg-[#49df7d]"
              href={whatsappHref}
              rel="noopener noreferrer"
              target="_blank"
            >
              Não consegui baixar — falar no WhatsApp
            </a>
          </div>
        ) : (
          <div className="mt-6">
            <p className="text-[13px] leading-6 text-[#716a69]">
              Atenção: o download só pode ser feito <strong>uma única vez</strong>. Guarde o ficheiro no seu dispositivo.
            </p>
            <button
              className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#cda45c] px-7 text-[14px] font-bold text-[#2b160f] transition-colors hover:bg-[#dab76e] disabled:opacity-60"
              disabled={downloading}
              onClick={() => void download()}
              type="button"
            >
              {downloading ? "A preparar o e-book…" : "Baixar e-book"}
            </button>
            {error ? (
              <p className="mt-3 rounded-xl bg-[#fff1f0] px-3 py-2 text-[12px] text-[#a43832]" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}

function isTicket(value: unknown): value is PaymentTicket {
  if (typeof value !== "object" || value === null) return false;
  const ticket = value as Record<string, unknown>;
  return (
    typeof ticket.customerName === "string" &&
    typeof ticket.customerEmail === "string" &&
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
