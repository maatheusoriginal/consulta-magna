import "server-only";

import { VERSAO_CONSENTIMENTO } from "./config";
import { gerarCodigoSimulacao, gerarSimulationId, montarSnapshot } from "./cotacao";
import { FipeError, consultarPreco } from "./fipe";
import { isEmailValido, isPlacaValida, isWhatsAppValido, normalizePlaca } from "./format";
import type { CotacaoSnapshot } from "./leads/types";
import { pricingProvider } from "./pricing";
import { recomendarPlano } from "./recomendacao";
import {
  categoriaDoTipo,
  type FipeVeiculo,
  finalidadeNaoAlteraCotacao,
  type ParticipacaoId,
  type PerfilRespostas,
  type PlanoId,
  type TipoVeiculo,
} from "./types";

/**
 * Reconstrução da cotação no servidor.
 *
 * O navegador envia apenas os DADOS DE ENTRADA — veículo, respostas do perfil e
 * escolhas do cliente. Nenhum valor calculado no cliente é aceito: mensalidade,
 * participação, adesão, plano recomendado e `statusPrecificacao` são todos
 * recalculados aqui a partir do `PricingProvider`.
 *
 * Isso existe porque a aplicação é pública: qualquer pessoa pode montar um POST
 * à mão. O snapshot persistido e devolvido é sempre o do servidor.
 */

export const MENSAGEM_FIPE_NAO_CONFIRMADA =
  "Não foi possível confirmar os dados FIPE deste veículo. " +
  "Volte e selecione o veículo novamente.";

export const MENSAGEM_FIPE_INDISPONIVEL =
  "Não foi possível confirmar o valor FIPE agora. Tente novamente em alguns instantes.";

const TIPOS: TipoVeiculo[] = ["carros", "motos", "caminhoes"];
const PARTICIPACOES: ParticipacaoId[] = ["padrao", "reduzida", "minima", "zero"];
const PLANOS: PlanoId[] = ["bronze", "prata", "ouro", "premium"];

export interface VeiculoSolicitado {
  tipo: TipoVeiculo;
  marca: string;
  modelo: string;
  anoModelo: number;
  combustivel: string;
  codigoFipe: string;
  valor: number;
  mesReferencia: string;
  /** Códigos da FIPE, guardados para uma futura revalidação contra a API. */
  marcaCodigo?: string;
  modeloCodigo?: string;
  anoCodigo?: string;
}

export interface SolicitacaoLead {
  nome: string;
  whatsapp: string;
  email?: string;
  placa: string;
  /** Consentimento explícito do cliente. Precisa ser `true`. */
  consentimento: boolean;
  veiculo: VeiculoSolicitado;
  /** `null` quando o questionário não se aplica (veículo sem precificação). */
  perfil: PerfilRespostas | null;
  planoEscolhido: PlanoId | null;
  participacaoId: ParticipacaoId | null;
}

export interface FalhaReconstrucao {
  ok: false;
  status: 400 | 422 | 503;
  erro: string;
}

export interface CotacaoReconstruida {
  ok: true;
  snapshot: CotacaoSnapshot;
}

export type ResultadoReconstrucao = CotacaoReconstruida | FalhaReconstrucao;

