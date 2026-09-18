import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Magna · Consultor Digital de Proteção Veicular",
  description:
    "Consulte seu veículo na tabela FIPE, conte o que é importante para você e receba uma recomendação de plano de proteção veicular em poucos minutos.",
  openGraph: {
    title: "Magna · Consultor Digital de Proteção Veicular",
    description:
      "Cotação de proteção veicular personalizada, com valores da tabela FIPE e comparação transparente entre planos.",
    type: "website",
    locale: "pt_BR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-dvh bg-bg-primary font-sans">{children}</body>
    </html>
  );
}
