import { NextResponse } from "next/server";

import { erro } from "@/lib/api";
import { isEmailValido, isPlacaValida, isWhatsAppValido, normalizePlaca } from "@/lib/format";
import { MENSAGEM_SEM_PERSISTENCIA, leadRepository } from "@/lib/leads";
import type { CotacaoSnapshot } from "@/lib/leads/types";

export const dynamic = "force-dynamic";

const STATUS_VALIDOS = new Set(["OFFICIAL", "ESTIMATED", "UNAVAILABLE"]);

/** Valida o snapshot recebido do navegador antes de persistir. */
function validar(corpo: Partial<CotacaoSnapshot>): string | null {
  if (!corpo.simulationId) return "Cotação sem identificador de simulação.";
  if (!corpo.codigo) return "Cotação sem código de simulação.";
  if (!isPlacaValida(corpo.placa ?? "")) return "Cotação sem placa válida do veículo.";
  if ((corpo.nome ?? "").trim().length < 2) return "Informe o nome completo.";
  if (!isWhatsAppValido(corpo.telefone ?? "")) return "Informe um WhatsApp válido com DDD.";
  if (corpo.email && !isEmailValido(corpo.email)) return "E-mail inválido.";
  if (!corpo.codigoFipe || !(corpo.valorFipe && corpo.valorFipe > 0)) {
    return "Cotação sem dados da tabela FIPE.";
  }
  if (!corpo.planoEscolhido) return "Cotação sem plano escolhido.";
  if (!(corpo.mensalidade && corpo.mensalidade > 0)) return "Cotação sem mensalidade.";
  if (!STATUS_VALIDOS.has(corpo.statusPrecificacao ?? "")) {
    return "Cotação sem status de precificação.";
  }
  return null;
}

/**
 * Persiste o lead com o snapshot completo da cotação.
 *
 * A resposta informa se o lead foi de fato gravado em destino durável
 * (`persistido`) — log de servidor não conta como persistência.
 */
export async function POST(request: Request) {
  let corpo: Partial<CotacaoSnapshot>;
  try {
    corpo = (await request.json()) as Partial<CotacaoSnapshot>;
  } catch {
    return erro("Corpo da requisição inválido.");
  }

  const problema = validar(corpo);
  if (problema) return erro(problema);

  const repositorio = leadRepository();

  // Em produção o lead PRECISA ir para um destino durável. Sem isso a promessa
  // de "salvar antes de abrir o WhatsApp" não se cumpre, então recusamos em vez
  // de devolver um sucesso falso.
  if (process.env.NODE_ENV === "production" && !repositorio.duravel) {
    console.error(
      "[lead] recusado: não há repositório durável configurado (LEAD_WEBHOOK_URL ausente).",
    );
    return erro(MENSAGEM_SEM_PERSISTENCIA, 503);
  }

  const snapshot: CotacaoSnapshot = {
    ...(corpo as CotacaoSnapshot),
    placa: normalizePlaca(corpo.placa ?? ""),
    telefone: (corpo.telefone ?? "").replace(/\D/g, ""),
    // O horário de gravação é do servidor, não do navegador.
    criadoEm: new Date().toISOString(),
  };

  try {
    const resultado = await repositorio.salvar(snapshot);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    console.error("[lead] falha ao persistir:", e);
    return erro("Não foi possível registrar seus dados agora. Tente novamente.", 502);
  }
}
