import { NextResponse } from "next/server";

import { erro } from "@/lib/api";
import { isEmailValido, isWhatsAppValido } from "@/lib/format";

export const dynamic = "force-dynamic";

interface CorpoLead {
  nome?: string;
  whatsapp?: string;
  email?: string;
  codigo?: string;
  resumo?: Record<string, unknown>;
}

/**
 * Registra o lead antes do redirecionamento para o WhatsApp.
 *
 * Por padrão apenas registra no log do servidor. Defina `LEAD_WEBHOOK_URL`
 * (Make, Zapier, n8n, CRM próprio...) para encaminhar o lead adiante.
 */
export async function POST(request: Request) {
  let corpo: CorpoLead;
  try {
    corpo = (await request.json()) as CorpoLead;
  } catch {
    return erro("Corpo da requisição inválido.");
  }

  const nome = corpo.nome?.trim() ?? "";
  const whatsapp = corpo.whatsapp?.trim() ?? "";
  const email = corpo.email?.trim() ?? "";

  if (nome.length < 2) return erro("Informe o nome completo.");
  if (!isWhatsAppValido(whatsapp)) return erro("Informe um WhatsApp válido com DDD.");
  if (email && !isEmailValido(email)) return erro("E-mail inválido.");

  const lead = {
    nome,
    whatsapp: whatsapp.replace(/\D/g, ""),
    email: email || undefined,
    codigo: corpo.codigo,
    resumo: corpo.resumo,
    recebidoEm: new Date().toISOString(),
  };

  const webhook = process.env.LEAD_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e) {
      // O lead nunca deve bloquear o atendimento: seguimos para o WhatsApp.
      console.error("[lead] falha ao enviar para o webhook:", e);
    }
  } else {
    console.info("[lead] recebido:", lead);
  }

  return NextResponse.json({ ok: true });
}
