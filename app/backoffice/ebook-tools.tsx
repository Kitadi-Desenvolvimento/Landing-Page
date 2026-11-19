"use client";

import { useState, type ChangeEvent } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import type { ProductRecord } from "../product-types";
import type { DashboardProduct } from "./dashboard-data";

const maxEbookBytes = 50 * 1024 * 1024;

function errorCode(body: unknown) {
  return typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
    ? body.error
    : "";
}

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} MB`;
}

/** Carrega o PDF original de um produto e-book para o bucket privado. */
export function EbookUploader({
  product,
  onSaved,
}: {
  product: DashboardProduct;
  onSaved: (record: ProductRecord) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const ebook = product.data.ebook;

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    setError("");
    setMessage("");
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      setError("Escolha um ficheiro PDF.");
      return;
    }
    if (file.size > maxEbookBytes) {
      setError("O PDF não pode ter mais de 50 MB.");
      return;
    }

    setUploading(true);
    try {
      const endpoint = `/api/backoffice/products/${encodeURIComponent(product.slug)}/ebook`;
      const fileName = /\.pdf$/i.test(file.name) ? file.name : `${file.name}.pdf`;
      const prepare = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, sizeBytes: file.size }),
      });
      const prepared: unknown = await prepare.json().catch(() => null);
      if (!prepare.ok) throw new Error(errorCode(prepared));
      const { path, token } = prepared as { path: string; token: string };

      const { error: uploadError } = await createSupabaseBrowserClient()
        .storage.from("ebooks")
        .uploadToSignedUrl(path, token, file, { contentType: "application/pdf" });
      if (uploadError) throw new Error("ebook_upload_failed");

      const attach = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, fileName }),
      });
      const record: unknown = await attach.json().catch(() => null);
      if (!attach.ok) throw new Error(errorCode(record));
      onSaved(record as ProductRecord);
      setMessage("E-book carregado. As próximas compras recebem este PDF.");
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "";
      setError(
        code === "ebook_invalid_pdf"
          ? "O ficheiro não é um PDF válido ou já está protegido por palavra-passe. Carregue o PDF original, sem protecção."
          : code === "ebook_too_large"
            ? "O PDF não pode ter mais de 50 MB."
            : code === "ebook_requires_simple_product"
              ? "Os e-books só podem ser associados a produtos simples (sem variantes de formação)."
              : "Não foi possível carregar o e-book. Tente novamente.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#eee8e5] bg-[#fcfbfa] p-4">
      <p className="text-[11px] font-semibold text-[#5e5552]">E-book (PDF)</p>
      <p className="mt-1 text-[10px] leading-5 text-[#918783]">
        Depois do pagamento, o cliente descarrega o PDF uma única vez, protegido com o email dele
        como palavra-passe. Active o pagamento automático para vender online.
      </p>
      {ebook ? (
        <p className="mt-3 rounded-xl bg-[#edf4ee] px-3 py-2 text-[11px] text-[#41644d]">
          Ficheiro actual: <strong>{ebook.fileName}</strong> · {formatSize(ebook.sizeBytes)}
        </p>
      ) : (
        <p className="mt-3 rounded-xl bg-[#f3f0ed] px-3 py-2 text-[11px] text-[#766b66]">
          Este produto ainda não tem e-book.
        </p>
      )}
      <label className="mt-3 inline-flex min-h-10 cursor-pointer items-center rounded-full border border-[#e2d6c4] bg-white px-4 text-[11px] font-semibold text-[#762838] hover:bg-[#fbf6ee]">
        {uploading ? "A carregar…" : ebook ? "Substituir PDF" : "Carregar PDF"}
        <input
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={uploading}
          onChange={(event) => void upload(event)}
          type="file"
        />
      </label>
      {message ? <p className="mt-2 text-[11px] text-[#41644d]" role="status">{message}</p> : null}
      {error ? (
        <p className="mt-2 rounded-xl bg-[#fff1f0] px-3 py-2 text-[11px] text-[#a43832]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Gera a cópia protegida do e-book de uma compra para a equipa enviar pelo WhatsApp. */
export function EbookCopyButton({ reference }: { reference: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/backoffice/payments/${encodeURIComponent(reference)}/ebook`,
        { cache: "no-store" },
      );
      const body: unknown = await response.json().catch(() => null);
      const url =
        typeof body === "object" && body !== null && "url" in body && typeof body.url === "string"
          ? body.url
          : "";
      if (!response.ok || !url.startsWith("https://")) throw new Error(errorCode(body));
      window.location.assign(url);
    } catch {
      setError("Não foi possível gerar o PDF.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-1.5">
      <button
        className="text-[9px] font-semibold text-[#762838] hover:underline disabled:opacity-60"
        disabled={loading}
        onClick={() => void download()}
        type="button"
      >
        {loading ? "A gerar PDF…" : "Baixar PDF para enviar no WhatsApp"}
      </button>
      {error ? <p className="mt-0.5 text-[9px] text-[#a43832]">{error}</p> : null}
    </div>
  );
}
