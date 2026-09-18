import type { CotacaoSnapshot } from "./leads/types";
import { normalizePlaca } from "./format";
import type { ParticipacaoPrecificada, PricingStatus } from "./pricing/types";
import {
  finalidadeNaoAlteraCotacao,
  type FipeVeiculo,
  type Lead,
  type PerfilRespostas,
  type PlanoId,
} from "./types";

/** Código legível da simulação, exibido ao cliente e usado pelo consultor. */
export function gerarCodigoSimulacao(): string {
  return `MG-${Math.floor(10_000 + Math.random() * 89_999)}`;
}

/** Identificador técnico único da simulação. */
export function gerarSimulationId(): string {
  return crypto.randomUUID();
}

/** Bloco de valores apurados. Ausente quando não há regra para o veículo. */
export interface PrecificacaoDaCotacao {
  status: Exclude<PricingStatus, "UNAVAILABLE">;
  planoRecomendado: PlanoId;
  planoEscolhido: PlanoId;
  participacao: ParticipacaoPrecificada;
  taxaAdesao: number;
}

/**
 * Monta o snapshot definitivo da cotação.
 *
 * É a única fonte de verdade usada depois desta etapa: o lead é persistido a
 * partir dele e a mensagem do WhatsApp é montada a partir dele.
 *
 * A placa é obrigatória e vem sempre do que o cliente informou — nunca é
 * inferida a partir da FIPE. Quando `precificacao` é `null`, o snapshot sai com
 * `statusPrecificacao: "UNAVAILABLE"` e todos os valores em `null`: não
 * inventamos R$ 0 como se fosse preço.
 */
export function montarSnapshot(entrada: {
  simulationId: string;
  codigo: string;
  placa: string;
  veiculo: FipeVeiculo;
  /** `null` quando o questionário não foi aplicado. */
  perfil: PerfilRespostas | null;
  precificacao: PrecificacaoDaCotacao | null;
  lead: Lead;
  /** Momento do consentimento, registrado pelo servidor. */
  consentimentoEm: string;
  /** Versão do texto de consentimento aceito. */
  consentimentoVersao: string;
}): CotacaoSnapshot {
  const placa = normalizePlaca(entrada.placa);
  if (!placa) throw new Error("A cotação não pode ser fechada sem a placa do veículo.");

  const { finalidade, ...respostas } = entrada.perfil ?? { finalidade: undefined };

  // Para motocicletas a finalidade não altera a precificação e não é
  // perguntada, então não há uso declarado a registrar.
  const perguntamosAFinalidade =
    entrada.perfil !== null && !finalidadeNaoAlteraCotacao(entrada.veiculo.tipo);
  const usoDeclarado = perguntamosAFinalidade
    ? finalidade === "aplicativo"
      ? ("Aplicativo / Táxi" as const)
      : ("Particular" as const)
    : null;

  const base = {
    simulationId: entrada.simulationId,
    codigo: entrada.codigo,
    criadoEm: new Date().toISOString(),
    consentimentoEm: entrada.consentimentoEm,
    consentimentoVersao: entrada.consentimentoVersao,

    nome: entrada.lead.nome,
    telefone: entrada.lead.whatsapp.replace(/\D/g, ""),
    email: entrada.lead.email,

    placa,
    tipoVeiculo: entrada.veiculo.tipo,
    marca: entrada.veiculo.marca,
    // A FIPE devolve modelo e versão num campo só; guardamos os dois para o CRM.
    modelo: entrada.veiculo.modelo,
    versao: entrada.veiculo.modelo,
    ano: entrada.veiculo.anoModelo,
    combustivel: entrada.veiculo.combustivel,
    codigoFipe: entrada.veiculo.codigoFipe,
    valorFipe: entrada.veiculo.valor,
    mesReferenciaFipe: entrada.veiculo.mesReferencia,

    usoDeclarado,
    usoParaPrecificacao: usoDeclarado === "Aplicativo / Táxi" ? ("COMERCIAL" as const) : ("STANDARD" as const),
    respostasQuestionario: entrada.perfil
      ? (respostas as Omit<PerfilRespostas, "finalidade">)
      : null,
  };

  if (!entrada.precificacao) {
    return {
      ...base,
      statusPrecificacao: "UNAVAILABLE",
      planoRecomendado: null,
      planoEscolhido: null,
      mensalidade: null,
      modalidadeParticipacao: null,
      percentualParticipacao: null,
      valorParticipacao: null,
      adesao: null,
    };
  }

  const { participacao } = entrada.precificacao;

  return {
    ...base,
    statusPrecificacao: entrada.precificacao.status,
    planoRecomendado: entrada.precificacao.planoRecomendado,
    planoEscolhido: entrada.precificacao.planoEscolhido,
    mensalidade: participacao.mensalidade,
    modalidadeParticipacao: participacao.nome,
    percentualParticipacao: participacao.percentual,
    valorParticipacao: participacao.valor,
    adesao: entrada.precificacao.taxaAdesao,
  };
}