function falha(erro: string, status: 400 | 422 | 503 = 400): FalhaReconstrucao {
  return { ok: false, status, erro };
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function numero(valor: unknown): number {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

/**
 * Validação mínima da identidade do veículo.
 *
 * Não reconsultamos a FIPE a cada envio para não multiplicar chamadas externas,
 * mas os códigos ficam guardados no snapshot para uma revalidação futura.
 */
function validarVeiculo(bruto: unknown): VeiculoSolicitado | string {
  if (!bruto || typeof bruto !== "object") return "Cotação sem dados do veículo.";
  const v = bruto as Record<string, unknown>;

  const tipo = texto(v.tipo) as TipoVeiculo;
  if (!TIPOS.includes(tipo)) return "Tipo de veículo inválido.";

  const codigoFipe = texto(v.codigoFipe);
  if (!codigoFipe) return "Cotação sem código FIPE.";

  const valor = numero(v.valor);
  if (!(valor > 0)) return "Cotação sem valor FIPE válido.";

  const modelo = texto(v.modelo);
  if (!modelo) return "Cotação sem modelo do veículo.";

  const anoModelo = numero(v.anoModelo);
  if (!(anoModelo > 1900 && anoModelo < 2200)) return "Cotação sem ano do veículo.";

  return {
    tipo,
    marca: texto(v.marca),
    modelo,
    anoModelo,
    combustivel: texto(v.combustivel),
    codigoFipe,
    valor,
    mesReferencia: texto(v.mesReferencia),
    marcaCodigo: texto(v.marcaCodigo) || undefined,
    modeloCodigo: texto(v.modeloCodigo) || undefined,
    anoCodigo: texto(v.anoCodigo) || undefined,
  };
}

function validarPerfil(bruto: unknown): PerfilRespostas | null | string {
  if (bruto === null || bruto === undefined) return null;
  if (typeof bruto !== "object") return "Perfil inválido.";
  const p = bruto as Record<string, unknown>;

  const campos: Record<string, readonly string[]> = {
    finalidade: ["particular", "aplicativo"],
    prioridade: ["roubo", "colisao", "terceiros", "completa"],
    viagens: ["quase-nunca", "as-vezes", "frequencia"],
    carroReserva: ["nao-preciso", "interessante", "muito-importante"],
    terceiros: ["nao-prioridade", "intermediaria", "alta"],
    vidros: ["nao", "um-pouco", "sim"],
  };

  for (const [campo, valores] of Object.entries(campos)) {
    if (!valores.includes(texto(p[campo]))) return `Resposta inválida para ${campo}.`;
  }

  return p as unknown as PerfilRespostas;
}

/**
 * Revalida o veículo contra a tabela FIPE e devolve a identidade canônica.
 *
 * Os códigos `tipo + marcaCodigo + modeloCodigo + anoCodigo` são a única
 * entrada aceita: marca, modelo, ano, combustível, código e VALOR vêm da
 * resposta da FIPE, nunca do navegador. Um código de carro enviado como moto
 * simplesmente não existe na tabela de motos e é rejeitado — nunca há fallback
 * para outro tipo.
 *
 * `consultarPreco` já tem cache (6h em memória, 24h no cache do Next), então na
 * prática o veículo recém-selecionado responde do cache.
 */
async function revalidarNaFipe(
  entrada: VeiculoSolicitado,
): Promise<FipeVeiculo | FalhaReconstrucao> {
  if (!entrada.marcaCodigo || !entrada.modeloCodigo || !entrada.anoCodigo) {
    return falha(MENSAGEM_FIPE_NAO_CONFIRMADA, 422);
  }

  try {
    const veiculo = await consultarPreco(
      entrada.tipo,
      entrada.marcaCodigo,
      entrada.modeloCodigo,
      entrada.anoCodigo,
    );

    if (!(veiculo.valor > 0)) return falha(MENSAGEM_FIPE_INDISPONIVEL, 503);
    return veiculo;
  } catch (e) {
    // Combinação inexistente é adulteração; indisponibilidade é infraestrutura.
    if (e instanceof FipeError && e.status === 404) {
      return falha(MENSAGEM_FIPE_NAO_CONFIRMADA, 422);
    }
    // Sem confirmação não há cotação: o valor do navegador nunca vira fallback.
    console.error("[cotacao] falha ao revalidar o veículo na FIPE:", e);
    return falha(MENSAGEM_FIPE_INDISPONIVEL, 503);
  }
}

/** Valida a solicitação e reconstrói a cotação inteiramente no servidor. */
export async function reconstruirCotacao(bruto: unknown): Promise<ResultadoReconstrucao> {
  if (!bruto || typeof bruto !== "object") return falha("Corpo da requisição inválido.");
  const corpo = bruto as Record<string, unknown>;

  // ----------------------------------------------------------------- contato
  const nome = texto(corpo.nome);
  if (nome.length < 2) return falha("Informe o nome completo.");

  const whatsapp = texto(corpo.whatsapp);
  if (!isWhatsAppValido(whatsapp)) return falha("Informe um WhatsApp válido com DDD.");

  const email = texto(corpo.email);
  if (email && !isEmailValido(email)) return falha("E-mail inválido.");

  const placa = normalizePlaca(texto(corpo.placa));
  if (!isPlacaValida(placa)) return falha("Informe a placa do veículo (ABC1234 ou ABC1D23).");

  if (corpo.consentimento !== true) {
    return falha("É necessário concordar com o uso dos dados para continuar.");
  }

  // ----------------------------------------------------------------- veículo
  const veiculo = validarVeiculo(corpo.veiculo);
  if (typeof veiculo === "string") return falha(veiculo);

  const perfil = validarPerfil(corpo.perfil);
  if (typeof perfil === "string") return falha(perfil);

  const planoEscolhido = corpo.planoEscolhido == null ? null : texto(corpo.planoEscolhido);
  const participacaoId = corpo.participacaoId == null ? null : texto(corpo.participacaoId);

  // A identidade e o VALOR do veículo vêm da FIPE, não do navegador.
  const revalidado = await revalidarNaFipe(veiculo);
  if ("ok" in revalidado) return revalidado;

  const identidade = {
    simulationId: gerarSimulationId(),
    codigo: gerarCodigoSimulacao(),
    placa,
    consentimentoEm: new Date().toISOString(),
    consentimentoVersao: VERSAO_CONSENTIMENTO,
    lead: { nome, whatsapp, email: email || undefined },
    veiculo: { ...revalidado, placa },
  };

  // ------------------------------------------------- oferta real da categoria
  const categoria = categoriaDoTipo(revalidado.tipo);
  const planosDaCategoria = pricingProvider.getAvailablePlanIds(categoria);

  if (planosDaCategoria.length === 0) {
    // Categoria sem regra: nenhum valor pode vir do cliente, e nenhum é criado.
    if (planoEscolhido !== null || participacaoId !== null) {
      return falha("Este veículo não tem planos disponíveis para cotação automática.", 422);
    }

    return {
      ok: true,
      snapshot: montarSnapshot({ ...identidade, perfil: null, precificacao: null }),
    };
  }

  // ------------------------------------------------------------ cotação real
  if (!perfil) return falha("Cotação sem as respostas do questionário.");

  if (!planoEscolhido || !PLANOS.includes(planoEscolhido as PlanoId)) {
    return falha("Cotação sem plano escolhido.");
  }
  if (!planosDaCategoria.includes(planoEscolhido as PlanoId)) {
    return falha("Este plano não é oferecido para esta categoria de veículo.", 422);
  }

  if (!participacaoId || !PARTICIPACOES.includes(participacaoId as ParticipacaoId)) {
    return falha("Cotação sem modalidade de participação.");
  }

  // A finalidade só vale onde ela é perguntada. Em moto o cliente não declara
  // nada, então uso comercial não pode ser forçado pelo request.
  const usoComercial =
    !finalidadeNaoAlteraCotacao(revalidado.tipo) && perfil.finalidade === "aplicativo";

  const preco = pricingProvider.precificar({
    categoria,
    // O valor é o da FIPE revalidada, jamais o enviado pelo cliente.
    valorFipe: revalidado.valor,
    planoId: planoEscolhido as PlanoId,
    usoComercial,
  });

  if (preco.status === "UNAVAILABLE") {
    return falha("Não foi possível apurar valores para este veículo.", 422);
  }

  const participacao = preco.participacoes.find((p) => p.id === participacaoId);
  if (!participacao) {
    return falha(
      "Esta modalidade de participação não está disponível para o uso informado.",
      422,
    );
  }

  // O plano recomendado também é do servidor, nunca do cliente.
  const { finalidade: _finalidade, ...respostas } = perfil;
  const planoRecomendado = recomendarPlano(respostas, planosDaCategoria).plano.id;

  return {
    ok: true,
    snapshot: montarSnapshot({
      ...identidade,
      perfil,
      precificacao: {
        // O status vem do provider, jamais do request.
        status: preco.status,
        planoRecomendado,
        planoEscolhido: planoEscolhido as PlanoId,
        participacao,
        taxaAdesao: participacao.taxaAdesao,
      },
    }),
  };
}
