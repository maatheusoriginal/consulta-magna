import type { CategoriaVeiculo, ParticipacaoId, PlanoId } from "../types";

/**
 * Procedência do valor apresentado ao usuário.
 *
 * - `OFFICIAL`   — veio de uma tabela oficial da Magna.
 * - `ESTIMATED`  — veio de uma regra inferida a partir de cotações de referência.
 * - `UNAVAILABLE`— não há regra aplicável para o veículo/plano consultado.
 */
export type PricingStatus = "OFFICIAL" | "ESTIMATED" | "UNAVAILABLE";

export interface EntradaPrecificacao {
  categoria: CategoriaVeiculo;
  valorFipe: number;
  planoId: PlanoId;
  /** Veículo usado em aplicativo, táxi ou qualquer atividade remunerada. */
  usoComercial: boolean;
}

export interface ParticipacaoPrecificada {
  id: ParticipacaoId;
  nome: string;
  badge?: string;
  descricao: string;
  /** Percentual da FIPE. `null` na modalidade de participação zero. */
  percentual: number | null;
  /** Valor da participação em reais, já com o piso contratual aplicado. */
  valor: number;
  /** `true` quando o piso mínimo contratual elevou o valor da participação. */
  pisoAplicado: boolean;
  /** Mensalidade resultante desta modalidade. */
  mensalidade: number;
  /**
   * Taxa de adesão desta modalidade: `max(adesaoMinima, mensalidade)`.
   * A adesão acompanha a mensalidade FINAL da modalidade, não a mensalidade base.
   */
  taxaAdesao: number;
  carenciaDias?: number;
}

export interface PrecoIndisponivel {
  status: "UNAVAILABLE";
  /** Identificador do provedor que respondeu. */
  provedor: string;
  /** Motivo legível do porquê não há preço para este caso. */
  motivo: string;
}

export interface PrecoDisponivel {
  status: "OFFICIAL" | "ESTIMATED";
  provedor: string;
  /** Aviso a ser exibido/registrado junto com o valor. */
  observacao: string;
  /** Mensalidade do plano na modalidade de participação padrão. */
  mensalidadeBase: number;
  /** Modalidades de participação oferecidas para este veículo e plano. */
  participacoes: ParticipacaoPrecificada[];
  /** Piso da taxa de adesão. A adesão efetiva está em cada modalidade. */
  taxaAdesaoMinima: number;
}

export type ResultadoPrecificacao = PrecoDisponivel | PrecoIndisponivel;

/**
 * Contrato de qualquer fonte de preços da Magna.
 *
 * Um provedor NUNCA consulta a tabela FIPE: ele recebe o valor FIPE já apurado
 * e devolve apenas os valores comerciais da Magna. Ver `docs/PRECIFICACAO.md`.
 */
export interface PricingProvider {
  readonly nome: string;
  readonly status: PricingStatus;
  /** Planos comercializados para a categoria. Vazio quando não há oferta. */
  getAvailablePlanIds(categoria: CategoriaVeiculo): PlanoId[];
  precificar(entrada: EntradaPrecificacao): ResultadoPrecificacao;
}
