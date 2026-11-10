import type { Metadata } from "next";
import localFont from "next/font/local";
import SiteFooter from "./site-footer";
import "./globals.css";

const centuryGothic = localFont({
  src: [
    {
      path: "./fonts/texgyreadventor-regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/texgyreadventor-regular.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/texgyreadventor-bold.otf",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/texgyreadventor-bold.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/texgyreadventor-italic.otf",
      weight: "400",
      style: "italic",
    },
    {
      path: "./fonts/texgyreadventor-italic.otf",
      weight: "500",
      style: "italic",
    },
    {
      path: "./fonts/texgyreadventor-bolditalic.otf",
      weight: "600",
      style: "italic",
    },
    {
      path: "./fonts/texgyreadventor-bolditalic.otf",
      weight: "700",
      style: "italic",
    },
  ],
  display: "swap",
  fallback: ["Century Gothic", "CenturyGothic", "sans-serif"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Kitadi — Escola de Finanças & Negócios",
  description:
    "Educação financeira, programas corporativos e iniciativas de impacto social concebidos para a realidade angolana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" className={centuryGothic.className}>
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
