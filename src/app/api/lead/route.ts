import { NextResponse } from "next/server";

import { erro } from "@/lib/api";
import { isEmailValido, isPlacaValida, isWhatsAppValido, normalizePlaca } from "@/lib/format";
import { MENSAGEM_SEM_PERSISTENCIA, leadRepository } from "@/lib/leads";
import type { CotacaoSnapshot } from "@/lib/leads/types";

export const dynamic = "force-dynamic";

const STATUS_VALIDOS = new Set(["OFFICIAL", "ESTIMATED", "UNAVAILABLE"]);

/** Valida o snapshot recebido do navegador antes de persistir. */
type CorpoLead = Partial<Record<keyof CotacaoSnapshot, unknown>> &
  Partial<Pick<CotacaoSnapshot, "codigo" | "simulationId" | "placa" | "nome" | "telefone" | "email" | "codigoFipe" | "valorFipe" | "statusPrecificacao">>;

function validar(corpo: CorpoLead): string | null {
  if (!corpo.simulationId) return "Cotação sem identificador de simulação.";
  if (!corpo.codigo) return "Cotação sem código de simulação.";
  if (!isPlacaValida(corpo.placa ?? "")) return "Cotação sem placa válida do veículo.";
  if ((corpo.nome ?? "").trim().length < 2) return "Informe o nome completo.";
  if (!isWhatsAppValido(corpo.telefone ?? "")) return "Informe um WhatsApp válido com DDD.";
  if (corpo.email && !isEmailValido(corpo.email)) return "E-mail inválido.";
  if (!corpo.codigoFipe || !(corpo.valorFipe && corpo.valorFipe > 0)) {
    return "Cotação sem dados da tabela FIPE.";
  }
  if (!STATUS_VALIDOS.has(corpo.statusPrecificacao ?? "")) {
    return "Cotação sem status de precificação.";
  }

  if (corpo.statusPrecificacao === "UNAVAILABLE") {
    // Veículo sem regra de precificação: nenhum valor é exigido, e nenhum pode
    // ser inventado. R$ 0 aqui seria apresentar um preço que não existe.
    for (const campo of [
      "planoEscolhido",
      "mensalidade",
      "modalidadeParticipacao",
      "valorParticipacao",
      "adesao",
    ] as const) {
      if (corpo[campo] !== null && corpo[campo] !== undefined) {
        return `Cotação UNAVAILABLE não pode trazer ${campo}.`;
      }
    }
    return null;
  }

  if (!corpo.planoEscolhido) return "Cotação sem plano escolhido.";
  const mensalidade = typeof corpo.mensalidade === "number" ? corpo.mensalidade : 0;
  if (!(mensalidade > 0)) return "Cotação sem mensalidade.";
  return null;
}

/**
 * Persiste o lead com o snapshot completo da cotação.
 *
 * A resposta informa se o lead foi de fato gravado em destino durável
 * (`persistido`) — log de servidor não conta como persistência.
 */
export async function POST(request: Request) {
  let corpo: CorpoLead;
  try {
    corpo = (await request.json()) as CorpoLead;
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
