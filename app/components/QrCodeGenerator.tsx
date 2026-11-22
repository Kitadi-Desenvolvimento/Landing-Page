"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { generateBrandedQRCode, getProductQRCodeUrl } from "../lib/qr-code-service";

interface QrCodeGeneratorProps {
  slug?: string;
  label: string;
  published?: boolean;
  className?: string;
}

type QRCodeState =
  | { status: "loading" }
  | { status: "ready"; url: string; image: string }
  | { status: "error" };

export default function QrCodeGenerator({
  slug,
  label,
  published = true,
  className = "text-[10px] font-semibold text-[#762838] hover:underline",
}: QrCodeGeneratorProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <>
      <button
        aria-haspopup="dialog"
        className={className}
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        Ver QR code
      </button>
      {open ? <QrCodeModal label={label} onClose={close} published={published} slug={slug} /> : null}
    </>
  );
}

function QrCodeModal({
  slug,
  label,
  published,
  onClose,
}: {
  slug?: string;
  label: string;
  published: boolean;
  onClose: () => void;
}) {
  const [state, setState] = useState<QRCodeState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    async function generate() {
      try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || window.location.origin;
        const url = getProductQRCodeUrl(siteUrl, slug);
        const image = await generateBrandedQRCode(url);
        if (!cancelled) setState({ status: "ready", url, image });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    }

    void generate();
    return () => { cancelled = true; };
  }, [slug, attempt]);

  useEffect(() => {
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const filename = slug === undefined
    ? "kitadi-todos-os-produtos-qr.png"
    : `kitadi-produto-${encodeURIComponent(slug)}-qr.png`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#211d1e]/45 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="qr-modal-title"
        aria-modal="true"
        className="my-auto w-full max-w-[420px] rounded-[24px] bg-white p-5 shadow-2xl sm:p-7"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#ae7d32]">Código QR</p>
            <h2 className="mt-2 break-words text-[19px] font-bold text-[#342c2d]" id="qr-modal-title">{label}</h2>
          </div>
          <button
            aria-label="Fechar"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f6f2f0] text-[#625858]"
            onClick={onClose}
            ref={closeRef}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="mt-5 flex flex-col items-center">
          {state.status === "ready" ? (
            <>
              <Image
                alt={`Código QR — ${label}`}
                className="size-64 rounded-xl border border-[#eee9e6] bg-white"
                height={256}
                src={state.image}
                unoptimized
                width={256}
              />
              <a
                className="mt-3 block max-w-full break-all text-center text-[11px] text-[#762838] hover:underline"
                href={state.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                {state.url}
              </a>
              <a
                aria-label={`Baixar código QR de ${label}`}
                className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full bg-[#510f1d] px-5 text-[12px] font-semibold text-white hover:bg-[#762838]"
                download={filename}
                href={state.image}
              >
                Baixar QR code (PNG)
              </a>
            </>
          ) : state.status === "error" ? (
            <div className="text-center text-[12px] text-[#8a5555]">
              <p role="alert">Não foi possível gerar o QR code. Verifique o endereço público do site e tente novamente.</p>
              <button
                className="mt-2 min-h-10 font-semibold text-[#762838] hover:underline"
                onClick={() => setAttempt((value) => value + 1)}
                type="button"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <p className="py-24 text-[12px] text-[#766b66]" role="status">A gerar QR code…</p>
          )}
        </div>

        {!published ? (
          <p className="mt-4 text-center text-[11px] text-[#8a5555]">
            Rascunho: o link só ficará acessível ao público depois de publicar o produto.
          </p>
        ) : null}
      </section>
    </div>
  );
}
