import "server-only";

import { randomBytes } from "node:crypto";
import { PDFDocument } from "@cantoo/pdf-lib";
import type { EbookFile, ProductData } from "../product-types";
import { kitadiWatermarkPngBase64 } from "./ebook-watermark";
import { createSupabaseAdminClient } from "./supabase/admin";

export const ebookBucket = "ebooks";
export const maxEbookBytes = 50 * 1024 * 1024;
const signedDownloadSeconds = 120;
const deliveryRetentionMs = 10 * 60 * 1000;
const watermarkOpacity = 0.18;

export class EbookError extends Error {
  constructor(
    readonly code:
      | "ebook_storage_unavailable"
      | "ebook_original_missing"
      | "ebook_invalid_pdf"
      | "ebook_generation_failed",
  ) {
    super(code);
    this.name = "EbookError";
  }
}

export function getProductEbook(product: Pick<ProductData, "ebook"> | null | undefined) {
  const ebook = product?.ebook;
  if (
    !ebook ||
    typeof ebook.path !== "string" ||
    !ebook.path.startsWith("originals/") ||
    typeof ebook.fileName !== "string"
  ) {
    return null;
  }
  return ebook;
}

export function originalEbookPath(slug: string) {
  return `originals/${slug}/${randomBytes(12).toString("hex")}.pdf`;
}

export function deliveredEbookPath(reference: string) {
  return `deliveries/${reference.toUpperCase()}.pdf`;
}

export function ebookPassword(email: string) {
  return email.trim().toLowerCase();
}

export function safeEbookFileName(fileName: string) {
  const base = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9 _-]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return `${base || "ebook-kitadi"}.pdf`;
}

let logoBytes: Buffer | undefined;

function loadLogo() {
  logoBytes ??= Buffer.from(kitadiWatermarkPngBase64, "base64");
  return logoBytes;
}

/** Verifica que o ficheiro é um PDF que conseguimos marcar e proteger. */
export async function assertUsableEbook(bytes: Uint8Array) {
  if (Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-") {
    throw new EbookError("ebook_invalid_pdf");
  }
  try {
    const document = await PDFDocument.load(bytes, { updateMetadata: false });
    if (document.isEncrypted || document.getPageCount() === 0) {
      throw new EbookError("ebook_invalid_pdf");
    }
  } catch (error) {
    if (error instanceof EbookError) throw error;
    throw new EbookError("ebook_invalid_pdf");
  }
}

/**
 * Coloca o logo da Kitadi como marca de água em todas as páginas e protege o
 * ficheiro com uma palavra-passe de abertura igual ao email do comprador.
 */
export async function personalizeEbook(original: Uint8Array, email: string) {
  try {
    const document = await PDFDocument.load(original, { updateMetadata: false });
    const logo = await document.embedPng(loadLogo());

    for (const page of document.getPages()) {
      const { x, y, width, height } = page.getCropBox();
      const logoWidth = Math.min(width, height) * 0.6;
      const logoHeight = (logoWidth * logo.height) / logo.width;
      page.drawImage(logo, {
        x: x + (width - logoWidth) / 2,
        y: y + (height - logoHeight) / 2,
        width: logoWidth,
        height: logoHeight,
        opacity: watermarkOpacity,
      });
    }

    document.setProducer("Kitadi");
    document.encrypt({
      userPassword: ebookPassword(email),
      ownerPassword: randomBytes(24).toString("hex"),
      permissions: {
        printing: "highResolution",
        modifying: false,
        copying: false,
        annotating: false,
        fillingForms: false,
        contentAccessibility: true,
        documentAssembly: false,
      },
    });

    return await document.save();
  } catch (error) {
    console.error(
      "[ebooks] could not personalize ebook",
      error instanceof Error ? error.name : "unknown",
    );
    throw new EbookError("ebook_generation_failed");
  }
}

export async function downloadStoredFile(storagePath: string) {
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(ebookBucket)
    .download(storagePath);
  if (error || !data) {
    const status = (error as { statusCode?: string; status?: number } | null);
    if (status?.statusCode === "404" || status?.status === 404 || /not.?found/i.test(error?.message ?? "")) {
      throw new EbookError("ebook_original_missing");
    }
    console.error("[ebooks] storage download failed", error?.message ?? "unknown");
    throw new EbookError("ebook_storage_unavailable");
  }
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * As cópias entregues só são precisas enquanto o link temporário é válido
 * (2 minutos). Apaga as que têm mais de 10 minutos para o bucket guardar
 * apenas os originais; a equipa pode sempre gerar uma cópia nova.
 */
export async function cleanupExpiredDeliveries() {
  const storage = createSupabaseAdminClient().storage.from(ebookBucket);
  const cutoff = Date.now() - deliveryRetentionMs;
  const { data, error } = await storage.list("deliveries", {
    limit: 100,
    sortBy: { column: "updated_at", order: "asc" },
  });
  if (error) {
    console.error("[ebooks] delivery cleanup list failed", error.message);
    return;
  }

  const expired = (data ?? [])
    .filter((file) => file.name.endsWith(".pdf"))
    .filter((file) => {
      const touchedAt = Date.parse(file.updated_at ?? file.created_at ?? "");
      return Number.isFinite(touchedAt) && touchedAt < cutoff;
    })
    .map((file) => `deliveries/${file.name}`);
  if (!expired.length) return;

  const { error: removeError } = await storage.remove(expired);
  if (removeError) {
    console.error("[ebooks] delivery cleanup failed", removeError.message);
    return;
  }
  console.info("[ebooks] removed expired delivery copies", { count: expired.length });
}

/**
 * Gera a cópia protegida de uma compra, guarda-a no bucket privado e devolve
 * um link temporário para a descarregar.
 */
export async function createEbookDelivery(input: {
  reference: string;
  email: string;
  ebook: EbookFile;
}) {
  const original = await downloadStoredFile(input.ebook.path);
  const personalized = await personalizeEbook(original, input.email);
  const storage = createSupabaseAdminClient().storage.from(ebookBucket);
  const deliveryPath = deliveredEbookPath(input.reference);

  const { error: uploadError } = await storage.upload(deliveryPath, personalized, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadError) {
    console.error("[ebooks] delivery upload failed", uploadError.message);
    throw new EbookError("ebook_storage_unavailable");
  }

  const { data, error } = await storage.createSignedUrl(deliveryPath, signedDownloadSeconds, {
    download: safeEbookFileName(input.ebook.fileName),
  });
  if (error || !data?.signedUrl) {
    console.error("[ebooks] signed url failed", error?.message ?? "unknown");
    throw new EbookError("ebook_storage_unavailable");
  }
  return data.signedUrl;
}
