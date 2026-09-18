import type { PerfilRespostas, PlanoId, TipoVeiculo, UsoPrecificacao } from "../types";
import type { PricingStatus } from "../pricing/types";

/** Dados presentes em qualquer cotação, com ou sem precificação disponível. */
interface CotacaoSnapshotBase {
  /** Identificador técnico único da simulação (UUID). */
  simulationId: string;
  /** Momento em que o cliente consentiu com o uso dos dados (ISO 8601). */
  consentimentoEm: string;
  /** Código legível para cliente e consultor, ex.: MG-48213 */
  codigo: string;
  criadoEm: string;

  // Contato
  nome: string;
  telefone: string;
  email?: string;

  // Veículo
  /** Placa normalizada (ABC1D23). Obrigatória: o consultor depende dela. */
  placa: string;
  tipoVeiculo: TipoVeiculo;
  marca: string;
  modelo: string;
  versao: string;
  ano: number;
  combustivel: string;
  codigoFipe: string;
  valorFipe: number;
  mesReferenciaFipe: string;

  // Perfil
  /**
   * Uso declarado pelo cliente. `null` quando a pergunta não foi feita — para
   * motocicletas a finalidade não altera a precificação e não é perguntada, e
   * registrar "Particular" sem o cliente ter declarado seria falso.
   */
  usoDeclarado: "Particular" | "Aplicativo / Táxi" | null;
  /** Faixa de uso efetivamente aplicada na precificação. */
  usoParaPrecificacao: UsoPrecificacao;
  /** `null` quando o questionário não foi aplicado (veículo sem precificação). */
  respostasQuestionario: Omit<PerfilRespostas, "finalidade"> | null;
}

/** Cotação com valores apurados. */
export interface CotacaoPrecificada extends CotacaoSnapshotBase {
  statusPrecificacao: Exclude<PricingStatus, "UNAVAILABLE">;
  planoRecomendado: PlanoId;
  planoEscolhido: PlanoId;
  mensalidade: number;
  modalidadeParticipacao: string;
  percentualParticipacao: number | null;
  valorParticipacao: number;
  adesao: number;
}

/**
 * Veículo sem regra de precificação automática (caminhão, por exemplo).
 *
 * Todos os campos de valor são `null` de propósito: inventar R$ 0 seria
 * apresentar um preço que não existe.
 */
export interface CotacaoSemPrecificacao extends CotacaoSnapshotBase {
  statusPrecificacao: "UNAVAILABLE";
  planoRecomendado: null;
  planoEscolhido: null;
  mensalidade: null;
  modalidadeParticipacao: null;
  percentualParticipacao: null;
  valorParticipacao: null;
  adesao: null;
}

/** Snapshot definitivo da cotação, montado no momento em que o lead é capturado. */
export type CotacaoSnapshot = CotacaoPrecificada | CotacaoSemPrecificacao;

/** Estreita o snapshot para o caso em que há valores apurados. */
export function temPrecificacao(snapshot: CotacaoSnapshot): snapshot is CotacaoPrecificada {
  return snapshot.statusPrecificacao !== "UNAVAILABLE";
}

export interface ResultadoPersistencia {
  /** `true` somente quando o lead foi gravado em um destino real e durável. */
  persistido: boolean;
  /** Nome do repositório que atendeu a gravação. */
  repositorio: string;
}

/**
 * Contrato de persistência de leads.
 *
 * `ConsoleLeadRepository` é apenas para desenvolvimento: log de servidor NÃO é
 * persistência de produção e ele devolve `persistido: false`.
 */
export interface LeadRepository {
  readonly nome: string;
  /** `true` apenas para destinos duráveis, aptos a produção. */
  readonly duravel: boolean;
  salvar(snapshot: CotacaoSnapshot): Promise<ResultadoPersistencia>;
}
