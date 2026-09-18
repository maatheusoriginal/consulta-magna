import type { PerfilRespostas, PlanoId, TipoVeiculo, UsoPrecificacao } from "../types";
import type { PricingStatus } from "../pricing/types";

/** Snapshot definitivo da cotação, montado no momento em que o lead é capturado. */
export interface CotacaoSnapshot {
  /** Identificador técnico único da simulação (UUID). */
  simulationId: string;
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
   * Uso declarado pelo cliente. `null` quando a pergunta não foi feita — em
   * moto a finalidade não altera a cotação, e registrar "Particular" sem o
   * cliente ter declarado seria falso.
   */
  usoDeclarado: "Particular" | "Aplicativo / Táxi" | null;
  /** Faixa de uso efetivamente aplicada na precificação. */
  usoParaPrecificacao: UsoPrecificacao;
  respostasQuestionario: Omit<PerfilRespostas, "finalidade">;

  // Cotação
  planoRecomendado: PlanoId;
  planoEscolhido: PlanoId;
  mensalidade: number;
  modalidadeParticipacao: string;
  percentualParticipacao: number | null;
  valorParticipacao: number;
  adesao: number;

  /** Procedência dos valores: OFFICIAL, ESTIMATED ou UNAVAILABLE. */
  statusPrecificacao: PricingStatus;
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
