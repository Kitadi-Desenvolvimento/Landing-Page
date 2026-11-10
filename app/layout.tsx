import type { Metadata } from "next";
import SiteFooter from "./site-footer";
import "./globals.css";

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
    <html lang="pt">
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
