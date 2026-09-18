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

/**
 * Monta o snapshot definitivo da cotação.
 *
 * É a única fonte de verdade usada depois desta etapa: o lead é persistido a
 * partir dele e a mensagem do WhatsApp é montada a partir dele.
 *
 * A placa é obrigatória e vem sempre do que o cliente informou — nunca é
 * inferida a partir da FIPE.
 */
export function montarSnapshot(entrada: {
  simulationId: string;
  codigo: string;
  placa: string;
  veiculo: FipeVeiculo;
  perfil: PerfilRespostas;
  planoRecomendado: PlanoId;
  planoEscolhido: PlanoId;
  participacao: ParticipacaoPrecificada;
  taxaAdesao: number;
  statusPrecificacao: PricingStatus;
  lead: Lead;
}): CotacaoSnapshot {
  const { finalidade, ...respostasQuestionario } = entrada.perfil;
  const placa = normalizePlaca(entrada.placa);

  if (!placa) throw new Error("A cotação não pode ser fechada sem a placa do veículo.");

  // Em moto a finalidade não é perguntada, então não há uso declarado.
  const perguntamosAFinalidade = !finalidadeNaoAlteraCotacao(entrada.veiculo.tipo);
  const usoDeclarado = perguntamosAFinalidade
    ? finalidade === "aplicativo"
      ? ("Aplicativo / Táxi" as const)
      : ("Particular" as const)
    : null;

  return {
    simulationId: entrada.simulationId,
    codigo: entrada.codigo,
    criadoEm: new Date().toISOString(),

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
    usoParaPrecificacao: usoDeclarado === "Aplicativo / Táxi" ? "COMERCIAL" : "STANDARD",
    respostasQuestionario,

    planoRecomendado: entrada.planoRecomendado,
    planoEscolhido: entrada.planoEscolhido,
    mensalidade: entrada.participacao.mensalidade,
    modalidadeParticipacao: entrada.participacao.nome,
    percentualParticipacao: entrada.participacao.percentual,
    valorParticipacao: entrada.participacao.valor,
    adesao: entrada.taxaAdesao,

    statusPrecificacao: entrada.statusPrecificacao,
  };
}
