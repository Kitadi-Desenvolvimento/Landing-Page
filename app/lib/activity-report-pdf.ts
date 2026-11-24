import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "@cantoo/pdf-lib";

export type ActivityReportEntry = {
  occurredAt: string;
  type: string;
  actor: string;
  subject: string;
  description: string;
};

function safePdfText(value: string) {
  return [...value.normalize("NFC")].map((character) => {
    const code = character.codePointAt(0) ?? 0;
    return (code >= 32 && code <= 126) || (code >= 160 && code <= 255)
      ? character
      : " ";
  }).join("");
}

function wrapText(value: string, maxLength: number) {
  const words = safePdfText(value).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (word.length > maxLength) {
      if (current) lines.push(current);
      current = "";
      for (let index = 0; index < word.length; index += maxLength) {
        lines.push(word.slice(index, index + maxLength));
      }
    } else if (current && `${current} ${word}`.length > maxLength) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export async function buildActivityReportPdf({
  title,
  description,
  periodLabel,
  dateLabel,
  entries,
  emptyMessage,
}: {
  title: string;
  description: string;
  periodLabel: string;
  dateLabel: string;
  entries: ActivityReportEntry[];
  emptyMessage: string;
}) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logo = await document.embedPng(
    await readFile(join(process.cwd(), "public", "kitadi-logo.png")),
  );
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 44;
  const logoWidth = 142;
  const logoHeight = logoWidth / (logo.width / logo.height);
  const pages = [];
  let page = document.addPage(pageSize);
  pages.push(page);
  let y = pageSize[1] - margin;

  const addPage = () => {
    page = document.addPage(pageSize);
    pages.push(page);
    y = pageSize[1] - margin;
  };
  const draw = (
    text: string,
    options: { bold?: boolean; size?: number; x?: number; color?: ReturnType<typeof rgb> } = {},
  ) => {
    const font = options.bold ? bold : regular;
    const size = options.size ?? 9;
    const x = options.x ?? margin;
    for (const line of wrapText(text, options.x ? 76 : 96)) {
      if (y < margin + size + 8) addPage();
      page.drawText(line, {
        x,
        y,
        size,
        font,
        color: options.color ?? rgb(0.25, 0.21, 0.21),
        maxWidth: pageSize[0] - margin - x,
      });
      y -= size + 4;
    }
  };

  page.drawImage(logo, {
    x: margin,
    y: y - logoHeight,
    width: logoWidth,
    height: logoHeight,
  });
  draw(title, { bold: true, size: 17, x: margin + logoWidth + 18 });
  draw(description, { size: 9, x: margin + logoWidth + 18, color: rgb(0.46, 0.4, 0.39) });
  y -= Math.max(logoHeight, 42) + 10;
  page.drawRectangle({
    x: margin,
    y: y - 31,
    width: pageSize[0] - margin * 2,
    height: 31,
    color: rgb(0.97, 0.95, 0.93),
  });
  page.drawText(`${periodLabel}: ${safePdfText(dateLabel)}`, {
    x: margin + 12,
    y: y - 20,
    size: 9,
    font: bold,
    color: rgb(0.32, 0.26, 0.26),
  });
  page.drawText(`Registos: ${entries.length}`, {
    x: pageSize[0] - margin - 105,
    y: y - 20,
    size: 9,
    font: bold,
    color: rgb(0.32, 0.26, 0.26),
  });
  y -= 50;

  if (entries.length === 0) draw(emptyMessage, { size: 10 });
  for (const entry of entries) {
    if (y < margin + 72) addPage();
    const occurredAt = new Date(entry.occurredAt).toLocaleString("pt-AO", {
      timeZone: "Africa/Luanda",
    });
    draw(`${entry.type} · ${occurredAt}`, {
      bold: true,
      size: 10,
      color: rgb(0.32, 0.06, 0.12),
    });
    draw(entry.subject, { bold: true, size: 9 });
    draw(entry.description, { size: 9 });
    draw(`Responsável: ${entry.actor}`, { size: 8, color: rgb(0.43, 0.38, 0.37) });
    y -= 7;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageSize[0] - margin, y },
      thickness: 0.5,
      color: rgb(0.9, 0.87, 0.85),
    });
    y -= 12;
  }

  pages.forEach((currentPage, index) => {
    currentPage.drawText(`Kitadi · ${index + 1} / ${pages.length}`, {
      x: pageSize[0] - margin - 95,
      y: 22,
      size: 8,
      font: regular,
      color: rgb(0.55, 0.5, 0.49),
    });
  });
  return document.save();
}
