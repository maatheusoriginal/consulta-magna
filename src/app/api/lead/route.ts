import { NextResponse } from "next/server";

import { erro } from "@/lib/api";
import { reconstruirCotacao } from "@/lib/cotacao-servidor";
import { MENSAGEM_SEM_PERSISTENCIA, leadRepository } from "@/lib/leads";
import { REGRAS, aplicarRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Registra o lead a partir dos DADOS DE ENTRADA enviados pelo navegador.
 *
 * Nada vindo do cliente é aceito como verdade: a identidade e o valor FIPE do
 * veículo são reconsultados na tabela a partir dos códigos, e mensalidade,
 * participação, adesão, plano recomendado e `statusPrecificacao` são
 * recalculados pelo `PricingProvider` (ver `src/lib/cotacao-servidor.ts`).
 * O snapshot persistido e devolvido é sempre o do servidor.
 */
export async function POST(request: Request) {
  const limite = await aplicarRateLimit(request, REGRAS.lead);
  if (limite) return limite;

  let bruto: unknown;
  try {
    bruto = await request.json();
  } catch {
    return erro("Corpo da requisição inválido.");
  }

  // A reconstrução revalida o veículo na FIPE antes de precificar.
  const resultado = await reconstruirCotacao(bruto);
  if (!resultado.ok) return erro(resultado.erro, resultado.status);

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

  try {
    const persistencia = await repositorio.salvar(resultado.snapshot);
    // O frontend usa ESTE snapshot — o do servidor — na tela final e no WhatsApp.
    return NextResponse.json({ ok: true, ...persistencia, snapshot: resultado.snapshot });
  } catch (e) {
    console.error("[lead] falha ao persistir:", e);
    return erro("Não foi possível registrar seus dados agora. Tente novamente.", 502);
  }
}
