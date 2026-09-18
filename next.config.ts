import type { NextConfig } from "next";

// Aviso de build: em produção os leads precisam de uma persistência real.
if (process.env.NODE_ENV === "production" && !process.env.LEAD_WEBHOOK_URL?.trim()) {
  console.warn(
    "\n[build] ATENÇÃO: LEAD_WEBHOOK_URL não está configurada.\n" +
      "        Os leads NÃO serão persistidos — o ConsoleLeadRepository apenas\n" +
      "        registra um resumo no log do servidor. Configure uma persistência\n" +
      "        real (webhook, CRM ou banco) antes de publicar.\n",
  );
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
